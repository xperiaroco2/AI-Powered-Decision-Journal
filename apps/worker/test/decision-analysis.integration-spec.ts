/**
 * Decision Analysis Integration Tests
 *
 * Tests the complete decision analysis workflow:
 * - Job enqueue → Worker processing → Database updates → Event publishing
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
  createTestAnalysisRun,
  waitFor,
} from './helpers/test-helpers';
import { processDecisionAnalysis } from '../src/processors/decision-analysis.processor';
import { DecisionAnalysisJobData } from '../src/config/queue';

describe('Decision Analysis Integration', () => {
  let prisma: PrismaClient;
  let redis: Redis;
  let queue: Queue<DecisionAnalysisJobData>;
  let worker: Worker<DecisionAnalysisJobData>;

  beforeAll(async () => {
    prisma = createTestPrismaClient();
    redis = createTestRedisClient();

    // Create queue
    queue = new Queue<DecisionAnalysisJobData>('decision-analysis', {
      connection: redis,
    });

    // Create worker
    worker = new Worker<DecisionAnalysisJobData>(
      'decision-analysis',
      processDecisionAnalysis,
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
    it('should process decision analysis job successfully', async () => {
      // 1. Create test data
      const user = await createTestUser(prisma, {
        email: 'test@example.com',
        passwordHash: 'hash',
        name: 'Test User',
      });

      const decision = await createTestDecision(prisma, {
        userId: user.id,
        situation: 'Should I switch to a new job?',
        chosenDecision: 'Yes, I will accept the offer',
        personalReasoning: 'Better salary and work-life balance',
      });

      const run = await createTestAnalysisRun(prisma, {
        decisionId: decision.id,
        provider: 'mock',
        status: 'PENDING',
      });

      // 2. Enqueue job
      const job = await queue.add('analyze', {
        runId: run.id,
      });

      expect(job.id).toBeDefined();

      // 3. Wait for job to complete
      await waitFor(
        async () => {
          const updatedRun = await prisma.decisionAnalysisRun.findUnique({
            where: { id: run.id },
          });
          return updatedRun?.status === 'COMPLETED';
        },
        { timeout: 10000, interval: 200 },
      );

      // 4. Verify run was updated
      const completedRun = await prisma.decisionAnalysisRun.findUnique({
        where: { id: run.id },
      });

      expect(completedRun).toBeDefined();
      expect(completedRun!.status).toBe('COMPLETED');
      expect(completedRun!.resultJson).toBeDefined();
      expect(completedRun!.categoryText).toBeDefined();
      expect(completedRun!.biasesText).toBeDefined();
      expect(completedRun!.finishedAt).toBeDefined();

      // Verify result structure
      const result = completedRun!.resultJson as any;
      expect(result.category).toBeDefined();
      expect(Array.isArray(result.cognitiveBiases)).toBe(true);
      expect(Array.isArray(result.missedAlternatives)).toBe(true);
      expect(Array.isArray(result.insights)).toBe(true);
      expect(result.rawAiResponse).toBeDefined();

      // 5. Verify decision was updated
      const updatedDecision = await prisma.decision.findUnique({
        where: { id: decision.id },
      });

      expect(updatedDecision!.status).toBe('DONE');
      expect(updatedDecision!.latestRunId).toBe(run.id);

      // 6. Verify job completed
      const jobState = await job.getState();
      expect(jobState).toBe('completed');
    }, 15000); // Increase timeout for integration test

    it('should handle analysis errors gracefully', async () => {
      // 1. Create test data with invalid run ID
      const user = await createTestUser(prisma, {
        email: 'test2@example.com',
        passwordHash: 'hash',
      });

      const decision = await createTestDecision(prisma, {
        userId: user.id,
        situation: 'Test',
        chosenDecision: 'Test',
      });

      // 2. Enqueue job with non-existent run ID
      const job = await queue.add('analyze', {
        runId: 'non-existent-run-id',
      });

      // 3. Wait for job to fail
      await waitFor(
        async () => {
          const state = await job.getState();
          return state === 'failed';
        },
        { timeout: 10000, interval: 200 },
      );

      // 4. Verify job failed
      const jobState = await job.getState();
      expect(jobState).toBe('failed');
    }, 15000);
  });

  describe('Real-time Events', () => {
    it('should publish events during processing', async () => {
      // Setup event listener
      const events: any[] = [];
      const subscriber = createTestRedisClient();

      await subscriber.subscribe('decision-events');
      subscriber.on('message', (channel, message) => {
        if (channel === 'decision-events') {
          events.push(JSON.parse(message));
        }
      });

      // Create test data
      const user = await createTestUser(prisma, {
        email: 'test3@example.com',
        passwordHash: 'hash',
      });

      const decision = await createTestDecision(prisma, {
        userId: user.id,
        situation: 'Test',
        chosenDecision: 'Test',
      });

      const run = await createTestAnalysisRun(prisma, {
        decisionId: decision.id,
      });

      // Enqueue job
      await queue.add('analyze', { runId: run.id });

      // Wait for completion
      await waitFor(
        async () => {
          const updatedRun = await prisma.decisionAnalysisRun.findUnique({
            where: { id: run.id },
          });
          return updatedRun?.status === 'COMPLETED';
        },
        { timeout: 10000, interval: 200 },
      );

      // Wait a bit for events to be published
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify events were published
      expect(events.length).toBeGreaterThanOrEqual(2); // PROCESSING and COMPLETED

      const processingEvent = events.find((e) => e.status === 'PROCESSING');
      const completedEvent = events.find((e) => e.status === 'COMPLETED');

      expect(processingEvent).toBeDefined();
      expect(processingEvent.type).toBe('decision:update');
      expect(processingEvent.decisionId).toBe(decision.id);
      expect(processingEvent.runId).toBe(run.id);

      expect(completedEvent).toBeDefined();
      expect(completedEvent.type).toBe('decision:update');
      expect(completedEvent.decisionId).toBe(decision.id);
      expect(completedEvent.runId).toBe(run.id);

      // Cleanup
      await subscriber.quit();
    }, 15000);
  });
});

