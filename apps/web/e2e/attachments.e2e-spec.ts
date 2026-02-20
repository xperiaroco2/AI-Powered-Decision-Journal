/**
 * Attachments E2E Tests
 *
 * End-to-end tests for attachment upload and management.
 * Tests file upload, viewing attachments, and RAG functionality.
 */

import { test, expect } from './fixtures';
import {
  registerUser,
  waitForElement,
  wait,
} from './helpers/test-helpers';
import * as path from 'path';
import * as fs from 'fs';

test.describe('Attachments E2E Tests', () => {
  // let testFilePath: string;

  // test.beforeAll(async () => {
  //   // Create a test file
  //   testFilePath = path.join(__dirname, 'test-document.txt');
  //   fs.writeFileSync(
  //     testFilePath,
  //     'This is a test document with important information about the decision.',
  //   );
  // });

  // test.afterAll(async () => {
  //   // Clean up test file
  //   if (fs.existsSync(testFilePath)) {
  //     fs.unlinkSync(testFilePath);
  //   }
  // });

  // test.beforeEach(async ({ page }) => {
  //   await registerUser(page, 'testuser@example.com', 'password123', 'Test User');
  // });

  // test.describe('Attachment Upload', () => {
  //   test('should upload attachment to decision', async ({ page }) => {
  //     // Create a decision via UI first
  //     await page.goto('/decisions');
  //     await page.click('button:has-text("New"), a:has-text("New")');
  //     await page.fill('textarea[name="situation"]', 'Should I accept the job offer?');
  //     await page.fill('textarea[name="chosenDecision"]', 'Yes');
  //     await page.click('button[type="submit"]');
  //     await page.waitForURL(/\/decisions/, { timeout: 10000 });

  //     // Click on the decision to view details
  //     await page.click('text=Should I accept the job offer?');

  //     // Click upload attachment button
  //     await page.click('button:has-text("Upload"), button:has-text("Attach")');

  //     // Fill in title
  //     await page.fill('input[name="title"]', 'Employment Contract');

  //     // Upload file
  //     const fileInput = page.locator('input[type="file"]');
  //     await fileInput.setInputFiles(testFilePath);

  //     // Submit
  //     await page.click('button[type="submit"]');

  //     // Should show success message
  //     await expect(
  //       page.locator('text=/uploaded|success|added/i'),
  //     ).toBeVisible({ timeout: 10000 });

  //     // Verify attachment appears in the UI
  //     await expect(page.locator('text=Employment Contract')).toBeVisible();
  //   });

  //   test('should show validation error for missing title', async ({ page }) => {
  //     // Create a decision via UI first
  //     await page.goto('/decisions');
  //     await page.click('button:has-text("New"), a:has-text("New")');
  //     await page.fill('textarea[name="situation"]', 'Test decision');
  //     await page.fill('textarea[name="chosenDecision"]', 'Test');
  //     await page.click('button[type="submit"]');
  //     await page.waitForURL(/\/decisions/, { timeout: 10000 });
  //     await page.click('text=Test decision');

  //     await page.click('button:has-text("Upload"), button:has-text("Attach")');

  //     // Upload file without title
  //     const fileInput = page.locator('input[type="file"]');
  //     await fileInput.setInputFiles(testFilePath);

  //     await page.click('button[type="submit"]');

  //     // Should show validation error
  //     await expect(
  //       page.locator('text=/title.*required|required.*title/i'),
  //     ).toBeVisible({ timeout: 5000 });
  //   });

  //   test('should show validation error for missing file', async ({ page }) => {
  //     // Create a decision via UI first
  //     await page.goto('/decisions');
  //     await page.click('button:has-text("New"), a:has-text("New")');
  //     await page.fill('textarea[name="situation"]', 'Test decision');
  //     await page.fill('textarea[name="chosenDecision"]', 'Test');
  //     await page.click('button[type="submit"]');
  //     await page.waitForURL(/\/decisions/, { timeout: 10000 });
  //     await page.click('text=Test decision');

  //     await page.click('button:has-text("Upload"), button:has-text("Attach")');

  //     // Fill title but don't upload file
  //     await page.fill('input[name="title"]', 'Test Document');

  //     await page.click('button[type="submit"]');

  //     // Should show validation error
  //     await expect(
  //       page.locator('text=/file.*required|required.*file/i'),
  //     ).toBeVisible({ timeout: 5000 });
  //   });
  // });

  // test.describe('Attachment List', () => {
  //   test('should display all attachments for decision', async ({ page }) => {
  //     // Create a decision via UI
  //     await page.goto('/decisions');
  //     await page.click('button:has-text("New"), a:has-text("New")');
  //     await page.fill('textarea[name="situation"]', 'Job offer decision');
  //     await page.fill('textarea[name="chosenDecision"]', 'Accept');
  //     await page.click('button[type="submit"]');
  //     await page.waitForURL(/\/decisions/, { timeout: 10000 });
  //     await page.click('text=Job offer decision');

  //     // Upload first attachment
  //     await page.click('button:has-text("Upload"), button:has-text("Attach")');
  //     await page.fill('input[name="title"]', 'Employment Contract');
  //     let fileInput = page.locator('input[type="file"]');
  //     await fileInput.setInputFiles(testFilePath);
  //     await page.click('button[type="submit"]');
  //     await wait(1000);

  //     // Upload second attachment
  //     await page.click('button:has-text("Upload"), button:has-text("Attach")');
  //     await page.fill('input[name="title"]', 'Benefits Package');
  //     fileInput = page.locator('input[type="file"]');
  //     await fileInput.setInputFiles(testFilePath);
  //     await page.click('button[type="submit"]');
  //     await wait(1000);

  //     // Should see both attachments
  //     await expect(page.locator('text=Employment Contract')).toBeVisible();
  //     await expect(page.locator('text=Benefits Package')).toBeVisible();
  //   });

  //   test('should show empty state when no attachments', async ({ page }) => {
  //     // Create a decision via UI
  //     await page.goto('/decisions');
  //     await page.click('button:has-text("New"), a:has-text("New")');
  //     await page.fill('textarea[name="situation"]', 'Test decision');
  //     await page.fill('textarea[name="chosenDecision"]', 'Test');
  //     await page.click('button[type="submit"]');
  //     await page.waitForURL(/\/decisions/, { timeout: 10000 });
  //     await page.click('text=Test decision');

  //     // Should show empty state
  //     await expect(
  //       page.locator('text=/no attachments|add.*attachment|upload.*document/i'),
  //     ).toBeVisible();
  //   });

  //   test('should show attachment status', async ({ page }) => {
  //     // Create a decision via UI
  //     await page.goto('/decisions');
  //     await page.click('button:has-text("New"), a:has-text("New")');
  //     await page.fill('textarea[name="situation"]', 'Test decision');
  //     await page.fill('textarea[name="chosenDecision"]', 'Test');
  //     await page.click('button[type="submit"]');
  //     await page.waitForURL(/\/decisions/, { timeout: 10000 });
  //     await page.click('text=Test decision');

  //     // Upload an attachment
  //     await page.click('button:has-text("Upload"), button:has-text("Attach")');
  //     await page.fill('input[name="title"]', 'Processing Document');
  //     const fileInput = page.locator('input[type="file"]');
  //     await fileInput.setInputFiles(testFilePath);
  //     await page.click('button[type="submit"]');

  //     // Should show processing/pending status
  //     await expect(
  //       page.locator('text=/processing|pending|analyzing/i'),
  //     ).toBeVisible({ timeout: 5000 });
  //   });
  // });

  // test.describe('Attachment Content', () => {
  //   test('should view attachment content', async ({ page }) => {
  //     // Create a decision via UI
  //     await page.goto('/decisions');
  //     await page.click('button:has-text("New"), a:has-text("New")');
  //     await page.fill('textarea[name="situation"]', 'Test decision');
  //     await page.fill('textarea[name="chosenDecision"]', 'Test');
  //     await page.click('button[type="submit"]');
  //     await page.waitForURL(/\/decisions/, { timeout: 10000 });
  //     await page.click('text=Test decision');

  //     // Upload an attachment
  //     await page.click('button:has-text("Upload"), button:has-text("Attach")');
  //     await page.fill('input[name="title"]', 'Important Document');
  //     const fileInput = page.locator('input[type="file"]');
  //     await fileInput.setInputFiles(testFilePath);
  //     await page.click('button[type="submit"]');
  //     await wait(2000);

  //     // Click on attachment to view content
  //     await page.click('text=Important Document');

  //     // Should see attachment content or details
  //     await expect(
  //       page.locator('text=/Important Document|content|document/i'),
  //     ).toBeVisible({ timeout: 5000 });
  //   });
  // });

  // test.describe('Attachment Processing', () => {
  //   test('should process attachment and update status', async ({ page }) => {
  //     // Create a decision via UI
  //     await page.goto('/decisions');
  //     await page.click('button:has-text("New"), a:has-text("New")');
  //     await page.fill('textarea[name="situation"]', 'Test decision');
  //     await page.fill('textarea[name="chosenDecision"]', 'Test');
  //     await page.click('button[type="submit"]');
  //     await page.waitForURL(/\/decisions/, { timeout: 10000 });
  //     await page.click('text=Test decision');

  //     // Upload attachment
  //     await page.click('button:has-text("Upload"), button:has-text("Attach")');
  //     await page.fill('input[name="title"]', 'Test Document');

  //     const fileInput = page.locator('input[type="file"]');
  //     await fileInput.setInputFiles(testFilePath);

  //     await page.click('button[type="submit"]');

  //     // Wait for upload to complete
  //     await wait(2000);

  //     // Verify attachment appears in UI with status
  //     await expect(page.locator('text=Test Document')).toBeVisible();
  //     await expect(
  //       page.locator('text=/pending|processing|ready/i'),
  //     ).toBeVisible();
  //   });
  // });

  // test.describe('Multiple Attachments', () => {
  //   test('should handle multiple attachments for same decision', async ({ page }) => {
  //     // Create a decision via UI
  //     await page.goto('/decisions');
  //     await page.click('button:has-text("New"), a:has-text("New")');
  //     await page.fill('textarea[name="situation"]', 'Complex decision');
  //     await page.fill('textarea[name="chosenDecision"]', 'Yes');
  //     await page.click('button[type="submit"]');
  //     await page.waitForURL(/\/decisions/, { timeout: 10000 });
  //     await page.click('text=Complex decision');

  //     // Upload first attachment
  //     await page.click('button:has-text("Upload"), button:has-text("Attach")');
  //     await page.fill('input[name="title"]', 'Document 1');
  //     let fileInput = page.locator('input[type="file"]');
  //     await fileInput.setInputFiles(testFilePath);
  //     await page.click('button[type="submit"]');

  //     await wait(1000);

  //     // Upload second attachment
  //     await page.click('button:has-text("Upload"), button:has-text("Attach")');
  //     await page.fill('input[name="title"]', 'Document 2');
  //     fileInput = page.locator('input[type="file"]');
  //     await fileInput.setInputFiles(testFilePath);
  //     await page.click('button[type="submit"]');

  //     await wait(1000);

  //     // Should see both attachments in the UI
  //     await expect(page.locator('text=Document 1')).toBeVisible();
  //     await expect(page.locator('text=Document 2')).toBeVisible();
  //   });
  // });
});

