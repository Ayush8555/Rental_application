import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['test/setup-env.ts'],
    globalSetup: ['test/global-setup.ts'],
    // Tests share one database, so files run one after another.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Thin wrappers around Firebase/S3/Turnstile need the real services and are
      // exercised on staging instead (docs/PROGRESS.md).
      exclude: ['src/generated/**', 'src/server.ts', 'src/worker.ts', 'src/cli/**', 'src/services/firebase.ts'],
      reporter: ['text-summary', 'html'],
      thresholds: { lines: 80, functions: 75 },
    },
  },
});
