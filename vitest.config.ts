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
      exclude: ['**/*.test.ts', '**/__tests__/**', '**/index.ts', 'src/test-helpers/**'],
      // 라쳇: 목표치가 아니라 회귀 방지선이다. 2026-08-03 실측(37.43/30.58/47.52/37.94)에서
      // 1%p 여유만 두고 잠갔다 — 커버리지가 내려가면 CI 가 막는다.
      // 올라가면 이 숫자를 함께 올릴 것. 내리는 방향의 변경은 리뷰에서 정당화돼야 한다.
      thresholds: {
        statements: 36,
        branches: 29,
        functions: 46,
        lines: 36,
      },
    },
    // CLI 배너·스피너·가드 경고가 1700개 테스트 내내 stdout 으로 쏟아져
    // 실제 실패 신호를 덮었다. 통과한 테스트의 출력만 감추고 실패 시에는 그대로 보인다.
    silent: 'passed-only',
    setupFiles: ['./src/test-helpers/silence-tty.ts'],
    testTimeout: 10000,
    hookTimeout: 10000
  }
});
