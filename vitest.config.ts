import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';

/** Strip shebangs from hook scripts so vitest can parse them */
function stripShebang(): Plugin {
  return {
    name: 'strip-shebang',
    transform(code: string, id: string) {
      if (id.includes('hooks') && code.startsWith('#!')) {
        return { code: code.replace(/^#![^\n]*\n/, ''), map: null };
      }
    },
  };
}

export default defineConfig({
  plugins: [stripShebang()],
  test: {
    globals: true,
    environment: 'node',
    pool: 'vmForks',
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
