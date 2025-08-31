import { test, expect } from '@playwright/test';

test('SSE progress appears after page load', async ({ page, baseURL }) => {
  await page.goto(baseURL!);
  // Wait for SSE to initialize; progress appears (0..100) in the bar or pct
  const pct = page.locator('.progress .pct');
  await expect(pct).toBeVisible({ timeout: 15000 });
});

