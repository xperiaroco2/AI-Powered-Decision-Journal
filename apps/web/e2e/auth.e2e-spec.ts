/**
 * Auth E2E Tests
 *
 * End-to-end tests for authentication flows.
 * Tests the full user journey from registration to logout.
 */

import { test, expect } from './fixtures';
import {
  registerUser,
  loginUser,
  logoutUser,
  isLoggedIn,
  isOnLoginPage,
} from './helpers/test-helpers';

test.describe('Auth E2E Tests', () => {

  test.describe('Registration Flow', () => {
    test('should register a new user successfully', async ({ page }) => {
      await page.goto('/register');

      // Fill in registration form
      await page.fill('input[name="email"]', 'newuser@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.fill('input[name="name"]', 'New User');

      // Submit form
      await page.click('button[type="submit"]');

      // Should redirect to home page (/) after successful registration
      await page.waitForURL('/', { timeout: 10000 });

      // Should see user email in the UI (indicating successful registration and login)
      await expect(page.locator('text=newuser@example.com')).toBeVisible();
    });

    test('should register without name', async ({ page }) => {
      await page.goto('/register');

      await page.fill('input[name="email"]', 'noname@example.com');
      await page.fill('input[name="password"]', 'password123');

      await page.click('button[type="submit"]');

      // Should redirect to home page after successful registration
      await page.waitForURL('/', { timeout: 10000 });

      // Should be logged in (verify by checking for sign out button or user menu)
      await expect(page.locator('button:has-text("Sign Out")')).toBeVisible();
    });

    test('should show error for duplicate email', async ({ page }) => {
      // Register first user
      await registerUser(page, 'duplicate@example.com', 'password123');

      // Logout
      await logoutUser(page);

      // Try to register again with same email
      await page.goto('/register');

      await page.fill('input[name="email"]', 'duplicate@example.com');
      await page.fill('input[name="password"]', 'different-password');

      await page.click('button[type="submit"]');

      // Should show error message
      await expect(
        page.locator('text=/already exists|email.*taken/i'),
      ).toBeVisible({ timeout: 5000 });

      // Should still be on register page
      expect(page.url()).toContain('/register');
    });

    test('should show error for invalid email', async ({ page }) => {
      await page.goto('/register');

      await page.fill('input[name="email"]', 'not-an-email');
      await page.fill('input[name="password"]', 'password123');

      await page.click('button[type="submit"]');

      // Should show validation error
      await expect(
        page.locator('text=/valid.*email|email.*valid/i'),
      ).toBeVisible({ timeout: 5000 });
    });

    test('should show error for weak password', async ({ page }) => {
      await page.goto('/register');

      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', '123'); // Too short

      await page.click('button[type="submit"]');

      // Should show validation error
      await expect(
        page.locator('text=/password.*6.*character/i'),
      ).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Login Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Create a test user
      await registerUser(page, 'testuser@example.com', 'password123', 'Test User');
      await logoutUser(page);
    });

    test('should login successfully with valid credentials', async ({ page }) => {
      await loginUser(page, 'testuser@example.com', 'password123');

      // Should be on home page after login
      expect(page.url()).toContain('/');

      // Should see user email (not name, as the home page displays email)
      await expect(page.locator('text=testuser@example.com')).toBeVisible();

      // Should be logged in
      expect(await isLoggedIn(page)).toBe(true);
    });

    test('should show error for invalid password', async ({ page }) => {
      await page.goto('/login');

      await page.fill('input[name="email"]', 'testuser@example.com');
      await page.fill('input[name="password"]', 'wrong-password');

      await page.click('button[type="submit"]');

      // Should show error message
      await expect(
        page.locator('text=/invalid.*credentials|incorrect.*password/i'),
      ).toBeVisible({ timeout: 5000 });

      // Should still be on login page
      expect(page.url()).toContain('/login');
    });

    test('should show error for non-existent user', async ({ page }) => {
      await page.goto('/login');

      await page.fill('input[name="email"]', 'nonexistent@example.com');
      await page.fill('input[name="password"]', 'password123');

      await page.click('button[type="submit"]');

      // Should show error message
      await expect(
        page.locator('text=/invalid.*credentials|user.*not.*found/i'),
      ).toBeVisible({ timeout: 5000 });
    });

    test('should persist session after page reload', async ({ page }) => {
      await loginUser(page, 'testuser@example.com', 'password123');

      // Reload the page
      await page.reload();

      // Should still be logged in
      expect(await isLoggedIn(page)).toBe(true);
    });
  });

  test.describe('Logout Flow', () => {
    test.beforeEach(async ({ page }) => {
      await registerUser(page, 'testuser@example.com', 'password123');
    });

    test('should logout successfully', async ({ page }) => {
      // Should be logged in
      expect(await isLoggedIn(page)).toBe(true);

      // Logout
      await logoutUser(page);

      // Should be on login page
      expect(await isOnLoginPage(page)).toBe(true);

      // Should not be logged in
      expect(await isLoggedIn(page)).toBe(false);
    });

    test('should not access protected routes after logout', async ({ page }) => {
      await logoutUser(page);

      // Try to access dashboard
      await page.goto('/dashboard');

      // Should redirect to login
      await page.waitForURL('/login', { timeout: 10000 });
    });
  });

  test.describe('Protected Routes', () => {
    test('should redirect to login when accessing protected route without auth', async ({ page }) => {
      await page.goto('/decisions');

      // Should redirect to login
      await page.waitForURL('/login', { timeout: 10000 });
    });

    test('should redirect to login when accessing decisions without auth', async ({ page }) => {
      await page.goto('/decisions');

      // Should redirect to login
      await page.waitForURL('/login', { timeout: 10000 });
    });

    test('should access protected routes when authenticated', async ({ page }) => {
      await registerUser(page, 'testuser@example.com', 'password123');

      // Should be able to access decisions
      await page.goto('/decisions');
      expect(page.url()).toContain('/decisions');
    });
  });

  test.describe('Session Management', () => {
    test('should maintain session across multiple pages', async ({ page }) => {
      await registerUser(page, 'testuser@example.com', 'password123');

      // Navigate to different pages
      await page.goto('/decisions');
      expect(await isLoggedIn(page)).toBe(true);

      await page.goto('/');
      expect(await isLoggedIn(page)).toBe(true);
    });

    test('should handle session expiry gracefully', async ({ page }) => {
      await registerUser(page, 'testuser@example.com', 'password123');

      // Clear cookies to simulate session expiry
      await page.context().clearCookies();

      // Try to access protected route
      await page.goto('/decisions');

      // Should redirect to login
      await page.waitForURL('/login', { timeout: 10000 });
    });
  });
});

