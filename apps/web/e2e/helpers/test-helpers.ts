/**
 * E2E Test Helpers
 *
 * Utility functions for Playwright E2E tests.
 */

import { Page } from '@playwright/test';

/**
 * Register a new user via the UI
 */
export async function registerUser(
  page: Page,
  email: string,
  password: string,
  name?: string,
): Promise<void> {
  await page.goto('/register');
  
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  
  if (name) {
    await page.fill('input[name="name"]', name);
  }
  
  await page.click('button[type="submit"]');
  
  // Wait for redirect to home
  await page.waitForURL('/', { timeout: 10000 });
}

/**
 * Login a user via the UI
 */
export async function loginUser(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login');
  
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  
  await page.click('button[type="submit"]');
  
  // Wait for redirect to home
  await page.waitForURL('/', { timeout: 10000 });
}

/**
 * Logout the current user via the UI
 */
export async function logoutUser(page: Page): Promise<void> {
  // Click sign out button (usually in header or on home page)
  await page.click('button:has-text("Sign Out")');

  // Wait for redirect to login page
  await page.waitForURL('/login', { timeout: 10000 });
}

/**
 * Create a decision via the UI
 */
export async function createDecision(
  page: Page,
  data: {
    situation: string;
    decision: string;
    reasoning?: string;
  },
): Promise<void> {
  await page.goto('/decisions');
  
  // Click "New Decision" button
  await page.click('button:has-text("New Decision"), a:has-text("New Decision")');
  
  // Fill in the form
  await page.fill('textarea[name="situation"]', data.situation);
  await page.fill('textarea[name="chosenDecision"]', data.decision);
  
  if (data.reasoning) {
    await page.fill('textarea[name="personalReasoning"]', data.reasoning);
  }
  
  // Submit the form
  await page.click('button[type="submit"]');
  
  // Wait for redirect to decision detail page or decisions list
  await page.waitForURL(/\/decisions/, { timeout: 10000 });
}

/**
 * Wait for an element to be visible
 */
export async function waitForElement(
  page: Page,
  selector: string,
  options?: { timeout?: number },
): Promise<void> {
  await page.waitForSelector(selector, {
    state: 'visible',
    timeout: options?.timeout || 10000,
  });
}

/**
 * Wait for text to appear on the page
 */
export async function waitForText(
  page: Page,
  text: string,
  options?: { timeout?: number },
): Promise<void> {
  await page.waitForSelector(`text=${text}`, {
    state: 'visible',
    timeout: options?.timeout || 10000,
  });
}

/**
 * Check if user is logged in by checking for auth-specific elements
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    // Check if we can see the home or sign out button
    await page.waitForSelector(
      'button:has-text("Sign Out")',
      { timeout: 2000 },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if user is on login page
 */
export async function isOnLoginPage(page: Page): Promise<boolean> {
  return page.url().includes('/login');
}

/**
 * Wait for API response
 */
export async function waitForAPIResponse(
  page: Page,
  urlPattern: string | RegExp,
  options?: { timeout?: number },
): Promise<void> {
  await page.waitForResponse(
    (response) => {
      const url = response.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    { timeout: options?.timeout || 10000 },
  );
}

/**
 * Get local storage value
 */
export async function getLocalStorage(
  page: Page,
  key: string,
): Promise<string | null> {
  return page.evaluate((k) => localStorage.getItem(k), key);
}

/**
 * Set local storage value
 */
export async function setLocalStorage(
  page: Page,
  key: string,
  value: string,
): Promise<void> {
  await page.evaluate(
    ({ k, v }) => localStorage.setItem(k, v),
    { k: key, v: value },
  );
}

/**
 * Clear local storage
 */
export async function clearLocalStorage(page: Page): Promise<void> {
  await page.evaluate(() => localStorage.clear());
}

/**
 * Take a screenshot with a custom name
 */
export async function takeScreenshot(
  page: Page,
  name: string,
): Promise<void> {
  await page.screenshot({
    path: `test-results/screenshots/${name}.png`,
    fullPage: true,
  });
}

/**
 * Wait for a specific amount of time
 */
export async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an action until it succeeds or times out
 */
export async function retry<T>(
  action: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    delay?: number;
    timeout?: number;
  },
): Promise<T> {
  const maxAttempts = options?.maxAttempts || 5;
  const delay = options?.delay || 1000;
  const timeout = options?.timeout || 30000;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await action();
    } catch (error) {
      if (Date.now() - startTime >= timeout) {
        throw new Error(`Timeout after ${timeout}ms`);
      }

      if (attempt === maxAttempts) {
        throw error;
      }

      await wait(delay);
    }
  }

  throw new Error('Retry failed');
}

