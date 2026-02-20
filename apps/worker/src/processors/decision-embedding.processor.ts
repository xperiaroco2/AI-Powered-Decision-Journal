import { Job } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { DecisionEmbeddingJobData } from "../config/embedding-queue";
import {
  getEmbeddingProvider,
  prepareDecisionTextForEmbedding,
} from "../services/embedding.service";

// Helper to generate CUID
function generateCuid(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).substring(2, 15)}`;
}

const prisma = new PrismaClient();

/**
 * Process Decision Embedding Job
 * 
 * Generates and stores a vector embedding for a Decision.
 * This is an independent, additive process that does NOT affect
 * the existing decision analysis pipeline.
 * 
 * Flow:
 * 1. Fetch Decision from database
 * 2. Prepare text (situation + chosenDecision + personalReasoning)
 * 3. Generate embedding via API
 * 4. Upsert DecisionEmbedding record
 * 5. Handle errors with retry support
 */
export async function processDecisionEmbedding(
  job: Job<DecisionEmbeddingJobData>
): Promise<void> {
  const { decisionId } = job.data;

  console.log(`[Embedding Job ${job.id}] Processing decision: ${decisionId}`);

  try {
    // 1. Fetch the decision
    const decision = await prisma.decision.findUnique({
      where: { id: decisionId },
      select: {
        id: true,
        situation: true,
        chosenDecision: true,
        personalReasoning: true,
      },
    });

    if (!decision) {
      throw new Error(`Decision ${decisionId} not found`);
    }

    console.log(`[Embedding Job ${job.id}] Decision found, preparing text...`);

    // 2. Prepare text for embedding
    const text = prepareDecisionTextForEmbedding(decision);

    if (!text || text.trim().length === 0) {
      throw new Error("Cannot generate embedding for empty decision text");
    }

    console.log(
      `[Embedding Job ${job.id}] Text prepared (${text.length} chars), generating embedding...`
    );

    // 3. Generate embedding
    const provider = getEmbeddingProvider();
    const embeddingVector = await provider.generateEmbedding(text);

    console.log(
      `[Embedding Job ${job.id}] ✓ Embedding generated (${embeddingVector.length} dimensions)`
    );

    // 4. Store DecisionEmbedding record (idempotent)
    // Check if embedding already exists
    const existingEmbedding = await prisma.decisionEmbedding.findUnique({
      where: { decisionId: decision.id },
    });

    if (existingEmbedding) {
      // Update existing embedding
      await prisma.$executeRaw`
        UPDATE "DecisionEmbedding"
        SET embedding = ${embeddingVector}::vector,
            status = 'COMPLETED',
            error = NULL,
            "updatedAt" = NOW()
        WHERE "decisionId" = ${decision.id}
      `;
    } else {
      // Create new embedding
      await prisma.$executeRaw`
        INSERT INTO "DecisionEmbedding" (id, "decisionId", embedding, status, "createdAt", "updatedAt")
        VALUES (${generateCuid()}, ${decision.id}, ${embeddingVector}::vector, 'COMPLETED', NOW(), NOW())
      `;
    }

    console.log(
      `[Embedding Job ${job.id}] ✓ Decision embedding stored successfully`
    );
  } catch (error) {
    console.error(`[Embedding Job ${job.id}] ✗ Error:`, error);

    // Extract error message
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Unknown error occurred during embedding generation";

    // Update DecisionEmbedding status to FAILED
    try {
      const existingEmbedding = await prisma.decisionEmbedding.findUnique({
        where: { decisionId },
      });

      if (existingEmbedding) {
        // Update existing embedding to FAILED
        await prisma.$executeRaw`
          UPDATE "DecisionEmbedding"
          SET status = 'FAILED',
              error = ${errorMessage},
              "updatedAt" = NOW()
          WHERE "decisionId" = ${decisionId}
        `;
      } else {
        // Create new embedding with FAILED status
        const placeholderVector = new Array(1536).fill(0);
        await prisma.$executeRaw`
          INSERT INTO "DecisionEmbedding" (id, "decisionId", embedding, status, error, "createdAt", "updatedAt")
          VALUES (${generateCuid()}, ${decisionId}, ${placeholderVector}::vector, 'FAILED', ${errorMessage}, NOW(), NOW())
        `;
      }

      console.log(
        `[Embedding Job ${job.id}] DecisionEmbedding status updated to FAILED: ${errorMessage}`
      );
    } catch (dbError) {
      console.error(
        `[Embedding Job ${job.id}] Failed to update DecisionEmbedding status:`,
        dbError
      );
    }

    // Re-throw to trigger BullMQ retry
    throw error;
  }
}

