import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { injectTraceContext } from '../observability/trace-context.helper';
import {
  queueEnqueueTotal,
  queueEnqueueDuration,
} from '../observability/metrics';

/**
 * Queue Service
 *
 * Manages BullMQ queues for async job processing.
 * Merges 3 queue files from Next.js:
 * - lib/queue.ts (decision-analysis)
 * - lib/embedding-queue.ts (decision-embedding)
 * - lib/attachment-queue.ts (attachment-embedding)
 */
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly tracer = trace.getTracer('api');
  private redisConnection: Redis;
  private analysisQueue: Queue;
  private embeddingQueue: Queue;
  private attachmentQueue: Queue;

  // Queue names - MUST match worker
  private readonly ANALYSIS_QUEUE_NAME = 'decision-analysis';
  private readonly EMBEDDING_QUEUE_NAME = 'decision-embedding';
  private readonly ATTACHMENT_QUEUE_NAME = 'attachment-embedding';

  onModuleInit() {
    // Initialize Redis connection
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_URL environment variable is not set');
    }

    const isTLS = redisUrl.startsWith('rediss://');
    this.redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
      tls: isTLS ? { rejectUnauthorized: false } : undefined,
    });

    this.redisConnection.on('error', (error) => {
      this.logger.error('Redis connection error', error);
    });

    // Initialize queues
    this.analysisQueue = new Queue(this.ANALYSIS_QUEUE_NAME, {
      connection: this.redisConnection,
    });

    this.embeddingQueue = new Queue(this.EMBEDDING_QUEUE_NAME, {
      connection: this.redisConnection,
    });

    this.attachmentQueue = new Queue(this.ATTACHMENT_QUEUE_NAME, {
      connection: this.redisConnection,
    });

    this.logger.log('BullMQ queues initialized');
  }

  /**
   * Enqueue an analysis run
   * From: apps/web/lib/queue.ts
   */
  async enqueueAnalysisRun(runId: string): Promise<void> {
    await this.tracer.startActiveSpan(
      'queue.enqueue',
      {
        attributes: {
          'queue.name': this.ANALYSIS_QUEUE_NAME,
          'messaging.system': 'bullmq',
          'messaging.operation': 'publish',
          'run.id': runId,
        },
      },
      async (span) => {
        const startMs = Date.now();
        try {
          // injectTraceContext propagates W3C traceparent so the worker can
          // continue the trace as a child span.
          await this.analysisQueue.add(
            'analyze-decision',
            injectTraceContext({ runId }),
            {
              attempts: 3,
              backoff: { type: 'exponential', delay: 2000 },
              removeOnComplete: { age: 3600, count: 1000 },
              removeOnFail: { age: 86400 },
            },
          );
          queueEnqueueTotal.add(1, {
            queue: this.ANALYSIS_QUEUE_NAME,
            status: 'success',
          });
          queueEnqueueDuration.record((Date.now() - startMs) / 1000, {
            queue: this.ANALYSIS_QUEUE_NAME,
          });
          this.logger.log(`Enqueued run ${runId} for analysis`);
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (error as Error).message,
          });
          queueEnqueueTotal.add(1, {
            queue: this.ANALYSIS_QUEUE_NAME,
            status: 'failure',
          });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Enqueue a decision for embedding generation
   * From: apps/web/lib/embedding-queue.ts
   */
  async enqueueDecisionEmbedding(decisionId: string): Promise<void> {
    await this.tracer.startActiveSpan(
      'queue.enqueue',
      {
        attributes: {
          'queue.name': this.EMBEDDING_QUEUE_NAME,
          'messaging.system': 'bullmq',
          'messaging.operation': 'publish',
          'decision.id': decisionId,
        },
      },
      async (span) => {
        const startMs = Date.now();
        try {
          await this.embeddingQueue.add(
            'embed-decision',
            injectTraceContext({ decisionId }),
            {
              attempts: 3,
              backoff: { type: 'exponential', delay: 2000 },
              removeOnComplete: { age: 3600, count: 1000 },
              removeOnFail: { age: 86400 },
              jobId: `embed-decision-${decisionId}`, // De-duplicate
            },
          );
          queueEnqueueTotal.add(1, {
            queue: this.EMBEDDING_QUEUE_NAME,
            status: 'success',
          });
          queueEnqueueDuration.record((Date.now() - startMs) / 1000, {
            queue: this.EMBEDDING_QUEUE_NAME,
          });
          this.logger.log(`Enqueued decision ${decisionId} for embedding`);
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (error as Error).message,
          });
          queueEnqueueTotal.add(1, {
            queue: this.EMBEDDING_QUEUE_NAME,
            status: 'failure',
          });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Enqueue an attachment for chunking and embedding generation
   * From: apps/web/lib/attachment-queue.ts
   */
  async enqueueAttachmentEmbedding(
    attachmentId: string,
    filename?: string,
  ): Promise<void> {
    await this.tracer.startActiveSpan(
      'queue.enqueue',
      {
        attributes: {
          'queue.name': this.ATTACHMENT_QUEUE_NAME,
          'messaging.system': 'bullmq',
          'messaging.operation': 'publish',
          'attachment.id': attachmentId,
          ...(filename ? { 'attachment.filename': filename } : {}),
        },
      },
      async (span) => {
        const startMs = Date.now();
        try {
          await this.attachmentQueue.add(
            'embed-attachment',
            injectTraceContext({ attachmentId, filename }),
            {
              attempts: 3,
              backoff: { type: 'exponential', delay: 2000 },
              removeOnComplete: { age: 3600, count: 1000 },
              removeOnFail: { age: 86400 },
              jobId: `embed-attachment-${attachmentId}`, // De-duplicate
            },
          );
          queueEnqueueTotal.add(1, {
            queue: this.ATTACHMENT_QUEUE_NAME,
            status: 'success',
          });
          queueEnqueueDuration.record((Date.now() - startMs) / 1000, {
            queue: this.ATTACHMENT_QUEUE_NAME,
          });
          this.logger.log(
            `Enqueued attachment ${attachmentId} for chunking and embedding`,
          );
        } catch (error) {
          span.recordException(error as Error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: (error as Error).message,
          });
          queueEnqueueTotal.add(1, {
            queue: this.ATTACHMENT_QUEUE_NAME,
            status: 'failure',
          });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  /**
   * Cleanup method - close all queues and Redis connection
   * This is called when the NestJS module is destroyed
   */
  async onModuleDestroy() {
    this.logger.log('Closing BullMQ queues and Redis connection');

    try {
      // Close all queues
      if (this.analysisQueue) {
        await this.analysisQueue.close();
      }
      if (this.embeddingQueue) {
        await this.embeddingQueue.close();
      }
      if (this.attachmentQueue) {
        await this.attachmentQueue.close();
      }

      // Close Redis connection
      if (this.redisConnection) {
        await this.redisConnection.quit();
      }

      this.logger.log('BullMQ queues and Redis connection closed');
    } catch (error) {
      this.logger.error('Error closing queues', error);
    }
  }
}
