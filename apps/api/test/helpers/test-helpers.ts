/**
 * Integration Test Helpers
 *
 * Utility functions for integration tests.
 * These helpers use environment variables (DATABASE_URL, REDIS_URL) that are
 * automatically set by Testcontainers in setup-integration.ts.
 */

import { PrismaClient } from '@prisma/client';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import cookieParser from 'cookie-parser';

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
 * Create a NestJS test application
 * This creates a full NestJS app with all modules loaded
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();

  // Enable cookie parser
  app.use(cookieParser());

  // Enable global validation pipe (same as main.ts)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      transform: true, // Transform payloads to DTO instances
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties exist
    }),
  );

  await app.init();

  return app;
}

/**
 * Extract access token from login response
 */
export function extractAccessToken(response: any): string {
  return response.body.accessToken;
}

/**
 * Extract refresh token from cookies
 */
export function extractRefreshToken(response: any): string {
  const cookies = response.headers['set-cookie'];
  if (!cookies) {
    throw new Error('No cookies in response');
  }

  const refreshTokenCookie = cookies.find((cookie: string) =>
    cookie.startsWith('refreshToken='),
  );

  if (!refreshTokenCookie) {
    throw new Error('No refreshToken cookie in response');
  }

  const match = refreshTokenCookie.match(/refreshToken=([^;]+)/);
  if (!match) {
    throw new Error('Could not extract refreshToken from cookie');
  }

  return match[1];
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
