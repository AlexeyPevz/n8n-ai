import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  use: {
    baseURL: process.env.UI_BASE || 'http://localhost:3001',
    headless: true,
  },
});

