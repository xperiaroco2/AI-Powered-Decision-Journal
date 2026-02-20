import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

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
      console.error('Redis connection error:', error);
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

    console.log('✓ BullMQ queues initialized');
  }

  /**
   * Enqueue an analysis run
   * From: apps/web/lib/queue.ts
   */
  async enqueueAnalysisRun(runId: string): Promise<void> {
    await this.analysisQueue.add(
      'analyze-decision',
      { runId },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600, // 1 hour
          count: 1000,
        },
        removeOnFail: {
          age: 86400, // 24 hours
        },
      },
    );

    console.log(`✓ Enqueued run ${runId} for analysis`);
  }

  /**
   * Enqueue a decision for embedding generation
   * From: apps/web/lib/embedding-queue.ts
   */
  async enqueueDecisionEmbedding(decisionId: string): Promise<void> {
    await this.embeddingQueue.add(
      'embed-decision',
      { decisionId },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600,
          count: 1000,
        },
        removeOnFail: {
          age: 86400,
        },
        jobId: `embed-decision-${decisionId}`, // De-duplicate
      },
    );

    console.log(`✓ Enqueued decision ${decisionId} for embedding`);
  }

  /**
   * Enqueue an attachment for chunking and embedding generation
   * From: apps/web/lib/attachment-queue.ts
   */
  async enqueueAttachmentEmbedding(
    attachmentId: string,
    filename?: string,
  ): Promise<void> {
    await this.attachmentQueue.add(
      'embed-attachment',
      { attachmentId, filename },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600,
          count: 1000,
        },
        removeOnFail: {
          age: 86400,
        },
        jobId: `embed-attachment-${attachmentId}`, // De-duplicate
      },
    );

    console.log(
      `✓ Enqueued attachment ${attachmentId} for chunking and embedding`,
    );
  }

  /**
   * Cleanup method - close all queues and Redis connection
   * This is called when the NestJS module is destroyed
   */
  async onModuleDestroy() {
    console.log('🧹 Closing BullMQ queues and Redis connection...');

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

      console.log('✓ BullMQ queues and Redis connection closed');
    } catch (error) {
      console.error('Error closing queues:', error);
    }
  }
}
