/**
 * Playwright Global Teardown
 * 
 * This runs once after all E2E tests.
 * It stops Testcontainers and cleans up.
 */

import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('\n🧹 Cleaning up E2E test infrastructure...\n');

  // Stop servers
  const apiProcess = (global as any).__API_PROCESS__;
  const webProcess = (global as any).__WEB_PROCESS__;

  if (apiProcess) {
    console.log('🛑 Stopping API server...');
    apiProcess.kill('SIGTERM');
    console.log('✓ API server stopped');
  }

  if (webProcess) {
    console.log('🛑 Stopping Web server...');
    webProcess.kill('SIGTERM');
    console.log('✓ Web server stopped');
  }

  // Stop containers
  const postgresContainer = (global as any).__POSTGRES_CONTAINER__;
  const redisContainer = (global as any).__REDIS_CONTAINER__;

  if (postgresContainer) {
    console.log('Stopping PostgreSQL container...');
    await postgresContainer.stop();
    console.log('✓ PostgreSQL stopped');
  }

  if (redisContainer) {
    console.log('Stopping Redis container...');
    await redisContainer.stop();
    console.log('✓ Redis stopped');
  }

  // Clean up test env file
  const envFile = path.join(__dirname, '.test-env.json');
  if (fs.existsSync(envFile)) {
    fs.unlinkSync(envFile);
    console.log('✓ Test environment file removed');
  }

  console.log('\n✅ E2E test infrastructure cleaned up!\n');
}

export default globalTeardown;

