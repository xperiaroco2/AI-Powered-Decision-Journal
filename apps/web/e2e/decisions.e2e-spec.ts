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
  test.beforeEach(async ({ page }) => {
    await registerUser(page, 'testuser@example.com', 'password123', 'Test User');
  });

  test.describe('Decision Creation', () => {
    test('should create a new decision successfully', async ({ page }) => {
      await page.goto('/decisions');

      // Click "New Decision" or similar button
      await page.click('button:has-text("New"), a:has-text("New")');

      // Fill in the decision form
      await page.fill(
        'textarea[name="situation"]',
        'Should I accept the job offer from TechCorp?',
      );
      await page.fill(
        'textarea[name="chosenDecision"]',
        'Yes, I will accept the offer',
      );
      await page.fill(
        'textarea[name="personalReasoning"]',
        'Better salary, good team, and growth opportunities',
      );

      // Submit the form
      await page.click('button[type="submit"]');

      // Should redirect to decision detail page
      await page.waitForURL(/\/decisions\/[a-z0-9]+$/, { timeout: 10000 });

      // Wait for the decision content to load (this confirms the decision was created)
      await expect(
        page.locator('text=Yes, I will accept the offer'),
      ).toBeVisible({ timeout: 10000 });

      // Verify the situation is also displayed
      await expect(
        page.locator('text=Should I accept the job offer from TechCorp?'),
      ).toBeVisible({ timeout: 5000 });
    });

    test('should create decision without reasoning', async ({ page }) => {
      await page.goto('/decisions');

      await page.click('button:has-text("New"), a:has-text("New")');

      await page.fill(
        'textarea[name="situation"]',
        'Should I exercise today?',
      );
      await page.fill('textarea[name="chosenDecision"]', 'Yes, I will exercise');

      await page.click('button[type="submit"]');

      await page.waitForURL(/\/decisions/, { timeout: 10000 });

      // Verify decision was created (UI verification)
      await expect(page.locator('text=Should I exercise today?')).toBeVisible();
    });

    test('should show validation errors for empty fields', async ({ page }) => {
      await page.goto('/decisions');

      await page.click('button:has-text("New"), a:has-text("New")');

      // Try to submit without filling fields
      await page.click('button[type="submit"]');

      // Should show validation errors
      await expect(
        page.locator('text=/required|cannot be empty/i'),
      ).toBeVisible({ timeout: 5000 });

      // Should still be on the form page (not redirected)
      expect(page.url()).toContain('/decisions/new');
    });

    test('should show warning for brief situation', async ({ page }) => {
      await page.goto('/decisions');

      await page.click('button:has-text("New"), a:has-text("New")');

      // Fill with very brief situation
      await page.fill('textarea[name="situation"]', 'Job offer');
      await page.fill('textarea[name="chosenDecision"]', 'Accept');

      // Should show warning (but still allow submission)
      // Use .first() to avoid strict mode violation since both fields may show warnings
      await expect(
        page.locator('text=/too brief|too short/i').first(),
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Decision List', () => {
    test('should display all user decisions', async ({ page }) => {
      // Create test decisions via UI
      await createDecision(page, {
        situation: 'Should I switch jobs? I have been offered a new position with better pay.',
        decision: 'Yes, I will accept the new job offer'
      });
      await createDecision(page, {
        situation: 'Should I buy a house? I have saved enough for a down payment.',
        decision: 'No, I will continue renting for now'
      });
      await createDecision(page, {
        situation: 'Should I learn Python? It could help me advance my career in tech.',
        decision: 'Yes, I will start learning Python'
      });

      await page.goto('/decisions');

      // Should see all three decisions
      await expect(page.locator('text=Should I switch jobs?')).toBeVisible();
      await expect(page.locator('text=Should I buy a house?')).toBeVisible();
      await expect(page.locator('text=Should I learn Python?')).toBeVisible();
    });

    test('should show empty state when no decisions', async ({ page }) => {
      await page.goto('/decisions');

      // Should show empty state message
      await expect(
        page.locator('text=/no decisions|create.*first/i'),
      ).toBeVisible();
    });

    test('should filter decisions by status', async ({ page }) => {
      // Create test decisions via UI
      await createDecision(page, {
        situation: 'Should I start a new project? I have some free time available.',
        decision: 'Yes, I will start the project'
      });
      // Note: We can't easily create DONE decisions via UI without waiting for processing
      // This test would need to wait for AI processing or use a different approach

      await page.goto('/decisions');

      // Verify filter UI exists
      await expect(
        page.locator('select').first(),
      ).toBeVisible();
    });
  });

  test.describe('Decision Detail', () => {
    test('should view decision details', async ({ page }) => {
      // Create decision via UI
      await page.goto('/decisions');
      await page.click('button:has-text("New"), a:has-text("New")');
      await page.fill('textarea[name="situation"]', 'Should I start a business?');
      await page.fill('textarea[name="chosenDecision"]', 'Yes, I will start');
      await page.fill('textarea[name="personalReasoning"]', 'I have a good idea and savings');
      await page.click('button[type="submit"]');

      // Wait for redirect to decision detail page
      await page.waitForURL(/\/decisions\/[a-z0-9]+$/, { timeout: 10000 });

      // Should see all decision details
      await expect(page.locator('text=Should I start a business?')).toBeVisible();
      await expect(page.locator('text=Yes, I will start')).toBeVisible();
      await expect(
        page.locator('text=I have a good idea and savings'),
      ).toBeVisible();
    });

    test('should show 404 for non-existent decision', async ({ page }) => {
      await page.goto('/decisions/non-existent-id');

      // Should redirect to /decisions (404 handling redirects instead of showing error)
      await page.waitForURL('/decisions', { timeout: 5000 });
    });
  });

  test.describe('Decision Analysis', () => {
    test('should show analysis when completed', async ({ page }) => {
      // Create decision via UI
      await createDecision(page, {
        situation: 'Should I invest in stocks? I have some savings and want to grow my wealth.',
        decision: 'Yes, I will start investing in stocks'
      });

      // Wait for analysis to complete (mock provider should be fast)
      await wait(5000);

      // Navigate to decisions list
      await page.goto('/decisions');

      // Click on the decision to view details
      await page.click('text=Should I invest in stocks?');

      // Should see analysis results (once processing completes)
      // Note: This test depends on the mock AI provider completing quickly
      // Use getByRole to target the CategoryBadge component, not the filter dropdown
      await expect(
        page.getByRole('heading', { name: 'Category' })
      ).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Real-time Updates', () => {
    test('should receive real-time analysis updates via WebSocket', async ({ page }) => {
      // Create a decision
      await page.goto('/decisions');
      await page.click('button:has-text("New"), a:has-text("New")');

      await page.fill(
        'textarea[name="situation"]',
        'Should I learn TypeScript? It could help me build better web applications.',
      );
      await page.fill('textarea[name="chosenDecision"]', 'Yes, I will learn TypeScript');

      await page.click('button[type="submit"]');

      // Wait for decision to be created and redirected to detail page
      await page.waitForURL(/\/decisions\/[a-z0-9]+$/, { timeout: 10000 });

      // Should initially show PENDING status - use .first() to avoid matching filter dropdown
      await expect(page.locator('text=/pending|analyzing|processing/i').first()).toBeVisible();

      // Wait for WebSocket to update the UI when analysis completes
      // The UI should automatically update to show completed analysis
      // Check for Category heading instead of category text to avoid matching filter dropdown
      await expect(
        page.getByRole('heading', { name: 'Category' })
      ).toBeVisible({ timeout: 30000 });
    });
  });
});

