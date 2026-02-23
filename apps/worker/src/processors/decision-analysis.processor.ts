import { Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { DecisionAnalysisJobData } from "../config/queue";
import { getAIProvider } from "../services/ai.service";
import { publishRunUpdate } from "../services/event-publisher";
import { GroqProvider } from "../services/providers/groq.provider";

// Lazy PrismaClient — delays instantiation until first use so that DATABASE_URL
// set dynamically by Testcontainers (in beforeAll) is picked up correctly.
let _prismaClient: PrismaClient | undefined;
const prisma = new Proxy({} as PrismaClient, {
  get(_: PrismaClient, prop: string | symbol) {
    if (!_prismaClient) {
      _prismaClient = new PrismaClient();
    }
    const value = (_prismaClient as any)[prop];
    return typeof value === 'function' ? value.bind(_prismaClient) : value;
  },
});

// Main processor function - now processes by runId
export async function processDecisionAnalysis(
  job: Job<DecisionAnalysisJobData>
): Promise<void> {
  const { runId } = job.data;

  console.log(`[Job ${job.id}] Processing run: ${runId}`);

  try {
    // 1. Fetch the run and decision
    const run = await prisma.decisionAnalysisRun.findUnique({
      where: { id: runId },
      include: { decision: true },
    });

    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    const decision = run.decision;
    console.log(`[Job ${job.id}] Processing decision: ${decision.id}`);

    // 2. Update run status to PROCESSING
    await prisma.decisionAnalysisRun.update({
      where: { id: runId },
      data: {
        status: "PROCESSING",
        startedAt: new Date(),
      },
    });

    // 3. Update decision status to PROCESSING (for UI compatibility)
    await prisma.decision.update({
      where: { id: decision.id },
      data: { status: "PROCESSING" },
    });

    console.log(`[Job ${job.id}] Run status updated to PROCESSING`);

    // Emit real-time event
    await publishRunUpdate(decision.id, runId, "PROCESSING");

    // 4. Generate AI analysis
    console.log(`[Job ${job.id}] Calling AI provider (${run.provider}) for analysis...`);

    const provider = getAIProvider();

    // Set context for Groq provider
    if (provider instanceof GroqProvider) {
      provider.setContext(decision.userId, runId);
    }

    const analysisData = await provider.analyze({
      situation: decision.situation,
      chosenDecision: decision.chosenDecision,
      personalReasoning: decision.personalReasoning,
    });

    console.log(`[Job ${job.id}] ✓ Analysis completed, category: ${analysisData.category}`);

    // 5. Update run with results
    await prisma.decisionAnalysisRun.update({
      where: { id: runId },
      data: {
        status: "COMPLETED",
        resultJson: {
          category: analysisData.category,
          cognitiveBiases: analysisData.cognitiveBiases,
          missedAlternatives: analysisData.missedAlternatives,
          insights: analysisData.insights,
          rawAiResponse: analysisData.rawAiResponse,
        } as any, // Cast to any to satisfy Prisma's JSON type
        // Denormalized fields for dashboard aggregations
        categoryText: analysisData.category,
        biasesText: analysisData.cognitiveBiases.map((b) => b.name),
        finishedAt: new Date(),
      },
    });

    console.log(`[Job ${job.id}] Run completed successfully`);

    // 6. Update decision status to DONE and set latestRunId
    await prisma.decision.update({
      where: { id: decision.id },
      data: {
        status: "DONE",
        latestRunId: runId,
      },
    });

    console.log(`[Job ${job.id}] ✓ Decision analysis completed successfully`);

    // Emit real-time event
    await publishRunUpdate(decision.id, runId, "COMPLETED");
  } catch (error) {
    console.error(`[Job ${job.id}] ✗ Error processing run:`, error);

    // Extract error message
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred during analysis";

    // Update run status to FAILED
    try {
      // Get the run to access decisionId
      const run = await prisma.decisionAnalysisRun.findUnique({
        where: { id: runId },
      });

      if (run) {
        // Update run with error
        await prisma.decisionAnalysisRun.update({
          where: { id: runId },
          data: {
            status: "FAILED",
            error: errorMessage,
            finishedAt: new Date(),
          },
        });

        // Update decision status to FAILED and set latestRunId
        await prisma.decision.update({
          where: { id: run.decisionId },
          data: {
            status: "FAILED",
            latestRunId: runId,
          },
        });

        console.log(`[Job ${job.id}] Run status updated to FAILED: ${errorMessage}`);

        // Emit real-time event
        await publishRunUpdate(run.decisionId, runId, "FAILED");
      }
    } catch (updateError) {
      console.error(`[Job ${job.id}] Failed to update run status to FAILED:`, updateError);
    }

    // Re-throw to mark job as failed
    throw error;
  }
}

