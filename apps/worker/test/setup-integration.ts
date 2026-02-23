/**
 * Integration Test Setup for Worker
 *
 * This file runs before all integration tests.
 * It starts Testcontainers (PostgreSQL and Redis) and sets up global test configuration.
 */

import { startContainers, stopContainers } from './testcontainers-setup';

// Set test timeout globally (increased for container startup)
jest.setTimeout(120000); // 2 minutes for container startup

/**
 * Global setup - runs once before all test suites
 */
beforeAll(async () => {
  console.log('🧪 Setting up Worker Integration Test Environment...\n');

  // Start Testcontainers (PostgreSQL and Redis)
  await startContainers();

  // Log test environment
  console.log('📋 Test Environment Variables:');
  console.log(`  DATABASE_URL: ${process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`  REDIS_URL: ${process.env.REDIS_URL}`);
  console.log(`  AI_PROVIDER: ${process.env.AI_PROVIDER}`);
  console.log(`  EMBEDDING_PROVIDER: ${process.env.EMBEDDING_PROVIDER}`);
  console.log('');
});

/**
 * Global teardown - runs once after all test suites
 */
afterAll(async () => {
  // Stop Testcontainers
  await stopContainers();
});

