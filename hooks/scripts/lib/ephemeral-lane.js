/**
 * 일회성 코드 레인 — 생성·실행 후 폐기되는 코드에 durable 코드의 무게를 지우지 않는다.
 *
 * ## 이 파일이 대부분 방어인 이유
 *
 * 이 레인은 원래 "열지 말자" 로 판단했던 것이다. 사유 둘 중 하나가 **게이트 회피 구멍**이었다:
 * "이건 일회성이라 린트 면제" 를 모델이 판정하면 축이 아니라 뒷문이고, 뒷문은 바쁠 때 쓰인다.
 *
 * 그래서 단 하나의 규칙으로 막는다: **판정을 모델이 아니라 경로가 한다.**
 * 경로가 판정하면 면제 대상이 `ls` 하나로 감사되고, 그 경로는 커밋될 수 없다.
 *
 * ## 방어 순서 (과장하지 않는다)
 *
 * 1. **`.gitignore`** — 1차 방어. `git add` 는 무시된 경로를 그냥 거부한다
 * 2. **`pre-tool-guard`** — 심층 방어. 실제로 뚫리는 경로는 `git add -f` 하나뿐이고 그것을 막는다.
 *    훅은 프로젝트 로컬이라 미설치가 흔하므로 이것을 1차라고 부르지 않는다
 *
 * ## fail-safe (fail-open 아님)
 *
 * 훅은 보통 fail-open 이다 — 판정 실패가 작업을 막지 않는다. 여기는 반대로 판정에 실패하면
 * **일회성이 아니라고 답한다.** 모르면 면제하지 않는 쪽이 안전하다: 잘못된 면제는 조용히
 * 품질 게이트를 끄지만, 잘못된 비면제는 검사가 한 번 더 도는 것뿐이다.
 */

import path from 'path';

/** 유일한 일회성 경로 — 설정으로 열지 않는다. 설정 가능한 면제 경로는 프로젝트마다 다른 뒷문이 된다 */
export const EPHEMERAL_DIR = '.vibe/ephemeral';

/**
 * 프로젝트 기준 상대 경로로 정규화한다 (구분자 통일 + `..` 해소 + 절대/상대 통일).
 *
 * `path.resolve` 로 양쪽을 절대 경로로 만든 뒤 `path.relative` 를 쓴다 — 문자열 접두사
 * 비교로는 부족하다. 훅의 `PROJECT_DIR` 은 `CLAUDE_PROJECT_DIR` 미설정 시 `'.'` 이라
 * (utils.js), 접두사만 보면 절대 경로로 들어온 파일이 프로젝트 밖으로 판정된다.
 */
function toProjectRelative(filePath, projectDir) {
  const normalized = String(filePath).replace(/\\/g, '/');
  const base = path.resolve(String(projectDir || '.').replace(/\\/g, '/'));
  return path.relative(base, path.resolve(base, normalized)).replace(/\\/g, '/');
}

/**
 * 이 경로가 일회성 레인 안인가.
 *
 * **정규화 후** 접두사를 본다 — `.vibe/ephemeral/../src/x.ts` 는 `.vibe/src/x.ts` 가 되어
 * 거짓이다. 상위 탈출로 면제를 훔칠 수 없어야 한다.
 *
 * @param {string} filePath
 * @param {string} [projectDir] 주면 그 아래 절대 경로도 인식한다
 * @returns {boolean}
 */
export function isEphemeralPath(filePath, projectDir) {
  try {
    if (!filePath) return false;
    const rel = toProjectRelative(filePath, projectDir);
    if (!rel || rel.startsWith('../') || path.isAbsolute(rel)) return false; // 프로젝트 밖
    return rel === EPHEMERAL_DIR || rel.startsWith(`${EPHEMERAL_DIR}/`);
  } catch {
    return false; // fail-safe — 모르면 면제하지 않는다
  }
}

/** `git add|stage|commit` 구간의 인자만 훑는다 (`;`·`&&`·`|` 로 끊는다) */
const GIT_STAGING_RE = /\bgit\s+(?:add|stage|commit)\b([^;&|]*)/gi;

/** 한 git 구간의 인자에서 일회성 경로만 고른다 (중첩을 얕게 유지하려고 분리했다) */
function ephemeralArgsIn(segment) {
  const found = [];
  for (const rawArg of String(segment).split(/\s+/)) {
    const arg = rawArg.replace(/^["']|["']$/g, '').trim();
    if (arg && !arg.startsWith('-') && isEphemeralPath(arg)) found.push(arg);
  }
  return found;
}

/**
 * git 스테이징 명령줄에서 일회성 경로를 뽑는다.
 *
 * `git add .` · `git add -A` 는 걸러내지 않는다 — gitignore 가 이미 거르고, 여기서 막으면
 * 정상 커밋이 전부 멈춘다. 멈추는 게이트는 꺼진다.
 *
 * @param {string} command
 * @returns {string[]} 명령에 명시된 일회성 경로들
 */
export function ephemeralPathsInGitCommand(command) {
  try {
    const found = [];
    for (const match of String(command || '').matchAll(GIT_STAGING_RE)) {
      found.push(...ephemeralArgsIn(match[1]));
    }
    return found;
  } catch {
    return []; // fail-safe — 판정 실패가 커밋을 막지 않는다
  }
}

/** 차단 메시지 — 이유 없는 차단은 우회된다. 무엇을·왜·대안을 함께 낸다 */
export function formatEphemeralBlock(paths) {
  return [
    `[EPHEMERAL] 일회성 경로를 커밋하려 한다: ${paths.join(', ')}`,
    `  ${EPHEMERAL_DIR}/ 는 생성·실행 후 폐기되는 코드의 자리다. 품질 게이트를 면제받는 대신`,
    '  커밋되지 않는다 — 면제받은 코드가 배포되면 그 면제가 곧 구멍이 된다.',
    '  남겨야 하는 코드라면 이 경로 밖으로 옮기고 평소 게이트를 통과시켜라.',
  ].join('\n');
}
