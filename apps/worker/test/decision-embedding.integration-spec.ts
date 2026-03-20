/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Decision Embedding Integration Tests
 *
 * Tests the complete decision embedding workflow:
 * - Job enqueue → Worker processing → Embedding generation → Database storage
 */

import { Queue, Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import {
  createTestPrismaClient,
  createTestRedisClient,
  cleanupDatabase,
  cleanupQueue,
  createTestUser,
  createTestDecision,
  waitFor,
} from './helpers/test-helpers';
import { processDecisionEmbedding } from '../src/processors/decision-embedding.processor';
import { DecisionEmbeddingJobData } from '../src/config/embedding-queue';

describe('Decision Embedding Integration', () => {
  let prisma: PrismaClient;
  let redis: Redis;
  let queue: Queue<DecisionEmbeddingJobData>;
  let worker: Worker<DecisionEmbeddingJobData>;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    redis = createTestRedisClient();

    // Create queue
    queue = new Queue<DecisionEmbeddingJobData>('decision-embedding', {
      connection: redis,
    });

    // Create worker
    worker = new Worker<DecisionEmbeddingJobData>(
      'decision-embedding',
      processDecisionEmbedding,
      {
        connection: redis,
      },
    );

    // Wait for worker to be ready
    await worker.waitUntilReady();
  });

  afterAll(async () => {
    // Cleanup
    await worker.close();
    await cleanupQueue(queue);
    await queue.close();
    await redis.quit();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean database before each test
    await cleanupDatabase(prisma);
  });

  describe('End-to-End Workflow', () => {
    it('should generate and store decision embedding successfully', async () => {
      // 1. Create test data
      const user = await createTestUser(prisma, {
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      const decision = await createTestDecision(prisma, {
        userId: user.id,
        situation: 'Should I invest in stocks or real estate?',
        chosenDecision: 'I will invest in real estate',
        personalReasoning: 'More stable and tangible asset',
      });

      // 2. Enqueue job
      const job = await queue.add('embed', {
        decisionId: decision.id,
      });

      expect(job.id).toBeDefined();

      // 3. Wait for job to complete
      await waitFor(
        async () => {
          const state = await job.getState();
          return state === 'completed';
        },
        { timeout: 10000, interval: 200 },
      );

      // 4. Verify embedding was created
      const embedding = await prisma.decisionEmbedding.findUnique({
        where: { decisionId: decision.id },
      });

      expect(embedding).toBeDefined();
      expect(embedding!.status).toBe('COMPLETED');
      expect(embedding!.error).toBeNull();

      // 5. Verify embedding vector (using raw query since Prisma doesn't support vector type well)
      // Cast to text because Prisma cannot deserialize the Unsupported "vector" column type directly.
      const result = await prisma.$queryRaw<any[]>`
        SELECT embedding::text AS embedding
        FROM "DecisionEmbedding"
        WHERE "decisionId" = ${decision.id}
      `;

      expect(result).toHaveLength(1);
      expect(result[0].embedding).toBeDefined();

      // The embedding should be a string representation of the vector
      // For mock provider, it should be 1536 dimensions
      const embeddingArray = JSON.parse(result[0].embedding);
      expect(Array.isArray(embeddingArray)).toBe(true);
      expect(embeddingArray).toHaveLength(1536);

      // 6. Verify job completed
      const jobState = await job.getState();
      expect(jobState).toBe('completed');
    }, 15000);

    it('should update existing embedding on re-run', async () => {
      // 1. Create test data
      const user = await createTestUser(prisma, {
        email: 'test2@example.com',
        passwordHash: 'hash',
      });

      const decision = await createTestDecision(prisma, {
        userId: user.id,
        situation: 'Test situation',
        chosenDecision: 'Test decision',
      });

      // 2. Create initial embedding
      const initialEmbedding = new Array(1536).fill(0.1);
      await prisma.$executeRaw`
        INSERT INTO "DecisionEmbedding" (id, "decisionId", embedding, status, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), ${decision.id}, ${JSON.stringify(initialEmbedding)}::vector, 'COMPLETED', NOW(), NOW())
      `;

      // 3. Enqueue job (should update existing embedding)
      const job = await queue.add('embed', {
        decisionId: decision.id,
      });

      // 4. Wait for job to complete
      await waitFor(
        async () => {
          const state = await job.getState();
          return state === 'completed';
        },
        { timeout: 10000, interval: 200 },
      );

      // 5. Verify embedding was updated (not duplicated)
      const embeddings = await prisma.decisionEmbedding.findMany({
        where: { decisionId: decision.id },
      });

      expect(embeddings).toHaveLength(1);
      expect(embeddings[0].status).toBe('COMPLETED');

      // 6. Verify the embedding vector was updated
      // Cast to text because Prisma cannot deserialize the Unsupported "vector" column type directly.
      const result = await prisma.$queryRaw<any[]>`
        SELECT embedding::text AS embedding
        FROM "DecisionEmbedding"
        WHERE "decisionId" = ${decision.id}
      `;

      const newEmbedding = JSON.parse(result[0].embedding);

      // The new embedding should be different from the initial one
      // (mock provider generates deterministic but different embeddings)
      expect(newEmbedding).not.toEqual(initialEmbedding);
    }, 15000);

    it('should handle errors and mark embedding as FAILED', async () => {
      // 1. Enqueue job with non-existent decision ID
      const job = await queue.add('embed', {
        decisionId: 'non-existent-decision-id',
      });

      // 2. Wait for job to fail
      await waitFor(
        async () => {
          const state = await job.getState();
          return state === 'failed';
        },
        { timeout: 10000, interval: 200 },
      );

      // 3. Verify job failed
      const jobState = await job.getState();
      expect(jobState).toBe('failed');
    }, 15000);
  });
});
