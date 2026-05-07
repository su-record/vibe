#!/usr/bin/env node
/**
 * PostToolUse Hook — 툴콜 스텝 카운터 + 패턴 로거 (Phase 1)
 *
 * 책임 1) 모든 성공 툴콜을 1 스텝으로 집계 → `current-run.json`
 *        ↳ /vibe.verify 가 history.jsonl에 append 후 출력
 * 책임 2) 각 툴콜 한 줄을 `current-run.jsonl` 에 append (post-task-curation SPEC)
 *        ↳ Phase 2 의 3-fail detector, Phase 3 의 recipe extractor 가 소비
 *
 * 두 책임은 독립 — 어느 한쪽 실패가 다른 쪽을 막지 않는다.
 * PostToolUse 는 hot path 이므로 LLM 호출/외부 spawn 금지, fs 만 사용.
 *
 * 스키마 — current-run.jsonl (한 줄 = 한 툴콜):
 *   {
 *     ts: ISO-8601,
 *     tool: string,                 // tool_name (Bash/Edit/Write/Read 등)
 *     ok: boolean,                  // tool_response 가 error 였는지
 *     target_file: string|null,     // best-effort, normalize 된 상대 경로
 *     error_category: string|null,  // Phase 2 에서 채움 (현재 null)
 *   }
 */
import fs from 'fs';
import path from 'path';
import { PROJECT_DIR, projectVibePath } from './utils.js';

const METRICS_DIR = projectVibePath(PROJECT_DIR, 'metrics');
const CURRENT_RUN_JSON = path.join(METRICS_DIR, 'current-run.json');
const CURRENT_RUN_JSONL = path.join(METRICS_DIR, 'current-run.jsonl');
const MAX_JSONL_LINES = 5000; // 안전 상한 — 넘으면 회전

// ─────────────────────────────────────────────────────
// stdin / env 에서 PostToolUse payload 추출
// 다른 hook (scope-guard, sentinel-guard) 와 동일한 fallback 순서.
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
  // Edit/Write/Read 류는 file_path, NotebookEdit 은 notebook_path
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
  // Claude Code 스키마: { is_error: bool, ... } 또는 .error / .errors
  if (typeof toolResponse === 'object') {
    if (toolResponse.is_error === true) return true;
    if (toolResponse.error) return true;
    if (Array.isArray(toolResponse.errors) && toolResponse.errors.length > 0) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────
// 책임 1: current-run.json 카운터
// ─────────────────────────────────────────────────────
function bumpCounter() {
  let data = { feature: null, startedAt: null, steps: 0 };
  if (fs.existsSync(CURRENT_RUN_JSON)) {
    try {
      data = JSON.parse(fs.readFileSync(CURRENT_RUN_JSON, 'utf-8'));
    } catch { /* 손상 → 새로 시작 */ }
  }
  if (!data.startedAt) data.startedAt = new Date().toISOString();
  data.steps = (data.steps || 0) + 1;
  fs.writeFileSync(CURRENT_RUN_JSON, JSON.stringify(data, null, 2));
}

// ─────────────────────────────────────────────────────
// 책임 2: current-run.jsonl append (Phase 1 — 로깅만)
// ─────────────────────────────────────────────────────
function appendJsonl(stdinPayload) {
  const toolName = stdinPayload?.tool_name || process.argv[2] || '';
  if (!toolName) return; // 신원 미상이면 적지 않음

  const toolInput = parseToolInput(stdinPayload?.tool_input ?? process.env.TOOL_INPUT);
  const ok = !isResponseError(stdinPayload?.tool_response);

  const record = {
    ts: new Date().toISOString(),
    tool: toolName,
    ok,
    target_file: extractTargetFile(toolInput),
    error_category: null, // Phase 2 채움
  };

  fs.appendFileSync(CURRENT_RUN_JSONL, JSON.stringify(record) + '\n');

  // 회전: 라인 수가 상한 초과 시 마지막 절반만 남김 (순환버퍼 흉내).
  // /vibe.run 시작에서 truncate 안 해도 안전하도록.
  try {
    const stat = fs.statSync(CURRENT_RUN_JSONL);
    if (stat.size > 2 * 1024 * 1024) { // 2MB 초과 시만 검사 (성능)
      const lines = fs.readFileSync(CURRENT_RUN_JSONL, 'utf-8').split('\n').filter(Boolean);
      if (lines.length > MAX_JSONL_LINES) {
        const keep = lines.slice(-Math.floor(MAX_JSONL_LINES / 2));
        fs.writeFileSync(CURRENT_RUN_JSONL, keep.join('\n') + '\n');
      }
    }
  } catch { /* 회전 실패는 무시 */ }
}

// ─────────────────────────────────────────────────────
// 메인 — 두 책임을 독립적으로 try
// ─────────────────────────────────────────────────────
try {
  if (!fs.existsSync(METRICS_DIR)) {
    fs.mkdirSync(METRICS_DIR, { recursive: true });
  }

  const stdinPayload = readStdinSync();

  try { bumpCounter(); } catch { /* 카운터 실패 무시 */ }
  try { appendJsonl(stdinPayload); } catch { /* 로깅 실패 무시 */ }
} catch {
  // Never block on counter failure
}
process.exit(0);
