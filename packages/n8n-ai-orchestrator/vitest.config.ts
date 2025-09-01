import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000, // 30 seconds for E2E tests
    hookTimeout: 30000,
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['src/**/*.e2e.test.ts', 'src/rest*.e2e.test.ts', 'src/**/rest*.e2e.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        'vitest.config.ts',
        'src/test-server.ts',
        'src/ai/**', // Exclude AI module until ready
        'src/server.ts',
        'src/routes/**',
        'src/plugins/**',
        'src/interfaces/**',
        'src/security/**/security-routes.ts',
        'src/pagination/**/pagination-routes.ts',
        'src/workflow-map/**/map-routes.ts',
      ],
      thresholds: {
        lines: 40,
        functions: 60,
        branches: 60,
        statements: 40,
      },
    },
  },
});