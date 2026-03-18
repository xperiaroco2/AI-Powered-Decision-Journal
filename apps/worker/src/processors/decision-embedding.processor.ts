import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';
import { DecisionEmbeddingJobData } from '../config/embedding-queue';
import {
  getEmbeddingProvider,
  prepareDecisionTextForEmbedding,
} from '../services/embedding.service';
import { childLogger } from '../logger';
import { extractTraceContext } from '../trace-context.helper';
import { jobsTotal, jobDurationSeconds } from '../metrics';

const log = childLogger('embedding-processor');
const tracer = trace.getTracer('worker');

// Helper to generate CUID
function generateCuid(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).substring(2, 15)}`;
}

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

export async function processDecisionEmbedding(
  job: Job<DecisionEmbeddingJobData>,
): Promise<void> {
  const { decisionId } = job.data;
  const QUEUE = 'decision-embedding';
  const jobStartMs = Date.now();

  const parentCtx = extractTraceContext(
    job.data as unknown as Record<string, unknown>,
  );

  return context.with(parentCtx, () =>
    tracer.startActiveSpan(
      'worker.decision-embedding',
      { attributes: { 'job.id': job.id ?? '', 'decision.id': decisionId } },
      async (span) => {
        log.info({ jobId: job.id, decisionId }, 'Processing decision');

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

          log.info({ jobId: job.id }, 'Decision found, preparing text');

          // 2. Prepare text for embedding
          const text = prepareDecisionTextForEmbedding(decision);

          if (!text || text.trim().length === 0) {
            throw new Error(
              'Cannot generate embedding for empty decision text',
            );
          }

          log.info(
            { jobId: job.id, textLength: text.length },
            'Text prepared, generating embedding',
          );

          // 3. Generate embedding
          const provider = getEmbeddingProvider();
          const embeddingVector = await tracer.startActiveSpan(
            'worker.embedding.generate',
            {
              attributes: {
                'embedding.provider': provider.getModelName(),
                'embedding.text_length': text.length,
                'decision.id': decisionId,
              },
            },
            async (embSpan) => {
              try {
                const vec = await provider.generateEmbedding(text);
                embSpan.setAttribute('embedding.dimensions', vec.length);
                return vec;
              } catch (err) {
                embSpan.recordException(err as Error);
                embSpan.setStatus({
                  code: SpanStatusCode.ERROR,
                  message: (err as Error).message,
                });
                throw err;
              } finally {
                embSpan.end();
              }
            },
          );

          log.info(
            { jobId: job.id, dimensions: embeddingVector.length },
            'Embedding generated',
          );

          // 4. Store DecisionEmbedding record (idempotent)
          const existingEmbedding = await prisma.decisionEmbedding.findUnique({
            where: { decisionId: decision.id },
          });

          if (existingEmbedding) {
            await prisma.$executeRaw`
              UPDATE "DecisionEmbedding"
              SET embedding = ${embeddingVector}::vector,
                  status = 'COMPLETED',
                  error = NULL,
                  "updatedAt" = NOW()
              WHERE "decisionId" = ${decision.id}
            `;
          } else {
            await prisma.$executeRaw`
              INSERT INTO "DecisionEmbedding" (id, "decisionId", embedding, status, "createdAt", "updatedAt")
              VALUES (${generateCuid()}, ${decision.id}, ${embeddingVector}::vector, 'COMPLETED', NOW(), NOW())
            `;
          }

          log.info({ jobId: job.id }, 'Decision embedding stored successfully');

          jobsTotal.inc({ queue: QUEUE, status: 'success' });
          jobDurationSeconds.observe(
            { queue: QUEUE },
            (Date.now() - jobStartMs) / 1000,
          );
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

          log.error({ jobId: job.id, err: error }, 'Error');

          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Unknown error occurred during embedding generation';

          try {
            const existingEmbedding = await prisma.decisionEmbedding.findUnique(
              {
                where: { decisionId },
              },
            );

            if (existingEmbedding) {
              await prisma.$executeRaw`
                UPDATE "DecisionEmbedding"
                SET status = 'FAILED',
                    error = ${errorMessage},
                    "updatedAt" = NOW()
                WHERE "decisionId" = ${decisionId}
              `;
            } else {
              const placeholderVector = new Array(1536).fill(0);
              await prisma.$executeRaw`
                INSERT INTO "DecisionEmbedding" (id, "decisionId", embedding, status, error, "createdAt", "updatedAt")
                VALUES (${generateCuid()}, ${decisionId}, ${placeholderVector}::vector, 'FAILED', ${errorMessage}, NOW(), NOW())
              `;
            }

            log.info(
              { jobId: job.id, errorMessage },
              'DecisionEmbedding status updated to FAILED',
            );
          } catch (dbError) {
            log.error(
              { jobId: job.id, err: dbError },
              'Failed to update DecisionEmbedding status',
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
