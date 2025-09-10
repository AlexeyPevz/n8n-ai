import { test, expect } from '@playwright/test';

test.describe('AI Panel UI', () => {
  test('renders and shows plan/diff elements', async ({ page, baseURL }) => {
    await page.goto(baseURL!);
    await expect(page.locator('h2')).toHaveText(/AI Panel/i);

    // type prompt and click Plan
    await page.locator('textarea').fill('HTTP GET JSONPlaceholder');
    await page.getByRole('button', { name: /Plan/i }).click();
    await expect(page.locator('h3')).toContainText('Plan');

    // click Preview Diff
    await page.getByRole('button', { name: /Preview Diff/i }).click();
    await expect(page.locator('h3')).toContainText('Diff Preview');

    // diff summary badges appear or raw JSON is shown
    const possible = page.locator('.changes .chg');
    await expect(possible.first()).toBeVisible({ timeout: 5000 });
  });
});

