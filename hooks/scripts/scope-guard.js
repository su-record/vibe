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
import { buildCliCtx, isDirectRun } from './lib/hook-context.js';
import { globToRegExp } from './lib/glob.js';

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

function matchesAny(relPath, patterns) {
  return patterns.some(p => globToRegExp(p).test(relPath));
}

function toRelative(filePath) {
  if (!filePath) return '';
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(PROJECT_DIR, filePath);
  const rel = path.relative(path.resolve(PROJECT_DIR), abs).replace(/\\/g, '/');
  return rel || path.basename(filePath).replace(/\\/g, '/');
}

/**
 * in-process 진입점 — 디스패처가 ctx를 전달해 직접 호출.
 * @param {{ toolName: string, toolInput: string, filePath: string }} ctx
 * @returns {Promise<number>} exit code (0 = allow/no-op, 2 = block)
 */
export async function run(ctx) {
  const scope = readScope();
  if (!scope) return 0; // no scope declared → no-op

  const toolName = ctx.toolName;
  if (toolName !== 'Edit' && toolName !== 'Write') return 0;

  const filePath = ctx.filePath;
  if (!filePath) return 0;

  const rel = toRelative(filePath);

  // 평가 순서: deny 우선 → allow 검증
  const denied = scope.deny.length > 0 && matchesAny(rel, scope.deny);
  const allowed = scope.allow.length === 0 || matchesAny(rel, scope.allow);

  const violated = denied || !allowed;
  if (!violated) return 0;

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

  process.stderr.write(lines.join('\n') + '\n');
  logHookDecision('scope-guard', toolName, blocking ? 'block' : 'warn', `${rel} ${denied ? '(deny)' : '(out-of-allow)'}`);

  return blocking ? 2 : 0;
}

// standalone CLI 모드: stdin JSON 우선, argv 폴백
if (isDirectRun(import.meta.url)) {
  process.exit(await run(buildCliCtx()));
}
