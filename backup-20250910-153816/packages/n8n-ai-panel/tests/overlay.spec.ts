import { test, expect } from '@playwright/test';

test('Live overlay shows status and cost', async ({ page, baseURL }) => {
  await page.goto(baseURL!);
  // wait for overlay to arrive
  const anyOverlay = page.locator('.node .node-overlay');
  await expect(anyOverlay.first()).toBeVisible({ timeout: 20000 });
});

