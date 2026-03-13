/**
 * Playwright Global Setup
 *
 * This runs once before all E2E tests.
 * It starts Testcontainers (PostgreSQL + Redis) and the API/Web servers.
 */

import { FullConfig } from '@playwright/test';
import { execSync, spawn, ChildProcess } from 'child_process';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import * as path from 'path';
import * as fs from 'fs';

let postgresContainer: StartedPostgreSqlContainer;
let redisContainer: StartedTestContainer;
let apiProcess: ChildProcess;
let workerProcess: ChildProcess;
let webProcess: ChildProcess;

async function globalSetup(_config: FullConfig) {
  console.log('\n🚀 Starting E2E test infrastructure...\n');

  // 0. Pre-cleanup: Kill any existing processes and containers from previous runs
  console.log('🧹 Pre-cleanup: Checking for leftover processes...');

  try {
    // Kill any Node.js processes on ports 4001 and 3001
    if (process.platform === 'win32') {
      try {
        execSync('netstat -ano | findstr :4001', { encoding: 'utf-8' }).split('\n').forEach(line => {
          const match = line.match(/LISTENING\s+(\d+)/);
          if (match) {
            try {
              execSync(`taskkill /F /PID ${match[1]}`, { stdio: 'ignore' });
              console.log(`  Killed process on port 4001 (PID: ${match[1]})`);
            } catch {}
          }
        });
      } catch {}

      try {
        execSync('netstat -ano | findstr :3001', { encoding: 'utf-8' }).split('\n').forEach(line => {
          const match = line.match(/LISTENING\s+(\d+)/);
          if (match) {
            try {
              execSync(`taskkill /F /PID ${match[1]}`, { stdio: 'ignore' });
              console.log(`  Killed process on port 3001 (PID: ${match[1]})`);
            } catch {}
          }
        });
      } catch {}
    } else {
      // Unix-like systems
      try {
        const pid4001 = execSync('lsof -ti:4001', { encoding: 'utf-8' }).trim();
        if (pid4001) {
          execSync(`kill -9 ${pid4001}`, { stdio: 'ignore' });
          console.log(`  Killed process on port 4001 (PID: ${pid4001})`);
        }
      } catch {}

      try {
        const pid3001 = execSync('lsof -ti:3001', { encoding: 'utf-8' }).trim();
        if (pid3001) {
          execSync(`kill -9 ${pid3001}`, { stdio: 'ignore' });
          console.log(`  Killed process on port 3001 (PID: ${pid3001})`);
        }
      } catch {}
    }

    // Stop any leftover Docker containers
    try {
      const containers = execSync(
        'docker ps -q --filter "label=org.testcontainers=true"',
        { encoding: 'utf-8' }
      ).trim();

      if (containers) {
        const containerIds = containers.split('\n').filter(id => id.length > 0);
        for (const containerId of containerIds) {
          try {
            execSync(`docker stop ${containerId}`, { stdio: 'ignore', timeout: 5000 });
            execSync(`docker rm ${containerId}`, { stdio: 'ignore', timeout: 5000 });
            console.log(`  Stopped and removed container ${containerId}`);
          } catch {}
        }
      }
    } catch {}

    console.log('✓ Pre-cleanup complete');
  } catch (_error) {
    console.log('⚠ Pre-cleanup had some issues, continuing anyway...');
  }

  // 1. Start PostgreSQL container with pgvector
  console.log('📦 Starting PostgreSQL container...');
  postgresContainer = await new PostgreSqlContainer('pgvector/pgvector:pg16')
    .withDatabase('test_db')
    .withUsername('test_user')
    .withPassword('test_password')
    .withExposedPorts(5432)
    .start();

  const databaseUrl = postgresContainer.getConnectionUri();
  console.log(`✓ PostgreSQL started: ${databaseUrl}`);

  // Enable pgvector extension
  console.log('🔌 Enabling pgvector extension...');
  const { Client } = require('pg');
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
  await client.end();
  console.log('✓ pgvector extension enabled');

  // 2. Start Redis container
  console.log('📦 Starting Redis container...');
  redisContainer = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .start();

  const redisHost = redisContainer.getHost();
  const redisPort = redisContainer.getMappedPort(6379);
  const redisUrl = `redis://${redisHost}:${redisPort}`;
  console.log(`✓ Redis started: ${redisUrl}`);

  // 3. Apply Prisma schema to test database
  console.log('📋 Applying Prisma schema...');
  const apiDir = path.join(__dirname, '../../api');
  
  try {
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      cwd: apiDir,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
      stdio: 'inherit',
    });
    console.log('✓ Prisma schema applied');
  } catch (error) {
    console.error('Failed to apply Prisma schema:', error);
    throw error;
  }

  // 4. Save connection info to file for tests and servers to use
  const envFile = path.join(__dirname, '.test-env.json');
  const testEnv = {
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    API_PORT: 4001,
    WEB_PORT: 3001,
    // Store process PIDs for teardown
    API_PROCESS_PID: 0, // Will be set after process starts
    WEB_PROCESS_PID: 0, // Will be set after process starts
  };

  fs.writeFileSync(envFile, JSON.stringify(testEnv, null, 2));
  console.log(`✓ Test environment saved to ${envFile}`);

  // 5. Set environment variables for the current process
  process.env.DATABASE_URL = databaseUrl;
  process.env.REDIS_URL = redisUrl;
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret';
  process.env.AI_PROVIDER = 'mock';
  process.env.EMBEDDING_PROVIDER = 'mock';
  process.env.NODE_ENV = 'test';
  process.env.API_PORT = '4001';
  process.env.NEXT_PUBLIC_API_URL = 'http://localhost:4001';

  // 6. Start API server
  console.log('🚀 Starting API server...');
  apiProcess = spawn('pnpm', ['start:dev'], {
    cwd: apiDir,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      REDIS_URL: redisUrl,
      JWT_SECRET: 'test-jwt-secret',
      JWT_REFRESH_SECRET: 'test-jwt-refresh-secret',
      AI_PROVIDER: 'mock',
      EMBEDDING_PROVIDER: 'mock',
      NODE_ENV: 'test',
      PORT: '4001',
    },
    shell: true,
  });

  // Log API server output for debugging
  apiProcess.stdout?.on('data', (data) => {
    console.log(`[API] ${data.toString().trim()}`);
  });
  apiProcess.stderr?.on('data', (data) => {
    console.error(`[API ERROR] ${data.toString().trim()}`);
  });

  // Wait for API server to be ready
  await waitForServer('http://localhost:4001/health', 120000);
  console.log('✓ API server started');

  // Save API process PID
  if (apiProcess.pid) {
    const env = JSON.parse(fs.readFileSync(envFile, 'utf-8'));
    env.API_PROCESS_PID = apiProcess.pid;
    fs.writeFileSync(envFile, JSON.stringify(env, null, 2));
  }

  // 7. Start Worker process
  console.log('🚀 Starting Worker process...');
  const workerDir = path.join(__dirname, '../../worker');
  workerProcess = spawn('pnpm', ['dev'], {
    cwd: workerDir,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      REDIS_URL: redisUrl,
      AI_PROVIDER: 'mock',
      EMBEDDING_PROVIDER: 'mock',
      NODE_ENV: 'test',
    },
    shell: true,
  });

  // Log Worker output for debugging
  workerProcess.stdout?.on('data', (data) => {
    console.log(`[WORKER] ${data.toString().trim()}`);
  });
  workerProcess.stderr?.on('data', (data) => {
    console.error(`[WORKER ERROR] ${data.toString().trim()}`);
  });

  // Wait a bit for worker to initialize
  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log('✓ Worker process started');

  // Save Worker process PID
  if (workerProcess.pid) {
    const env = JSON.parse(fs.readFileSync(envFile, 'utf-8'));
    env.WORKER_PROCESS_PID = workerProcess.pid;
    fs.writeFileSync(envFile, JSON.stringify(env, null, 2));
  }

  // 8. Clean up .next directory to avoid file lock issues on Windows
  console.log('🧹 Cleaning .next directory...');
  const webDir = path.join(__dirname, '..');
  const nextDir = path.join(webDir, '.next');

  if (fs.existsSync(nextDir)) {
    try {
      // On Windows, use rmdir /s /q; on Unix, use rm -rf
      if (process.platform === 'win32') {
        execSync(`rmdir /s /q "${nextDir}"`, { stdio: 'ignore' });
      } else {
        execSync(`rm -rf "${nextDir}"`, { stdio: 'ignore' });
      }
      console.log('✓ .next directory cleaned');
    } catch (_error) {
      console.log('⚠ Failed to clean .next directory, continuing anyway...');
    }
  }

  // 8. Start Web server
  console.log('🚀 Starting Web server...');
  webProcess = spawn('pnpm', ['dev'], {
    cwd: webDir,
    env: {
      ...process.env,
      NEXT_PUBLIC_API_URL: 'http://localhost:4001',
      REDIS_URL: redisUrl, // Pass test Redis URL to web server for Socket.IO
      NODE_ENV: 'test',
      PORT: '3001',
      NEXT_TELEMETRY_DISABLED: '1', // Disable Next.js telemetry to avoid trace file issues
    },
    shell: true,
  });

  // Log Web server output for debugging
  webProcess.stdout?.on('data', (data) => {
    console.log(`[WEB] ${data.toString().trim()}`);
  });
  webProcess.stderr?.on('data', (data) => {
    console.error(`[WEB ERROR] ${data.toString().trim()}`);
  });

  // Wait for Web server to be ready
  await waitForServer('http://localhost:3001', 180000); // Increased timeout to 3 minutes for Next.js compilation
  console.log('✓ Web server started');

  // Save Web process PID
  if (webProcess.pid) {
    const env = JSON.parse(fs.readFileSync(envFile, 'utf-8'));
    env.WEB_PROCESS_PID = webProcess.pid;
    fs.writeFileSync(envFile, JSON.stringify(env, null, 2));
  }

  console.log('\n✅ E2E test infrastructure ready!\n');
  console.log('Database:', databaseUrl);
  console.log('Redis:', redisUrl);
  console.log('API running on: http://localhost:4001');
  console.log('Web running on: http://localhost:3001\n');

  // Store container and process references globally so global-teardown can access them
  // NOTE: These are also stored in .test-env.json for cross-process access
  (global as any).__POSTGRES_CONTAINER__ = postgresContainer;
  (global as any).__REDIS_CONTAINER__ = redisContainer;
  (global as any).__API_PROCESS__ = apiProcess;
  (global as any).__WEB_PROCESS__ = webProcess;
}

/**
 * Wait for a server to be ready by polling the URL
 * Accepts any HTTP response (including errors) as long as the server is responding
 */
async function waitForServer(url: string, timeout: number): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      // Just try to connect - any response means the server is up
      await fetch(url);
      // If we get here, the server responded (even if with an error)
      return;
    } catch (_error) {
      // Server not ready yet (connection refused), continue polling
    }

    // Wait 1 second before next attempt
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error(`Server at ${url} did not become ready within ${timeout}ms`);
}

export default globalSetup;

