import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 45000,
  reporter: [['list']],
  use: {
    baseURL: process.env.UI_BASE || 'http://localhost:3001',
    headless: true,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  outputDir: 'test-results',
  expect: {
    timeout: 15000,
  },
});

