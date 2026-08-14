/**
 * 플러그인 훅의 단일 진입점 — 이중 실행을 막는다.
 *
 * 실측한 사건: vibe 를 npm 으로 설치하면 프로젝트에 `.claude/settings.local.json`
 * 훅 6개가 설치된다. 여기에 플러그인까지 설치하면 **같은 6개 이벤트가 두 벌** 등록돼
 * 모든 게이트가 2회 돌고, Stop 의 auto-commit·devlog 도 2회 돈다. 게이트가 두 번
 * 도는 건 느린 정도지만 커밋이 두 번 나는 건 되돌릴 일이 생긴다.
 *
 * 그래서 플러그인 훅은 전부 이 진입점을 거친다. 프로젝트에 vibe 훅이 이미 있으면
 * **플러그인 쪽이 물러난다** — 프로젝트 설정이 사용자가 명시적으로 설치한 것이고,
 * 경로도 그쪽이 정확하기 때문이다(플러그인 트리에는 node_modules 가 없다).
 *
 * 실행은 spawn 이 아니라 in-process `import` 다 — 훅 레이턴시 규약(CLAUDE.md
 * "dispatcher in-process 평탄화")을 플러그인 경로에서도 깨지 않는다.
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

/** 프로젝트에 vibe 훅이 이미 설치돼 있는가 — 있으면 플러그인은 실행하지 않는다 */
export function projectHooksInstalled(projectDir) {
  const settings = path.join(projectDir, '.claude', 'settings.local.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(settings, 'utf-8'));
    const hooks = parsed?.hooks;
    if (!hooks || typeof hooks !== 'object') return false;
    // vibe 훅인지까지 확인한다 — 사용자가 자기 훅만 넣어둔 경우에는 물러날 이유가 없다
    return JSON.stringify(hooks).includes('hooks/scripts/');
  } catch {
    return false;
  }
}

async function main() {
  const [, , script, ...rest] = process.argv;
  if (!script) {
    process.stderr.write('plugin-hook-entry: 실행할 스크립트가 지정되지 않았다\n');
    process.exit(0);   // 훅은 사용자 작업을 막지 않는다
  }

  if (projectHooksInstalled(process.cwd())) process.exit(0);

  const target = path.resolve(import.meta.dirname, script);
  if (!fs.existsSync(target)) {
    process.stderr.write(`plugin-hook-entry: 스크립트를 찾지 못했다 — ${target}\n`);
    process.exit(0);
  }

  // 대상 스크립트가 자기 argv 를 그대로 읽도록 맞춘다 (pre-tool-dispatcher.js Bash 등)
  process.argv = [process.argv[0], target, ...rest];
  await import(pathToFileURL(target).href);
}

// 테스트에서 import 할 때는 실행하지 않는다
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  await main();
}
