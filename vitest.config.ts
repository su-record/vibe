import { defineConfig } from 'vitest/config';

// bench/tasks holds fixtures for the bench itself — including test files judged by `node --test`,
// not vitest — so they must never be picked up as part of this repository's own test suite.
export default defineConfig({
  test: {
    maxWorkers: 2,
    exclude: ['**/node_modules/**', '**/dist/**', 'bench/tasks/**'],
  },
});
