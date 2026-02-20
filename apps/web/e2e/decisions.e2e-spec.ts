/**
 * Decisions E2E Tests
 *
 * End-to-end tests for decision management flows.
 * Tests creating, viewing, and analyzing decisions.
 */

import { test, expect } from './fixtures';
import {
  registerUser,
  createDecision,
  waitForText,
  waitForElement,
  wait,
  retry,
} from './helpers/test-helpers';

test.describe('Decisions E2E Tests', () => {
  // test.beforeEach(async ({ page }) => {
  //   await registerUser(page, 'testuser@example.com', 'password123', 'Test User');
  // });

  // test.describe('Decision Creation', () => {
  //   test('should create a new decision successfully', async ({ page }) => {
  //     await page.goto('/decisions');

  //     // Click "New Decision" or similar button
  //     await page.click('button:has-text("New"), a:has-text("New")');

  //     // Fill in the decision form
  //     await page.fill(
  //       'textarea[name="situation"]',
  //       'Should I accept the job offer from TechCorp?',
  //     );
  //     await page.fill(
  //       'textarea[name="chosenDecision"]',
  //       'Yes, I will accept the offer',
  //     );
  //     await page.fill(
  //       'textarea[name="personalReasoning"]',
  //       'Better salary, good team, and growth opportunities',
  //     );

  //     // Submit the form
  //     await page.click('button[type="submit"]');

  //     // Should redirect to decisions list or decision detail
  //     await page.waitForURL(/\/decisions/, { timeout: 10000 });

  //     // Should see the decision in the list (UI verification)
  //     await expect(
  //       page.locator('text=Should I accept the job offer'),
  //     ).toBeVisible({ timeout: 5000 });

  //     // Should see status indicator (PENDING or Processing)
  //     await expect(
  //       page.locator('text=/pending|processing/i'),
  //     ).toBeVisible({ timeout: 5000 });
  //   });

  //   test('should create decision without reasoning', async ({ page }) => {
  //     await page.goto('/decisions');

  //     await page.click('button:has-text("New"), a:has-text("New")');

  //     await page.fill(
  //       'textarea[name="situation"]',
  //       'Should I exercise today?',
  //     );
  //     await page.fill('textarea[name="chosenDecision"]', 'Yes, I will exercise');

  //     await page.click('button[type="submit"]');

  //     await page.waitForURL(/\/decisions/, { timeout: 10000 });

  //     // Verify decision was created (UI verification)
  //     await expect(page.locator('text=Should I exercise today?')).toBeVisible();
  //   });

  //   test('should show validation errors for empty fields', async ({ page }) => {
  //     await page.goto('/decisions');

  //     await page.click('button:has-text("New"), a:has-text("New")');

  //     // Try to submit without filling fields
  //     await page.click('button[type="submit"]');

  //     // Should show validation errors
  //     await expect(
  //       page.locator('text=/required|cannot be empty/i'),
  //     ).toBeVisible({ timeout: 5000 });

  //     // Should still be on the form page (not redirected)
  //     expect(page.url()).toContain('/decisions/new');
  //   });

  //   test('should show warning for brief situation', async ({ page }) => {
  //     await page.goto('/decisions');

  //     await page.click('button:has-text("New"), a:has-text("New")');

  //     // Fill with very brief situation
  //     await page.fill('textarea[name="situation"]', 'Job offer');
  //     await page.fill('textarea[name="chosenDecision"]', 'Accept');

  //     // Should show warning (but still allow submission)
  //     await expect(
  //       page.locator('text=/too brief|too short/i'),
  //     ).toBeVisible({ timeout: 5000 });
  //   });
  // });

  // test.describe('Decision List', () => {
  //   test('should display all user decisions', async ({ page }) => {
  //     // Create test decisions via UI
  //     await createDecision(page, 'Should I switch jobs?', 'Yes');
  //     await createDecision(page, 'Should I buy a house?', 'No');
  //     await createDecision(page, 'Should I learn Python?', 'Yes');

  //     await page.goto('/decisions');

  //     // Should see all three decisions
  //     await expect(page.locator('text=Should I switch jobs?')).toBeVisible();
  //     await expect(page.locator('text=Should I buy a house?')).toBeVisible();
  //     await expect(page.locator('text=Should I learn Python?')).toBeVisible();
  //   });

  //   test('should show empty state when no decisions', async ({ page }) => {
  //     await page.goto('/decisions');

  //     // Should show empty state message
  //     await expect(
  //       page.locator('text=/no decisions|get started|create.*first/i'),
  //     ).toBeVisible();
  //   });

  //   test('should filter decisions by status', async ({ page }) => {
  //     // Create test decisions via UI
  //     await createDecision(page, 'Pending decision', 'Yes');
  //     // Note: We can't easily create DONE decisions via UI without waiting for processing
  //     // This test would need to wait for AI processing or use a different approach

  //     await page.goto('/decisions');

  //     // Verify filter UI exists
  //     await expect(
  //       page.locator('button:has-text("Filter"), select[name="status"]'),
  //     ).toBeVisible();
  //   });
  // });

  // test.describe('Decision Detail', () => {
  //   test('should view decision details', async ({ page }) => {
  //     // Create decision via UI
  //     await page.goto('/decisions');
  //     await page.click('button:has-text("New"), a:has-text("New")');
  //     await page.fill('textarea[name="situation"]', 'Should I start a business?');
  //     await page.fill('textarea[name="chosenDecision"]', 'Yes, I will start');
  //     await page.fill('textarea[name="personalReasoning"]', 'I have a good idea and savings');
  //     await page.click('button[type="submit"]');

  //     // Wait for redirect to decision detail or list
  //     await page.waitForURL(/\/decisions/, { timeout: 10000 });

  //     // Click on the decision to view details (if on list page)
  //     await page.click('text=Should I start a business?');

  //     // Should see all decision details
  //     await expect(page.locator('text=Should I start a business?')).toBeVisible();
  //     await expect(page.locator('text=Yes, I will start')).toBeVisible();
  //     await expect(
  //       page.locator('text=I have a good idea and savings'),
  //     ).toBeVisible();
  //   });

  //   test('should show 404 for non-existent decision', async ({ page }) => {
  //     await page.goto('/decisions/non-existent-id');

  //     // Should show 404 or error message
  //     await expect(
  //       page.locator('text=/not found|404|does not exist/i'),
  //     ).toBeVisible({ timeout: 5000 });
  //   });
  // });

  // test.describe('Decision Analysis', () => {
  //   test('should show analysis when completed', async ({ page }) => {
  //     // Create decision via UI
  //     await createDecision(page, 'Should I invest in stocks?', 'Yes');

  //     // Wait for analysis to complete (mock provider should be fast)
  //     await wait(5000);

  //     // Navigate to decisions list
  //     await page.goto('/decisions');

  //     // Click on the decision to view details
  //     await page.click('text=Should I invest in stocks?');

  //     // Should see analysis results (once processing completes)
  //     // Note: This test depends on the mock AI provider completing quickly
  //     await expect(
  //       page.locator('text=/FINANCIAL|CAREER|LIFESTYLE|RELATIONSHIP|HEALTH|OTHER/i'),
  //     ).toBeVisible({ timeout: 15000 });
  //   });

  //   test('should show pending state while analysis is processing', async ({ page }) => {
  //     // Create decision via UI
  //     await createDecision(page, 'Should I change careers?', 'Yes');

  //     // Immediately navigate to the decision (should still be processing)
  //     await page.goto('/decisions');
  //     await page.click('text=Should I change careers?');

  //     // Should show processing indicator
  //     await expect(
  //       page.locator('text=/analyzing|processing|pending/i'),
  //     ).toBeVisible();
  //   });

  //   test('should allow rerunning analysis', async ({ page }) => {
  //     // Create decision via UI and wait for analysis to complete
  //     await createDecision(page, 'Should I relocate?', 'Yes');
  //     await wait(5000); // Wait for initial analysis

  //     // Navigate to decision detail
  //     await page.goto('/decisions');
  //     await page.click('text=Should I relocate?');

  //     // Wait for analysis to complete
  //     await expect(
  //       page.locator('text=/LIFESTYLE|completed/i'),
  //     ).toBeVisible({ timeout: 15000 });

  //     // Click rerun button
  //     await page.click('button:has-text("Rerun"), button:has-text("Re-analyze")');

  //     // Should show confirmation or start rerunning
  //     await expect(
  //       page.locator('text=/rerunning|re-analyzing|processing/i'),
  //     ).toBeVisible({ timeout: 5000 });
  //   });
  // });

  // test.describe('Real-time Updates', () => {
  //   test('should receive real-time analysis updates via WebSocket', async ({ page }) => {
  //     // Create a decision
  //     await page.goto('/decisions');
  //     await page.click('button:has-text("New"), a:has-text("New")');

  //     await page.fill(
  //       'textarea[name="situation"]',
  //       'Should I learn TypeScript?',
  //     );
  //     await page.fill('textarea[name="chosenDecision"]', 'Yes');

  //     await page.click('button[type="submit"]');

  //     // Wait for decision to be created and redirected
  //     await page.waitForURL(/\/decisions/, { timeout: 10000 });

  //     // Click on the decision to view details
  //     await page.click('text=Should I learn TypeScript?');

  //     // Should initially show PENDING status
  //     await expect(page.locator('text=/pending|analyzing|processing/i')).toBeVisible();

  //     // Wait for WebSocket to update the UI when analysis completes
  //     // The UI should automatically update to show completed analysis
  //     await expect(
  //       page.locator('text=/completed|done|CAREER|LIFESTYLE/i'),
  //     ).toBeVisible({ timeout: 30000 });
  //   });
  // });
});

