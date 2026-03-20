import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';
import { DecisionAnalysisJobData } from '../config/queue';
import { getAIProvider } from '../services/ai.service';
import { publishRunUpdate } from '../services/event-publisher';
import { GroqProvider } from '../services/providers/groq.provider';
import { childLogger } from '../logger';
import { extractTraceContext } from '../trace-context.helper';
import { jobsTotal, jobDurationSeconds } from '../metrics';

const log = childLogger('analysis-processor');
const tracer = trace.getTracer('worker');

// Lazy PrismaClient — delays instantiation until first use so that DATABASE_URL
// set dynamically by Testcontainers (in beforeAll) is picked up correctly.
let _prismaClient: PrismaClient | undefined;
const prisma = new Proxy({} as PrismaClient, {
  get(_: PrismaClient, prop: string | symbol) {
    if (!_prismaClient) {
      _prismaClient = new PrismaClient();
    }
    const value = (
      _prismaClient as unknown as Record<string | symbol, unknown>
    )[prop];
    return typeof value === 'function' ? value.bind(_prismaClient) : value;
  },
});

export async function processDecisionAnalysis(
  job: Job<DecisionAnalysisJobData>,
): Promise<void> {
  const { runId } = job.data;
  const QUEUE = 'decision-analysis';
  const jobStartMs = Date.now();

  // Restore the parent trace context injected by the API when the job was enqueued
  const parentCtx = extractTraceContext(
    job.data as unknown as Record<string, unknown>,
  );

  return context.with(parentCtx, () =>
    tracer.startActiveSpan(
      'worker.decision-analysis',
      { attributes: { 'job.id': job.id ?? '', 'run.id': runId } },
      async (span) => {
        log.info({ jobId: job.id, runId }, 'Processing run');

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
          log.info(
            { jobId: job.id, decisionId: decision.id },
            'Processing decision',
          );

          // 2. Update run status to PROCESSING
          await prisma.decisionAnalysisRun.update({
            where: { id: runId },
            data: {
              status: 'PROCESSING',
              startedAt: new Date(),
            },
          });

          // 3. Update decision status to PROCESSING (for UI compatibility)
          await prisma.decision.update({
            where: { id: decision.id },
            data: { status: 'PROCESSING' },
          });

          log.info({ jobId: job.id }, 'Run status updated to PROCESSING');

          await publishRunUpdate(decision.id, runId, 'PROCESSING');

          // 4. Generate AI analysis
          log.info(
            { jobId: job.id, provider: run.provider },
            'Calling AI provider for analysis',
          );

          const provider = getAIProvider();
          const providerName =
            provider instanceof GroqProvider ? 'groq' : 'mock';

          if (provider instanceof GroqProvider) {
            provider.setContext(decision.userId, runId);
          }

          const analysisData = await tracer.startActiveSpan(
            'worker.ai-provider.analyze',
            {
              attributes: {
                'ai.provider': providerName,
                'decision.id': decision.id,
                'run.id': runId,
              },
            },
            async (aiSpan) => {
              try {
                const result = await provider.analyze({
                  situation: decision.situation,
                  chosenDecision: decision.chosenDecision,
                  personalReasoning: decision.personalReasoning,
                });
                aiSpan.setAttribute('ai.category', result.category);
                aiSpan.setAttribute(
                  'ai.bias_count',
                  result.cognitiveBiases.length,
                );
                return result;
              } catch (err) {
                aiSpan.recordException(err as Error);
                aiSpan.setStatus({
                  code: SpanStatusCode.ERROR,
                  message: (err as Error).message,
                });
                throw err;
              } finally {
                aiSpan.end();
              }
            },
          );

          log.info(
            { jobId: job.id, category: analysisData.category },
            'Analysis completed',
          );

          // 5. Update run with results
          await prisma.decisionAnalysisRun.update({
            where: { id: runId },
            data: {
              status: 'COMPLETED',
              resultJson: {
                category: analysisData.category,
                cognitiveBiases: analysisData.cognitiveBiases,
                missedAlternatives: analysisData.missedAlternatives,
                insights: analysisData.insights,
                rawAiResponse: analysisData.rawAiResponse,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } as any,
              categoryText: analysisData.category,
              biasesText: analysisData.cognitiveBiases.map((b) => b.name),
              finishedAt: new Date(),
            },
          });

          log.info({ jobId: job.id }, 'Run completed successfully');

          // 6. Update decision status to DONE and set latestRunId
          await prisma.decision.update({
            where: { id: decision.id },
            data: {
              status: 'DONE',
              latestRunId: runId,
            },
          });

          log.info(
            { jobId: job.id },
            'Decision analysis completed successfully',
          );

          jobsTotal.inc({ queue: QUEUE, status: 'success' });
          jobDurationSeconds.observe(
            { queue: QUEUE },
            (Date.now() - jobStartMs) / 1000,
          );

          await publishRunUpdate(decision.id, runId, 'COMPLETED');
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (error as Error).message,
          });

          jobsTotal.inc({ queue: QUEUE, status: 'failed' });
          jobDurationSeconds.observe(
            { queue: QUEUE },
            (Date.now() - jobStartMs) / 1000,
          );

          log.error({ jobId: job.id, err: error }, 'Error processing run');

          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Unknown error occurred during analysis';

          try {
            const run = await prisma.decisionAnalysisRun.findUnique({
              where: { id: runId },
            });

            if (run) {
              await prisma.decisionAnalysisRun.update({
                where: { id: runId },
                data: {
                  status: 'FAILED',
                  error: errorMessage,
                  finishedAt: new Date(),
                },
              });

              await prisma.decision.update({
                where: { id: run.decisionId },
                data: {
                  status: 'FAILED',
                  latestRunId: runId,
                },
              });

              log.info(
                { jobId: job.id, errorMessage },
                'Run status updated to FAILED',
              );

              await publishRunUpdate(run.decisionId, runId, 'FAILED');
            }
          } catch (updateError) {
            log.error(
              { jobId: job.id, err: updateError },
              'Failed to update run status to FAILED',
            );
          }

          throw error;
        } finally {
          span.end();
        }
      },
    ),
  );
}
