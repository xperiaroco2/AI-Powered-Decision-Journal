/**
 * Worker Integration Test Helpers
 *
 * Utility functions for worker integration tests.
 * These helpers use environment variables (DATABASE_URL, REDIS_URL) that are
 * automatically set by Testcontainers in setup-integration.ts.
 */

import { PrismaClient, AnalysisRunStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

/**
 * Create a test Prisma client connected to the test database
 * Uses DATABASE_URL from Testcontainers
 */
export function createTestPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });
}

/**
 * Create a test Redis client
 * Uses REDIS_URL from Testcontainers
 */
export function createTestRedisClient(): Redis {
  return new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

/**
 * Clean up all data from the test database
 * This should be called before/after each test suite
 */
export async function cleanupDatabase(prisma: PrismaClient): Promise<void> {
  // Delete in order to respect foreign key constraints
  await prisma.attachmentChunkEmbedding.deleteMany();
  await prisma.attachmentChunk.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.decisionEmbedding.deleteMany();
  await prisma.decisionAnalysisRun.deleteMany();
  await prisma.decision.deleteMany();
  await prisma.user.deleteMany();
}

/**
 * Clean up all jobs from a BullMQ queue
 */
export async function cleanupQueue(queue: Queue): Promise<void> {
  await queue.obliterate({ force: true });
}

/**
 * Create a test user
 */
export async function createTestUser(
  prisma: PrismaClient,
  data: {
    email: string;
    passwordHash: string;
    name?: string;
  },
) {
  return prisma.user.create({
    data: {
      email: data.email,
      passwordHash: data.passwordHash,
      name: data.name || null,
    },
  });
}

/**
 * Create a test decision
 */
export async function createTestDecision(
  prisma: PrismaClient,
  data: {
    userId: string;
    situation: string;
    chosenDecision: string;
    personalReasoning?: string;
  },
) {
  return prisma.decision.create({
    data: {
      userId: data.userId,
      situation: data.situation,
      chosenDecision: data.chosenDecision,
      personalReasoning: data.personalReasoning || null,
    },
  });
}

/**
 * Create a test decision analysis run
 */
export async function createTestAnalysisRun(
  prisma: PrismaClient,
  data: {
    decisionId: string;
    provider?: string;
    status?: AnalysisRunStatus;
  },
) {
  return prisma.decisionAnalysisRun.create({
    data: {
      decisionId: data.decisionId,
      provider: data.provider || 'mock',
      status: data.status ?? AnalysisRunStatus.PENDING,
    },
  });
}

/**
 * Create a test attachment
 */
export async function createTestAttachment(
  prisma: PrismaClient,
  data: {
    userId: string;
    decisionId: string;
    title: string;
    content: string;
  },
) {
  return prisma.attachment.create({
    data: {
      userId: data.userId,
      decisionId: data.decisionId,
      title: data.title,
      content: data.content,
      status: 'PENDING',
    },
  });
}

/**
 * Wait for a condition to be true
 * Useful for waiting for async operations like queue processing
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
  } = {},
): Promise<void> {
  const timeout = options.timeout || 10000;
  const interval = options.interval || 100;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error('Timeout waiting for condition');
}
