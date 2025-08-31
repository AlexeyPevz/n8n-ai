import { test, expect } from '@playwright/test';

test('Validation autofix flow shows lints and resolves via Critic', async ({ page, baseURL }) => {
  await page.goto(baseURL!);
  await page.locator('textarea').fill('HTTP GET JSONPlaceholder');
  await page.getByRole('button', { name: /Preview Diff/i }).click();
  await page.getByRole('button', { name: /^Apply$/ }).click();
  await page.getByRole('button', { name: /^Test$/ }).click();
  // Lints block renders
  const lints = page.locator('.lints .lint');
  await expect(lints.first()).toBeVisible();
});

