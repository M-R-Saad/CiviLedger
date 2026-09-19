import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests share one Postgres database and one chain; running
    // files in parallel would have them truncate each other's tables.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 180_000,
    include: ['src/**/*.test.ts'],
  },
});
