import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        'vitest.config.ts',
        // exclude root helper/entry files not under src
        'dev-server.ts',
        'integrate-ai-hooks.js',
        'introspect-api.ts',
        'load-builtin-nodes.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
  },
});