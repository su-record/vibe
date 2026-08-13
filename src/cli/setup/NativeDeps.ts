/**
 * 네이티브 의존성 자기복구.
 *
 * WHY: npm 12 는 `allowScripts` 정책으로 **install 스크립트를 기본 차단**한다.
 *
 *     npm warn rebuild 1 package had install scripts blocked
 *     better-sqlite3@12.11.1 (install: prebuild-install || node-gyp rebuild --release)
 *
 * 그래서 `npm i -g @su-record/vibe` 는 성공하는데 `better-sqlite3` 의 네이티브
 * 바인딩(`build/Release/better_sqlite3.node`)은 끝내 생기지 않는다. 설치는 ✅ 인데
 * 메모리·RAG·sentinel 이 매 훅마다 "Could not locate the bindings file" 로 죽는다 —
 * postinstall 이 통째로 건너뛰어졌던 것과 **같은 뿌리**이고, 그때와 같은 결론을 쓴다:
 * npm 이 실행해주길 기다리지 말고 우리가 직접 실행한다.
 *
 * 복구는 `prebuild-install` 을 npm 라이프사이클 밖에서 직접 돌린다. `.bin/` 심링크가
 * 아니라 JS 엔트리를 `process.execPath` 로 실행하는 이유는 셸·확장자(.cmd) 차이를
 * 타지 않기 위해서다 — `runInstalledPostinstall` 과 같은 방식.
 */
import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

/** 네이티브 바인딩이 필요한 런타임 의존성 — 이름 → 있어야 하는 산출물 */
const NATIVE_DEPS = [
  { name: 'better-sqlite3', artifact: join('build', 'Release', 'better_sqlite3.node') },
] as const;

/** prebuild-install 의 JS 엔트리 (bin 심링크 대신 직접 실행한다) */
const PREBUILD_ENTRY = join('prebuild-install', 'bin.js');

/**
 * 바인딩이 빠진 네이티브 의존성 목록.
 *
 * 패키지 자체가 없으면 **누락이 아니다** — 설치되지 않은 선택 의존성과
 * 설치됐는데 빌드가 안 된 상태는 다른 사건이다. 후자만 복구 대상이다.
 */
export function missingNativeDeps(packageRoot: string): string[] {
  const modules = join(packageRoot, 'node_modules');
  return NATIVE_DEPS
    .filter(({ name, artifact }) =>
      existsSync(join(modules, name)) && !existsSync(join(modules, name, artifact)))
    .map(({ name }) => name);
}

/**
 * 빠진 바인딩을 내려받아 복구한다.
 *
 * @returns 복구된 것과 실패한 것 — 실패는 숨기지 않는다. 조용히 실패하면
 *          "설치 성공" 이 또 거짓말이 된다.
 */
export function repairNativeDeps(packageRoot: string): { repaired: string[]; failed: string[] } {
  const modules = join(packageRoot, 'node_modules');
  const prebuild = join(modules, PREBUILD_ENTRY);
  const repaired: string[] = [];
  const failed: string[] = [];

  for (const name of missingNativeDeps(packageRoot)) {
    const dir = join(modules, name);
    try {
      if (!existsSync(prebuild)) throw new Error(`prebuild-install not found: ${prebuild}`);
      execFileSync(process.execPath, [prebuild], { cwd: dir, stdio: 'ignore', timeout: 180_000 });
    } catch {
      /* 아래 재확인이 결과를 판정한다 — 종료 코드가 아니라 산출물이 기준이다 */
    }
    (missingNativeDeps(packageRoot).includes(name) ? failed : repaired).push(name);
  }

  return { repaired, failed };
}

/**
 * 복구 실패 시 사용자가 직접 쓸 명령 — npm 정책을 푸는 쪽이 근본 처방이다.
 *
 * `npm install-scripts approve` 를 안내하면 안 된다(실측). 그건 승인을 **설치된
 * 패키지 자신의 package.json** 에 쓰는데, 그 파일은 다음 `npm i -g` 가 게시본으로
 * 덮어쓴다 — 업그레이드 한 번이면 승인이 사라진다. 같은 이유로 `allowScripts` 를
 * 우리 package.json 에 담아 게시해도 무의미하다(전역 설치에서 무시됨을 확인).
 *
 * 유일하게 지속되는 형태는 사용자 레벨 npm config 다.
 */
export function nativeDepHint(names: string[]): string {
  return `npm config set allow-scripts=${names.join(',')} --location=user`
    + ` && npm install -g @su-record/vibe@latest --force`;
}
