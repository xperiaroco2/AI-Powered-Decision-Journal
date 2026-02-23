/**
 * Testcontainers Setup for Worker Tests
 *
 * This module manages the lifecycle of PostgreSQL and Redis containers for integration tests.
 * Containers are started once before all tests and stopped after all tests complete.
 */

import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { execSync } from 'child_process';
import * as path from 'path';

// Global container instances
let postgresContainer: StartedPostgreSqlContainer | null = null;
let redisContainer: StartedRedisContainer | null = null;

// Environment variables to be used by tests
export let testDatabaseUrl: string = '';
export let testRedisUrl: string = '';

/**
 * Start PostgreSQL and Redis containers
 * This is called once before all integration tests
 */
export async function startContainers(): Promise<void> {
  console.log('🐳 Starting Testcontainers...');

  try {
    // Start PostgreSQL container with pgvector extension
    console.log('  📦 Starting PostgreSQL container...');
    postgresContainer = await new PostgreSqlContainer('pgvector/pgvector:pg16')
      .withDatabase('test_db')
      .withUsername('test_user')
      .withPassword('test_password')
      .withExposedPorts(5432)
      .start();

    // Build DATABASE_URL
    testDatabaseUrl = `postgresql://${postgresContainer.getUsername()}:${postgresContainer.getPassword()}@${postgresContainer.getHost()}:${postgresContainer.getPort()}/${postgresContainer.getDatabase()}`;

    console.log(
      `  ✓ PostgreSQL started at ${postgresContainer.getHost()}:${postgresContainer.getPort()}`,
    );

    // Enable pgvector extension
    console.log('  📦 Enabling pgvector extension...');
    await postgresContainer.exec([
      'psql',
      '-U',
      postgresContainer.getUsername(),
      '-d',
      postgresContainer.getDatabase(),
      '-c',
      'CREATE EXTENSION IF NOT EXISTS vector;',
    ]);
    console.log('  ✓ pgvector extension enabled');

    // Start Redis container
    console.log('  📦 Starting Redis container...');
    redisContainer = await new RedisContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .start();

    // Build REDIS_URL
    testRedisUrl = `redis://${redisContainer.getHost()}:${redisContainer.getPort()}`;

    console.log(
      `  ✓ Redis started at ${redisContainer.getHost()}:${redisContainer.getPort()}`,
    );

    // Push Prisma schema to database (no migrations needed)
    console.log('  📦 Pushing Prisma schema to database...');
    const prismaSchemaPath = path.resolve(__dirname, '../../../prisma/schema.prisma');

    try {
      execSync(
        `npx prisma db push --skip-generate --accept-data-loss --schema="${prismaSchemaPath}"`,
        {
          env: {
            ...process.env,
            DATABASE_URL: testDatabaseUrl,
          },
          stdio: 'pipe',
        },
      );
      console.log('  ✓ Prisma schema pushed successfully');
    } catch (error) {
      console.error('  ✗ Failed to push Prisma schema:', error);
      throw error;
    }

    // Set environment variables for tests
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.REDIS_URL = testRedisUrl;
    process.env.AI_PROVIDER = 'mock';
    process.env.EMBEDDING_PROVIDER = 'mock';
    process.env.NODE_ENV = 'test';

    console.log('✅ Testcontainers started successfully!\n');
  } catch (error) {
    console.error('❌ Failed to start Testcontainers:', error);
    await stopContainers();
    throw error;
  }
}

/**
 * Stop PostgreSQL and Redis containers
 * This is called once after all integration tests complete
 */
export async function stopContainers(): Promise<void> {
  console.log('\n🐳 Stopping Testcontainers...');

  try {
    if (postgresContainer) {
      console.log('  📦 Stopping PostgreSQL container...');
      await postgresContainer.stop();
      console.log('  ✓ PostgreSQL stopped');
      postgresContainer = null;
    }

    if (redisContainer) {
      console.log('  📦 Stopping Redis container...');
      await redisContainer.stop();
      console.log('  ✓ Redis stopped');
      redisContainer = null;
    }

    console.log('✅ Testcontainers stopped successfully!\n');
  } catch (error) {
    console.error('❌ Failed to stop Testcontainers:', error);
    throw error;
  }
}

/**
 * Get the PostgreSQL container instance
 */
export function getPostgresContainer(): StartedPostgreSqlContainer | null {
  return postgresContainer;
}

/**
 * Get the Redis container instance
 */
export function getRedisContainer(): StartedRedisContainer | null {
  return redisContainer;
}

