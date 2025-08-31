import { test, expect } from '@playwright/test';

test('Apply batch and show canvas', async ({ page, baseURL }) => {
  await page.goto(baseURL!);
  await page.locator('textarea').fill('HTTP GET JSONPlaceholder');
  await page.getByRole('button', { name: /Preview Diff/i }).click();
  await expect(page.locator('h3')).toContainText('Diff Preview');
  // Apply
  await page.getByRole('button', { name: /^Apply$/ }).click();
  // After apply, lints or notification may appear; just ensure canvas exists
  await expect(page.locator('.canvas-wrapper')).toBeVisible();
  // Node with added class present
  await expect(page.locator('.node.added').first()).toBeVisible();
  // Connection path may be marked as added
  await expect(page.locator('svg.connections-layer path.connection.added').first()).toBeVisible();
});

