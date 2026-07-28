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
      // `src/lib` 은 존재하지 않는 경로였다 — 인프라는 `src/infra/lib` 에 있고,
      // 그 결과 인프라 전체가 커버리지 측정에서 조용히 빠져 있었다.
      include: ['src/infra/**/*.ts', 'src/tools/**/*.ts', 'src/cli/**/*.ts'],
      exclude: ['**/*.test.ts', '**/__tests__/**', '**/index.ts', 'src/test-helpers/**']
    },
    testTimeout: 10000,
    hookTimeout: 10000
  }
});
