import { test, expect } from '@playwright/test';

test('Critic button reduces lints after Test', async ({ page, baseURL }) => {
  await page.goto(baseURL!);
  await page.locator('textarea').fill('HTTP GET JSONPlaceholder');
  await page.getByRole('button', { name: /Preview Diff/i }).click();
  await page.getByRole('button', { name: /^Apply$/ }).click();
  await page.getByRole('button', { name: /^Test$/ }).click();
  const lints = page.locator('.lints .lint');
  const initial = await lints.count();
  // Try critic via error card action if present
  const actionBtn = page.locator('.error-card .action').first();
  if (await actionBtn.isVisible()) {
    await actionBtn.click();
  }
  // Re-run Test
  await page.getByRole('button', { name: /^Test$/ }).click();
  await expect(lints).toHaveCountLessThan(initial);
});

