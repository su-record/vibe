import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'hooks/scripts/__tests__/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**/*.ts', 'src/tools/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts']
    },
    testTimeout: 10000,
    hookTimeout: 10000
  }
});
