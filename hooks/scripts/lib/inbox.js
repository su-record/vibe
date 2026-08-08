/**
 * 루프 인박스 — 사람 리뷰 큐(`.vibe/loops/inbox.md`) 기록.
 *
 * loop-history.jsonl 은 결정론적으로 기록되는데 인박스만 모델이 마크다운을 직접
 * prepend 하고 있었다 (감사 2026-07-28 L5). 블록 형식과 최신순 정렬을 코드가 보장한다.
 *
 * fail-open — 기록 실패가 루프를 멈추지 않는다.
 */
import fs from 'fs';
import path from 'path';
import { projectVibePath } from '../utils.js';

const HEADER = '# Loop Inbox\n\n> 루프가 남긴 사람 리뷰 큐. 최신 항목이 위에 온다.\n';

/**
 * 인박스 경로 — 이 모듈이 소유한다.
 *
 * 쓰기는 항상 `.vibe/` 로 한다(신규 레이아웃). 읽기는 레거시(`.claude/vibe/`)도
 * 봐야 하므로 `projectVibePath` 를 쓴다 — 두 쪽이 다른 파일을 보면 기록은 되는데
 * ANCHOR 는 못 읽는 상태가 된다.
 */
export function inboxPath(projectDir) {
  return projectVibePath(projectDir, 'loops', 'inbox.md');
}

/**
 * 인박스 블록을 최상단에 prepend 한다.
 *
 * @param {string} projectDir
 * @param {{ loop: string, result: 'ok'|'fail'|'stuck', at: string, lines?: string[] }} entry
 *        at 은 호출자가 넘긴다 — 이 모듈은 시각을 직접 읽지 않는다 (테스트 결정성)
 * @returns {boolean} 성공 여부
 */
export function prependInboxBlock(projectDir, entry) {
  try {
    if (!entry?.loop || !entry?.result || !entry?.at) return false;

    const body = (entry.lines ?? []).map(l => `- ${l}`).join('\n');
    const block = `## ${entry.loop} — ${entry.at} — ${entry.result}\n${body}\n`;

    const target = inboxPath(projectDir);
    fs.mkdirSync(path.dirname(target), { recursive: true });

    const existing = fs.existsSync(target) ? fs.readFileSync(target, 'utf-8') : '';
    const blocksStart = existing.indexOf('## ');
    const head = blocksStart === -1 ? HEADER : existing.slice(0, blocksStart);
    const rest = blocksStart === -1 ? '' : existing.slice(blocksStart);

    fs.writeFileSync(target, `${head}\n${block}\n${rest}`.replace(/\n{3,}/g, '\n\n'), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

/**
 * 아직 처리되지 않은 블록 수 — `## ` 로 시작하는 줄의 개수.
 * @param {string} projectDir
 * @returns {number}
 */
export function countInboxBlocks(projectDir) {
  try {
    const raw = fs.readFileSync(inboxPath(projectDir), 'utf-8');
    return raw.split('\n').filter(l => l.startsWith('## ')).length;
  } catch {
    return 0;
  }
}
