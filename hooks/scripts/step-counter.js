#!/usr/bin/env node
/**
 * PostToolUse Hook — 툴콜 스텝 카운터 + 패턴 로거 + 3-fail 감지기
 *
 * hooks.json matcher: "Edit|Write|Bash|Task|SlashCommand|NotebookEdit"
 * → Read/Grep/Glob/WebFetch/WebSearch/TodoWrite/ToolSearch/ListMcpResourcesTool
 *   는 matcher 단에서 제외되어 이 프로세스 자체가 spawn 되지 않는다.
 *   아래 READ_ONLY_TOOLS 는 defense-in-depth 용 추가 가드이다.
 *
 * 책임 1) 액션 툴콜을 1 스텝으로 집계 → `current-run.json`
 *        ↳ /vibe.verify 가 history.jsonl에 append 후 출력
 *        ↳ recipe-extractor 가 meta(startedAt, steps) 소비
 *        [쓰기 스로틀] current-run.json 전체 재작성은 (a) 마지막 재작성 후
 *        ≥2초 경과, 또는 (b) 10이벤트마다 1회로 제한.
 *        액션 툴(Edit/Write/Bash) 호출 + ≥2초 조건을 동시 충족할 때도 재작성.
 *        Stop 경로 등 최종 상태가 필요한 소비자는 staleness ≤10 이벤트를 허용.
 * 책임 2) 각 툴콜 한 줄을 `current-run.jsonl` 에 append (항상 즉시 — 스로틀 없음)
 *        ↳ Phase 3 의 recipe extractor 가 소비
 * 책임 3) (Phase 2) 실패 메시지 분류 + 같은 (file, category) 3회 반복 감지 →
 *        `.vibe/anti-patterns/<slug>.md` 로 자동 저장.
 *
 * 세 책임은 독립 — 어느 한쪽 실패가 다른 쪽을 막지 않는다.
 * PostToolUse 는 hot path 이므로 LLM 호출/외부 spawn 금지, fs 만 사용.
 */
import fs from 'fs';
import path from 'path';
import { PROJECT_DIR, projectVibePath } from './utils.js';

const METRICS_DIR = projectVibePath(PROJECT_DIR, 'metrics');
const ANTI_PATTERNS_DIR = projectVibePath(PROJECT_DIR, 'anti-patterns');
const CURRENT_RUN_JSON = path.join(METRICS_DIR, 'current-run.json');
const CURRENT_RUN_JSONL = path.join(METRICS_DIR, 'current-run.jsonl');
const MAX_JSONL_LINES = 5000;
const FAIL_WINDOW = 10;
const FAIL_THRESHOLD = 3;

// 스로틀 파라미터
const REWRITE_INTERVAL_MS = 2000; // 최소 재작성 간격
const REWRITE_EVERY_N = 10;       // N이벤트마다 강제 재작성

// 읽기 전용 툴 — defense-in-depth (matcher 단에서 이미 제거됨)
const READ_ONLY_TOOLS = new Set([
  'Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch',
  'TodoWrite', 'ToolSearch', 'ListMcpResourcesTool',
]);

// ─────────────────────────────────────────────────────
// stdin / env 에서 PostToolUse payload 추출
// ─────────────────────────────────────────────────────
function readStdinSync() {
  try {
    if (process.stdin.isTTY) return null;
    const buf = Buffer.alloc(65536);
    const bytesRead = fs.readSync(0, buf, 0, buf.length, null);
    if (bytesRead > 0) return JSON.parse(buf.toString('utf-8', 0, bytesRead));
  } catch { /* ignore */ }
  return null;
}

function parseToolInput(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw;
}

function extractTargetFile(toolInput) {
  const fp = toolInput.file_path || toolInput.notebook_path || toolInput.path || null;
  if (!fp) return null;
  try {
    const abs = path.isAbsolute(fp) ? fp : path.resolve(PROJECT_DIR, fp);
    const rel = path.relative(path.resolve(PROJECT_DIR), abs).replace(/\\/g, '/');
    return rel || path.basename(fp);
  } catch {
    return fp;
  }
}

function isResponseError(toolResponse) {
  if (!toolResponse) return false;
  if (typeof toolResponse === 'object') {
    if (toolResponse.is_error === true) return true;
    if (toolResponse.error) return true;
    if (Array.isArray(toolResponse.errors) && toolResponse.errors.length > 0) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────
// 책임 3a: error_category 분류 (regex 만 — regress tag enum 일부)
// ─────────────────────────────────────────────────────
const ERROR_CATEGORIES = [
  { tag: 'nullability', re: /Cannot read propert(?:y|ies) of (?:undefined|null)|TypeError[^\n]*(?:undefined|null)/i },
  { tag: 'type-narrow', re: /\bTS2345\b|not assignable to (?:parameter|type)/i },
  { tag: 'compilation', re: /\bTS\d{4}\b|cannot find name|build failed|compilation (?:error|failed)/i },
  { tag: 'syntax', re: /SyntaxError|Unexpected token/i },
  { tag: 'integration', re: /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|connect failed/i },
  { tag: 'auth', re: /\b(?:401|403)\b|unauthori[sz]ed|forbidden|invalid (?:token|credentials)/i },
  { tag: 'permission', re: /EACCES|permission denied/i },
  { tag: 'not-found', re: /ENOENT|no such file|not found/i },
];

function classifyError(toolResponse) {
  if (!toolResponse) return null;
  let text;
  if (typeof toolResponse === 'string') text = toolResponse;
  else if (toolResponse.error) text = String(toolResponse.error);
  else if (Array.isArray(toolResponse.errors)) text = JSON.stringify(toolResponse.errors);
  else if (toolResponse.content) text = JSON.stringify(toolResponse.content);
  else text = JSON.stringify(toolResponse);

  for (const { tag, re } of ERROR_CATEGORIES) {
    if (re.test(text)) return tag;
  }
  return 'other';
}

// ─────────────────────────────────────────────────────
// 스로틀: current-run.json 재작성 여부 결정
// ─────────────────────────────────────────────────────
/**
 * 재작성해야 하는지 판단.
 * - jsonlLineCount: jsonl 에 추가한 후의 총 라인 수 (이벤트 카운터 대리)
 * - toolName: Edit/Write/Bash 인 경우 mtime 조건 충족 시 강제 재작성
 * @param {string} toolName
 * @param {number} jsonlLineCount
 * @returns {boolean}
 */
function shouldRewriteJson(toolName, jsonlLineCount) {
  // N이벤트마다 강제 재작성 (race-tolerant — jsonl 줄 수가 카운터 역할)
  if (jsonlLineCount % REWRITE_EVERY_N === 0) return true;

  // 마지막 재작성 후 ≥2초 경과 여부 (mtime 기반)
  try {
    const stat = fs.statSync(CURRENT_RUN_JSON);
    const elapsed = Date.now() - stat.mtimeMs;
    if (elapsed >= REWRITE_INTERVAL_MS) return true;
  } catch {
    // 파일 없음 → 첫 쓰기, 허용
    return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────
// 책임 1: current-run.json 카운터 (스로틀 적용)
//
// steps 는 current-run.jsonl 의 라인 수에서 파생한다.
// 이렇게 하면 스로틀로 재작성을 건너뛰어도 재작성 시점에
// 정확한 steps 가 보장되며, 프로세스간 누적도 자연스럽게 처리된다.
// ─────────────────────────────────────────────────────
function bumpCounter(toolName, currentLineCount) {
  if (!shouldRewriteJson(toolName, currentLineCount)) return; // 스로틀 — 재작성 생략

  let data = { feature: null, startedAt: null, steps: 0 };
  if (fs.existsSync(CURRENT_RUN_JSON)) {
    try {
      data = JSON.parse(fs.readFileSync(CURRENT_RUN_JSON, 'utf-8'));
    } catch { /* 손상 → 새로 시작 */ }
  }
  if (!data.startedAt) data.startedAt = new Date().toISOString();
  // steps = jsonl 라인 수에서 파생 (매 재작성 시 최신값 보장)
  data.steps = currentLineCount;

  // 원자적 쓰기 (tmp → rename) — 동시 에이전트 파일 손상 방지
  const tmp = CURRENT_RUN_JSON + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, CURRENT_RUN_JSON);
  } catch {
    // rename 실패 시 직접 쓰기 (fail-open)
    try { fs.writeFileSync(CURRENT_RUN_JSON, JSON.stringify(data, null, 2)); } catch { /* ignore */ }
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
  }
}

// ─────────────────────────────────────────────────────
// 책임 2: current-run.jsonl append + error_category 채움
// 항상 즉시 append — 스로틀 없음 (3-fail detector, recipe-extractor 가 소비)
// ─────────────────────────────────────────────────────
function appendJsonl(stdinPayload) {
  const toolName = stdinPayload?.tool_name || process.argv[2] || '';
  if (!toolName) return null;

  const toolInput = parseToolInput(stdinPayload?.tool_input ?? process.env.TOOL_INPUT);
  const ok = !isResponseError(stdinPayload?.tool_response);
  const errorCategory = ok ? null : classifyError(stdinPayload?.tool_response);

  const record = {
    ts: new Date().toISOString(),
    tool: toolName,
    ok,
    target_file: extractTargetFile(toolInput),
    error_category: errorCategory,
  };

  fs.appendFileSync(CURRENT_RUN_JSONL, JSON.stringify(record) + '\n');

  // 회전: 라인 수가 상한 초과 시 마지막 절반만 남김.
  try {
    const stat = fs.statSync(CURRENT_RUN_JSONL);
    if (stat.size > 2 * 1024 * 1024) {
      const lines = fs.readFileSync(CURRENT_RUN_JSONL, 'utf-8').split('\n').filter(Boolean);
      if (lines.length > MAX_JSONL_LINES) {
        const keep = lines.slice(-Math.floor(MAX_JSONL_LINES / 2));
        fs.writeFileSync(CURRENT_RUN_JSONL, keep.join('\n') + '\n');
      }
    }
  } catch { /* 회전 실패는 무시 */ }

  return record;
}

/**
 * jsonl 의 현재 라인 수를 반환 (stat 으로만 — 전체 파일 읽기 없음).
 * 경합 안전 — 정확한 값이 아니어도 스로틀 판단에 충분하다.
 */
function jsonlLineCount() {
  try {
    // 라인 수 근사: 파일 크기 / 평균 라인 길이(100바이트) — 정확도 불필요
    // 실제 라인 수는 appendJsonl 직후 여기서 읽으면 +1 반영됨
    const content = fs.readFileSync(CURRENT_RUN_JSONL, 'utf-8');
    return content.split('\n').filter(Boolean).length;
  } catch {
    return 1; // 파일 없음 → 첫 이벤트로 간주
  }
}

// ─────────────────────────────────────────────────────
// 책임 3b: 3-fail detector → anti-pattern md
// ─────────────────────────────────────────────────────
const SUGGESTED_STOPS = {
  nullability: '같은 위치 null/undefined 처리 반복 — 타입 가드 또는 옵셔널 체이닝 필요',
  'type-narrow': '같은 위치 타입 좁히기 반복 — 타입 정의 점검 필요',
  compilation: '컴파일 실패 반복 — 타입/임포트 정의 확인 필요',
  syntax: '구문 오류 반복 — 파서 호환성/버전 확인 필요',
  integration: '외부 서비스 연결 실패 반복 — endpoint/포트/네트워크 점검 필요',
  auth: '인증 실패 반복 — 토큰/자격증명 점검 필요',
  permission: '권한 실패 반복 — 파일/디렉토리 권한 점검 필요',
  'not-found': '리소스 부재 반복 — 경로/존재 확인 필요',
  other: '같은 패턴 실패 반복 — 접근 방식 재검토 필요',
};

function fileSlug(targetFile) {
  if (!targetFile) return 'global';
  return targetFile.replace(/[\/\.]/g, '-');
}

function readTailWindow() {
  if (!fs.existsSync(CURRENT_RUN_JSONL)) return [];
  const raw = fs.readFileSync(CURRENT_RUN_JSONL, 'utf-8').split('\n').filter(Boolean);
  return raw.slice(-FAIL_WINDOW).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
}

function detectThreeFail() {
  const window = readTailWindow();
  const groups = new Map();
  for (const r of window) {
    if (r.ok || !r.error_category) continue;
    const key = `${r.target_file ?? 'null'}::${r.error_category}`;
    const cur = groups.get(key) ?? 0;
    groups.set(key, cur + 1);
  }
  for (const [key, count] of groups) {
    if (count >= FAIL_THRESHOLD) {
      const sep = key.indexOf('::');
      const file = key.slice(0, sep);
      const cat = key.slice(sep + 2);
      return { category: cat, targetFile: file === 'null' ? null : file, count };
    }
  }
  return null;
}

function writeAntiPattern({ category, targetFile, count }) {
  if (!fs.existsSync(ANTI_PATTERNS_DIR)) {
    fs.mkdirSync(ANTI_PATTERNS_DIR, { recursive: true });
  }
  const today = new Date().toISOString().slice(0, 10);
  const dateSlug = today.replace(/-/g, '');
  const fSlug = fileSlug(targetFile);
  const slug = `${category}__${fSlug}__${dateSlug}`;
  const filePath = path.join(ANTI_PATTERNS_DIR, `${slug}.md`);
  if (fs.existsSync(filePath)) return; // dedup

  const trigger = `(file=${targetFile ?? 'null'}, category=${category})`;
  const stop = SUGGESTED_STOPS[category] ?? SUGGESTED_STOPS.other;
  const content = `---
slug: ${slug}
type: anti-pattern
root-cause-tag: ${category}
trigger-signature: "${trigger}"
fail-count: ${count}
suggested-stop: "${stop}"
created: ${today}
---

## Trigger
${trigger} 이 ${FAIL_WINDOW} 툴콜 윈도우 내 ${count} 회 발생.

## Suggested Stop
${stop}

> 자동 생성 — 같은 패턴 반복 시 다른 접근법을 고려하거나 사용자에게 조언을 구할 것.
`;
  fs.writeFileSync(filePath, content);
}

// ─────────────────────────────────────────────────────
// 메인 — 세 책임을 독립적으로 try
// ─────────────────────────────────────────────────────
try {
  if (!fs.existsSync(METRICS_DIR)) {
    fs.mkdirSync(METRICS_DIR, { recursive: true });
  }

  const stdinPayload = readStdinSync();
  const toolName = stdinPayload?.tool_name || process.argv[2] || '';

  // defense-in-depth: 읽기 전용 툴은 조기 종료 (matcher 단에서 이미 제거됨)
  if (toolName && READ_ONLY_TOOLS.has(toolName)) {
    process.exit(0);
  }

  // 책임 2를 먼저 실행 — jsonl 라인 수가 bumpCounter 스로틀 판단에 쓰임
  let lastRecord = null;
  try { lastRecord = appendJsonl(stdinPayload); } catch { /* 로깅 실패 무시 */ }

  // 책임 1: jsonl append 후 라인 수로 스로틀 판단
  const lineCount = jsonlLineCount();
  try { bumpCounter(toolName, lineCount); } catch { /* 카운터 실패 무시 */ }

  // 책임 3
  try {
    if (lastRecord && !lastRecord.ok && lastRecord.error_category) {
      const trip = detectThreeFail();
      if (trip) writeAntiPattern(trip);
    }
  } catch { /* anti-pattern 작성 실패 무시 */ }
} catch {
  // Never block on counter failure
}
process.exit(0);
