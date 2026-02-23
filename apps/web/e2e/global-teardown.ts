/**
 * Playwright Global Teardown
 *
 * This runs once after all E2E tests.
 * It stops Testcontainers and cleans up.
 *
 * IMPORTANT: Playwright runs teardown in a separate process from setup,
 * so we cannot rely on global variables. Instead, we read process PIDs
 * from the .test-env.json file and use Docker commands to stop containers.
 */

import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('\n🧹 Cleaning up E2E test infrastructure...\n');

  const envFile = path.join(__dirname, '.test-env.json');

  // Read test environment file if it exists
  let testEnv: any = null;
  if (fs.existsSync(envFile)) {
    try {
      testEnv = JSON.parse(fs.readFileSync(envFile, 'utf-8'));
    } catch (error) {
      console.error('Failed to read test environment file:', error);
    }
  }

  // Stop API server process
  if (testEnv?.API_PROCESS_PID) {
    try {
      console.log(`🛑 Stopping API server (PID: ${testEnv.API_PROCESS_PID})...`);

      // On Windows, use taskkill; on Unix, use kill
      if (process.platform === 'win32') {
        execSync(`taskkill /F /T /PID ${testEnv.API_PROCESS_PID}`, { stdio: 'ignore' });
      } else {
        execSync(`kill -TERM ${testEnv.API_PROCESS_PID}`, { stdio: 'ignore' });
      }

      console.log('✓ API server stopped');
    } catch (error) {
      console.log('⚠ API server may have already stopped or failed to stop');
    }
  }

  // Stop Worker process
  if (testEnv?.WORKER_PROCESS_PID) {
    try {
      console.log(`🛑 Stopping Worker process (PID: ${testEnv.WORKER_PROCESS_PID})...`);

      // On Windows, use taskkill; on Unix, use kill
      if (process.platform === 'win32') {
        execSync(`taskkill /F /T /PID ${testEnv.WORKER_PROCESS_PID}`, { stdio: 'ignore' });
      } else {
        execSync(`kill -TERM ${testEnv.WORKER_PROCESS_PID}`, { stdio: 'ignore' });
      }

      console.log('✓ Worker process stopped');
    } catch (error) {
      console.log('⚠ Worker process may have already stopped or failed to stop');
    }
  }

  // Stop Web server process
  if (testEnv?.WEB_PROCESS_PID) {
    try {
      console.log(`🛑 Stopping Web server (PID: ${testEnv.WEB_PROCESS_PID})...`);

      // On Windows, use taskkill; on Unix, use kill
      if (process.platform === 'win32') {
        execSync(`taskkill /F /T /PID ${testEnv.WEB_PROCESS_PID}`, { stdio: 'ignore' });
      } else {
        execSync(`kill -TERM ${testEnv.WEB_PROCESS_PID}`, { stdio: 'ignore' });
      }

      console.log('✓ Web server stopped');
    } catch (error) {
      console.log('⚠ Web server may have already stopped or failed to stop');
    }
  }

  // Stop Docker containers using docker CLI
  // Testcontainers creates containers with specific labels, we'll stop all containers
  // that were created by this test run
  try {
    console.log('🛑 Stopping Docker containers...');

    // Get all running containers created by Testcontainers
    const containers = execSync(
      'docker ps -q --filter "label=org.testcontainers=true"',
      { encoding: 'utf-8' }
    ).trim();

    if (containers) {
      const containerIds = containers.split('\n').filter(id => id.length > 0);

      for (const containerId of containerIds) {
        try {
          console.log(`  Stopping container ${containerId}...`);
          execSync(`docker stop ${containerId}`, { stdio: 'ignore', timeout: 10000 });
          execSync(`docker rm ${containerId}`, { stdio: 'ignore', timeout: 5000 });
        } catch (error) {
          console.log(`  ⚠ Failed to stop container ${containerId}`);
        }
      }

      console.log('✓ Docker containers stopped');
    } else {
      console.log('✓ No Docker containers to stop');
    }
  } catch (error) {
    console.log('⚠ Failed to stop Docker containers:', error instanceof Error ? error.message : error);
  }

  // Clean up test env file
  if (fs.existsSync(envFile)) {
    try {
      fs.unlinkSync(envFile);
      console.log('✓ Test environment file removed');
    } catch (error) {
      console.error('Failed to remove test environment file:', error);
    }
  }

  console.log('\n✅ E2E test infrastructure cleaned up!\n');
}

export default globalTeardown;

