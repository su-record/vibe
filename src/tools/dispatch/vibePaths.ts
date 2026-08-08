/**
 * vibe 상태 경로 소유자 (TS 측).
 *
 * 훅 측에는 `hooks/scripts/utils.js` 의 `projectVibeRoot`/`projectVibePath` 가 있는데,
 * TS 도구들이 그것을 쓸 수 없어 `.vibe/` 를 각자 하드코딩했다. 그 결과 레거시
 * 프로젝트(`.claude/vibe/`)에서 읽는 쪽만 조용히 빗나갔다 — 실제로 ANCHOR 가
 * `.last-feature` 를 못 찾아 feature·spec·scope 를 전부 missing 으로 보고했다.
 *
 * 두 런타임이 **같은 해석 규칙**을 갖도록 여기에 미러링한다.
 * 규칙: 읽기는 `.vibe/` → `.claude/vibe/` 순으로 존재하는 쪽, 쓰기는 항상 `.vibe/`.
 */
import fs from 'fs';
import path from 'path';

/** 읽기용 루트 — 존재하는 레거시 경로를 우선 반환, 없으면 `.vibe/` */
export function projectVibeRoot(projectDir: string): string {
  try {
    const modern = path.join(projectDir, '.vibe');
    if (fs.existsSync(modern)) return modern;
    const legacy = path.join(projectDir, '.claude', 'vibe');
    if (fs.existsSync(legacy)) return legacy;
  } catch { /* 접근 불가 → 신규 레이아웃으로 취급 */ }
  return path.join(projectDir, '.vibe');
}

/** 읽기용 경로 — 레거시 인식 */
export function projectVibePath(projectDir: string, ...sub: string[]): string {
  return path.join(projectVibeRoot(projectDir), ...sub);
}

/** 쓰기용 경로 — 항상 신규 레이아웃(`.vibe/`) */
export function projectVibePathPreferred(projectDir: string, ...sub: string[]): string {
  return path.join(projectDir, '.vibe', ...sub);
}
