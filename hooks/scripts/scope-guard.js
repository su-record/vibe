#!/usr/bin/env node
/**
 * Scope Guard — declared-scope enforcement for Edit/Write.
 *
 * CLAUDE.md의 Hard Rule "Modify only requested scope"를 훅으로 강제한다.
 * 사용자가 `.claude/vibe/scope.json`에 범위를 선언하면, Edit/Write가 그
 * 범위를 벗어날 때 경고(warn) 또는 차단(block)한다.
 *
 * 스코프 파일이 없거나 비어있으면 no-op — 기존 동작을 바꾸지 않는다.
 *
 * scope.json 스키마:
 * {
 *   "mode": "warn" | "block",      // default: "warn"
 *   "allow": ["src/cli/**"],       // glob 패턴 (둘 중 하나라도 있으면 allow-list 모드)
 *   "deny":  ["src/hooks/**"],     // glob 패턴 (allow 통과 후에도 deny 매칭 시 차단)
 *   "reason": "CLI refactor"       // 메시지에 표시
 * }
 *
 * 매칭 대상: tool_input.file_path (project-relative 또는 absolute 모두 허용)
 */

import fs from 'fs';
import path from 'path';
import { PROJECT_DIR, logHookDecision, projectVibePath, projectVibeRoot } from './utils.js';
import { emitPreToolDecision } from './lib/hook-output.js';

const SCOPE_PATH = projectVibePath(PROJECT_DIR, 'scope.json');

function readScope() {
  try {
    if (!fs.existsSync(SCOPE_PATH)) return null;
    const raw = fs.readFileSync(SCOPE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    const allow = Array.isArray(parsed.allow) ? parsed.allow : [];
    const deny = Array.isArray(parsed.deny) ? parsed.deny : [];
    if (allow.length === 0 && deny.length === 0) return null;
    return {
      mode: parsed.mode === 'block' ? 'block' : 'warn',
      allow,
      deny,
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
    };
  } catch {
    return null;
  }
}

/**
 * 경량 glob → RegExp 변환.
 *  - `**` : 경로 구분자 포함 임의 문자열
 *  - `*`  : 구분자 제외 임의 문자열
 *  - `?`  : 구분자 제외 한 글자
 *  - 기타 정규식 메타문자는 이스케이프
 */
function globToRegExp(glob) {
  const normalized = glob.replace(/\\/g, '/');
  let out = '';
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];
    if (c === '*') {
      if (normalized[i + 1] === '*') {
        out += '.*';
        i++;
        if (normalized[i + 1] === '/') i++; // `**/` → `.*`
      } else {
        out += '[^/]*';
      }
    } else if (c === '?') {
      out += '[^/]';
    } else if ('.+^$()|{}[]\\'.includes(c)) {
      out += '\\' + c;
    } else {
      out += c;
    }
  }
  return new RegExp('^' + out + '$');
}

function matchesAny(relPath, patterns) {
  return patterns.some(p => globToRegExp(p).test(relPath));
}

function toRelative(filePath) {
  if (!filePath) return '';
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(PROJECT_DIR, filePath);
  const rel = path.relative(path.resolve(PROJECT_DIR), abs).replace(/\\/g, '/');
  return rel || path.basename(filePath).replace(/\\/g, '/');
}

function readStdinSync() {
  try {
    if (process.stdin.isTTY) return null;
    const buf = Buffer.alloc(65536);
    const bytesRead = fs.readSync(0, buf, 0, buf.length, null);
    if (bytesRead > 0) return JSON.parse(buf.toString('utf-8', 0, bytesRead));
  } catch { /* ignore */ }
  return null;
}

function extractFilePath(toolInput) {
  if (!toolInput) return '';
  if (typeof toolInput === 'string') {
    try { return JSON.parse(toolInput).file_path || ''; }
    catch { return toolInput; }
  }
  return typeof toolInput.file_path === 'string' ? toolInput.file_path : '';
}

const scope = readScope();
if (!scope) process.exit(0); // no scope declared → no-op

const stdinPayload = readStdinSync();
const toolName = stdinPayload?.tool_name || process.argv[2] || '';
if (toolName !== 'Edit' && toolName !== 'Write') process.exit(0);

const rawInput = stdinPayload?.tool_input ?? process.argv[3] ?? process.env.TOOL_INPUT ?? '';
const filePath = extractFilePath(rawInput);
if (!filePath) process.exit(0);

const rel = toRelative(filePath);

// 평가 순서: deny 우선 → allow 검증
const denied = scope.deny.length > 0 && matchesAny(rel, scope.deny);
const allowed = scope.allow.length === 0 || matchesAny(rel, scope.allow);

const violated = denied || !allowed;
if (!violated) process.exit(0);

const lines = [];
lines.push(`🚧 SCOPE GUARD: ${toolName} — out of declared scope`);
lines.push(`  file: ${rel}`);
if (denied) lines.push(`  reason: matches deny pattern`);
else if (!allowed) lines.push(`  reason: not in allow list`);
if (scope.reason) lines.push(`  declared scope: ${scope.reason}`);
lines.push(`  declared in: ${path.relative(PROJECT_DIR, SCOPE_PATH)} (mode=${scope.mode})`);

const blocking = scope.mode === 'block';
if (blocking) {
  lines.push('');
  lines.push('🚫 BLOCKED. Edit scope.json or justify to the user before proceeding.');
}

// stderr 로 사용자 경고, stdout JSON 으로 assistant 구조화 신호
console.error(lines.join('\n'));
logHookDecision('scope-guard', toolName, blocking ? 'block' : 'warn', `${rel} ${denied ? '(deny)' : '(out-of-allow)'}`);

if (blocking) {
  emitPreToolDecision('block', `Out of declared scope: ${rel} ${denied ? '(deny)' : '(not in allow list)'}`, {
    systemMessage: scope.reason ? `Declared scope: ${scope.reason}` : undefined,
  });
}

process.exit(blocking ? 2 : 0);
