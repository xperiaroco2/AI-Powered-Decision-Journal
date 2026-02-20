/**
 * Playwright Test Fixtures
 * 
 * Custom fixtures for E2E tests including database cleanup.
 */

import { test as base } from '@playwright/test';
import { cleanupE2EDatabase } from './db-cleanup';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Extended test with database cleanup fixture
 */
export const test = base.extend({
  /**
   * Automatically clean up the database before each test
   */
  page: async ({ page }, use) => {
    // Read the database URL from the test environment file
    const envFile = path.join(__dirname, '.test-env.json');
    const env = JSON.parse(fs.readFileSync(envFile, 'utf-8'));
    
    // Clean up database before test
    await cleanupE2EDatabase(env.DATABASE_URL);
    
    // Run the test
    await use(page);
    
    // Optionally clean up after test (commented out to preserve data for debugging)
    // await cleanupE2EDatabase(env.DATABASE_URL);
  },
});

export { expect } from '@playwright/test';

