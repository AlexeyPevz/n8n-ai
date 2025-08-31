import { test, expect } from '@playwright/test';

test('Git export returns stub message', async ({ page, baseURL }) => {
  await page.goto(baseURL!);
  await page.locator('textarea').fill('HTTP GET JSONPlaceholder');
  await page.getByRole('button', { name: /Preview Diff/i }).click();
  await page.getByRole('button', { name: /^Apply$/ }).click();
  await page.getByRole('button', { name: /Git Export/i }).click();
  await expect(page.locator('.git-msg')).toBeVisible();
});

