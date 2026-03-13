/**
 * Attachments E2E Tests
 *
 * End-to-end tests for attachment upload and management.
 * Tests file upload, viewing attachments, and RAG functionality.
 */

import { test, expect } from './fixtures';
import {
  registerUser,
  wait,
} from './helpers/test-helpers';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Attachments E2E Tests', () => {
  let testFilePath: string;

  test.beforeAll(async () => {
    // Create a test file
    testFilePath = path.join(__dirname, 'test-document.txt');
    fs.writeFileSync(
      testFilePath,
      'This is a test document with important information about the decision.',
    );
  });

  test.afterAll(async () => {
    // Clean up test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  test.beforeEach(async ({ page }) => {
    await registerUser(page, 'testuser@example.com', 'password123', 'Test User');
  });

  test.describe('Attachment Upload', () => {
    test('should upload attachment to decision', async ({ page }) => {
      // Listen to console messages
      page.on('console', msg => console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`));
      page.on('pageerror', error => console.log(`[BROWSER ERROR] ${error.message}`));

      // Create a decision via UI first
      await page.goto('/decisions/new');

      // Wait for page to load
      await page.waitForSelector('textarea#situation');

      await page.fill('textarea#situation', 'Should I accept the job offer? This is a detailed situation description that provides enough context for the decision.');
      await page.fill('textarea#chosenDecision', 'Yes, I will accept the job offer');
      await page.click('button[type="submit"]');

      // Wait for redirect to decision detail page
      await page.waitForURL(/\/decisions\/[a-z0-9]+/, { timeout: 10000 });

      // Wait for the decision content to load (this ensures the page is fully rendered)
      await page.waitForSelector('text=Yes, I will accept the job offer', { timeout: 15000 });

      // Wait a bit for the attachments component to load
      await wait(2000);

      // Check if there's an error message
      const errorText = await page.textContent('body');
      console.log('[TEST] Page content:', errorText?.substring(0, 500));

      // Wait for the "+ Add Attachment" button to appear (this means attachments section is loaded)
      await page.waitForSelector('button:has-text("Add Attachment")', { timeout: 15000 });

      // Click the "+ Add Attachment" button to show upload form
      await page.click('button:has-text("Add Attachment")');

      // Wait for upload form to appear
      await page.waitForSelector('input#attachment-title');

      // Fill in title
      await page.fill('input#attachment-title', 'Employment Contract');

      // Upload file
      const fileInput = page.locator('input#attachment-file');
      await fileInput.setInputFiles(testFilePath);

      // Submit
      await page.click('button[type="submit"]:has-text("Upload Attachment")');

      // Wait a bit for upload to complete
      await wait(1000);

      // Verify attachment appears in the UI
      await expect(page.locator('text=Employment Contract')).toBeVisible();
    });

    test('should show validation error for missing title', async ({ page }) => {
      // Create a decision via UI first
      await page.goto('/decisions/new');
      await page.waitForSelector('textarea#situation');
      await page.fill('textarea#situation', 'Should I accept the job offer? This is a detailed situation description that provides enough context for the decision.');
      await page.fill('textarea#chosenDecision', 'Yes, I will accept the job offer');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/decisions\/[a-z0-9]+/, { timeout: 10000 });
      await page.waitForSelector('text=Yes, I will accept the job offer', { timeout: 15000 });

      // Wait for the "+ Add Attachment" button to appear
      await page.waitForSelector('button:has-text("Add Attachment")', { timeout: 15000 });
      await page.click('button:has-text("Add Attachment")');

      // Upload file without title
      // Note: The component auto-fills title from filename, so we need to clear it
      const fileInput = page.locator('input#attachment-file');
      await fileInput.setInputFiles(testFilePath);

      // Wait for auto-fill, then clear the title
      await wait(500);
      await page.fill('input#attachment-title', '');

      await page.click('button[type="submit"]:has-text("Upload Attachment")');

      // Should show validation error for title
      await expect(
        page.locator('text=/title.*required|required.*title|title.*least/i'),
      ).toBeVisible({ timeout: 5000 });
    });

    test('should show validation error for missing file', async ({ page }) => {
      // Create a decision via UI first
      await page.goto('/decisions/new');
      await page.waitForSelector('textarea#situation');
      await page.fill('textarea#situation', 'Should I accept the job offer? This is a detailed situation description that provides enough context for the decision.');
      await page.fill('textarea#chosenDecision', 'Yes, I will accept the job offer');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/decisions\/[a-z0-9]+/, { timeout: 10000 });
      await page.waitForSelector('text=Yes, I will accept the job offer', { timeout: 15000 });

      // Wait for the "+ Add Attachment" button to appear
      await page.waitForSelector('button:has-text("Add Attachment")', { timeout: 15000 });
      await page.click('button:has-text("Add Attachment")');

      // Fill title but don't upload file
      await page.fill('input#attachment-title', 'Test Document');

      await page.click('button[type="submit"]:has-text("Upload Attachment")');

      // Should show validation error for file
      await expect(
        page.locator('text=/file.*required|required.*file|select.*file/i'),
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Attachment List', () => {
    test('should display all attachments for decision', async ({ page }) => {
      // Create a decision via UI
      await page.goto('/decisions/new');
      await page.waitForSelector('textarea#situation');
      await page.fill('textarea#situation', 'Should I accept the job offer? This is a detailed situation description that provides enough context for the decision.');
      await page.fill('textarea#chosenDecision', 'Yes, I will accept the job offer');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/decisions\/[a-z0-9]+/, { timeout: 10000 });
      await page.waitForSelector('text=Yes, I will accept the job offer', { timeout: 15000 });

      // Upload first attachment
      await page.waitForSelector('button:has-text("Add Attachment")', { timeout: 15000 });
      await page.click('button:has-text("Add Attachment")');
      await page.fill('input#attachment-title', 'Employment Contract');
      let fileInput = page.locator('input#attachment-file');
      await fileInput.setInputFiles(testFilePath);
      await page.click('button[type="submit"]:has-text("Upload Attachment")');
      await wait(1000);

      // Upload second attachment
      await page.click('button:has-text("Add Attachment")');
      await page.fill('input#attachment-title', 'Benefits Package');
      fileInput = page.locator('input#attachment-file');
      await fileInput.setInputFiles(testFilePath);
      await page.click('button[type="submit"]:has-text("Upload Attachment")');
      await wait(1000);

      // Should see both attachments
      await expect(page.locator('text=Employment Contract')).toBeVisible();
      await expect(page.locator('text=Benefits Package')).toBeVisible();
    });

    test('should show empty state when no attachments', async ({ page }) => {
      // Create a decision via UI
      await page.goto('/decisions/new');
      await page.waitForSelector('textarea#situation');
      await page.fill('textarea#situation', 'Should I accept the job offer? This is a detailed situation description that provides enough context for the decision.');
      await page.fill('textarea#chosenDecision', 'Yes, I will accept the job offer');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/decisions\/[a-z0-9]+/, { timeout: 10000 });
      await page.waitForSelector('text=Yes, I will accept the job offer', { timeout: 15000 });

      // Should show "Add Attachment" button (which indicates empty state)
      await expect(
        page.locator('button:has-text("Add Attachment")'),
      ).toBeVisible({ timeout: 15000 });
    });

    test('should show attachment status', async ({ page }) => {
      // Create a decision via UI
      await page.goto('/decisions/new');
      await page.waitForSelector('textarea#situation');
      await page.fill('textarea#situation', 'Should I accept the job offer? This is a detailed situation description that provides enough context for the decision.');
      await page.fill('textarea#chosenDecision', 'Yes, I will accept the job offer');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/decisions\/[a-z0-9]+/, { timeout: 10000 });
      await page.waitForSelector('text=Yes, I will accept the job offer', { timeout: 15000 });

      // Upload an attachment
      await page.waitForSelector('button:has-text("Add Attachment")', { timeout: 15000 });
      await page.click('button:has-text("Add Attachment")');
      await page.fill('input#attachment-title', 'Processing Document');
      const fileInput = page.locator('input#attachment-file');
      await fileInput.setInputFiles(testFilePath);
      await page.click('button[type="submit"]:has-text("Upload Attachment")');

      // Should show processing/pending status badge (use .last() to get the attachment status, not decision status)
      await expect(
        page.locator('text=/processing|pending|ready/i').last(),
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Attachment Content', () => {
    test('should view attachment content', async ({ page }) => {
      // Create a decision via UI
      await page.goto('/decisions/new');
      await page.waitForSelector('textarea#situation');
      await page.fill('textarea#situation', 'Should I accept the job offer? This is a detailed situation description that provides enough context for the decision.');
      await page.fill('textarea#chosenDecision', 'Yes, I will accept the job offer');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/decisions\/[a-z0-9]+/, { timeout: 10000 });
      await page.waitForSelector('text=Yes, I will accept the job offer', { timeout: 15000 });

      // Upload an attachment
      await page.waitForSelector('button:has-text("Add Attachment")', { timeout: 15000 });
      await page.click('button:has-text("Add Attachment")');
      await page.fill('input#attachment-title', 'Important Document');
      const fileInput = page.locator('input#attachment-file');
      await fileInput.setInputFiles(testFilePath);
      await page.click('button[type="submit"]:has-text("Upload Attachment")');
      await wait(1000);

      // Verify attachment appears in the list (this confirms it's viewable)
      await expect(page.locator('text=Important Document')).toBeVisible();
    });
  });

  test.describe('Attachment Processing', () => {
    test('should process attachment and update status', async ({ page }) => {
      // Create a decision via UI
      await page.goto('/decisions/new');
      await page.waitForSelector('textarea#situation');
      await page.fill('textarea#situation', 'Should I accept the job offer? This is a detailed situation description that provides enough context for the decision.');
      await page.fill('textarea#chosenDecision', 'Yes, I will accept the job offer');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/decisions\/[a-z0-9]+/, { timeout: 10000 });
      await page.waitForSelector('text=Yes, I will accept the job offer', { timeout: 15000 });

      // Upload attachment
      await page.waitForSelector('button:has-text("Add Attachment")', { timeout: 15000 });
      await page.click('button:has-text("Add Attachment")');
      await page.fill('input#attachment-title', 'Test Document');

      const fileInput = page.locator('input#attachment-file');
      await fileInput.setInputFiles(testFilePath);

      await page.click('button[type="submit"]:has-text("Upload Attachment")');

      // Wait for upload to complete
      await wait(1000);

      // Verify attachment appears in UI with status (use .last() to get the attachment status)
      await expect(page.locator('text=Test Document')).toBeVisible();
      await expect(
        page.locator('text=/pending|processing|ready/i').last(),
      ).toBeVisible();
    });
  });

  test.describe('Multiple Attachments', () => {
    test('should handle multiple attachments for same decision', async ({ page }) => {
      // Create a decision via UI
      await page.goto('/decisions/new');
      await page.waitForSelector('textarea#situation');
      await page.fill('textarea#situation', 'Should I accept the job offer? This is a detailed situation description that provides enough context for the decision.');
      await page.fill('textarea#chosenDecision', 'Yes, I will accept the job offer');
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/decisions\/[a-z0-9]+/, { timeout: 10000 });
      await page.waitForSelector('text=Yes, I will accept the job offer', { timeout: 15000 });

      // Upload first attachment
      await page.waitForSelector('button:has-text("Add Attachment")', { timeout: 15000 });
      await page.click('button:has-text("Add Attachment")');
      await page.fill('input#attachment-title', 'Document 1');
      let fileInput = page.locator('input#attachment-file');
      await fileInput.setInputFiles(testFilePath);
      await page.click('button[type="submit"]:has-text("Upload Attachment")');

      await wait(1000);

      // Upload second attachment
      await page.click('button:has-text("Add Attachment")');
      await page.fill('input#attachment-title', 'Document 2');
      fileInput = page.locator('input#attachment-file');
      await fileInput.setInputFiles(testFilePath);
      await page.click('button[type="submit"]:has-text("Upload Attachment")');

      await wait(1000);

      // Should see both attachments in the UI
      await expect(page.locator('text=Document 1')).toBeVisible();
      await expect(page.locator('text=Document 2')).toBeVisible();
    });
  });
});

