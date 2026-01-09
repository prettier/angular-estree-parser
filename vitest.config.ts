import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['**/*.test.ts'],
    snapshotSerializers: ['jest-snapshot-serializer-raw'],
    coverage: {
      reporter: ['lcov', 'text'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/helpers.ts'],
      thresholds: {
        branches: 95,
        functions: 100,
        lines: 95,
        statements: 95,
      },
    },
  },
});
