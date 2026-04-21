#!/usr/bin/env node
/**
 * PostToolUse failure detector — 도구 실패를 regression 시스템에 자동 등록.
 *
 * Claude Code 의 `PostToolUse` 페이로드는 `tool_response` 를 포함:
 *   - Edit/Write 의 구조적 실패 (old_string not found, file not writable …)
 *   - Bash 의 non-zero exit (테스트 실패, 린트 실패, 빌드 실패 …)
 *
 * CLAUDE.md Quality-loop commands:
 *   "/vibe.regress — 버그 기록 → 예방 테스트 자동 생성 → 패턴 클러스터링"
 * 기존 자동 트리거: `/vibe.verify` 실패 시에만 발동.
 *
 * 이 훅: 도구 단위 실패도 동일 파이프라인으로 흘려보내 회귀 자산화.
 *
 * 등록 조건 (false positive 방지):
 *   - Bash: exit_code !== 0 AND 커맨드가 test/lint/build 계열
 *   - Edit/Write: tool_response.success === false 또는 error 필드 존재
 *
 * 덮어쓰기 방지: slug = auto-{tool}-{cmd-hash-6} → 동일 실패는 파일 하나로 병합.
 * 기존 resolved 상태면 다시 open 으로 돌리지 않음.
 *
 * 컨피그:
 *   `.vibe/config.json` { "regress": { "autoRegisterOnFailure": false } } 로 끌 수 있음.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PROJECT_DIR, projectVibeRoot, projectVibePath, logHookDecision } from './utils.js';
import { readHookPayload } from './lib/hook-output.js';

// 테스트/품질 커맨드 패턴 — 여기 매칭되는 Bash 실패만 등록 (범용 Bash 실패는 노이즈)
const QUALITY_CMD_RE =
  /\b(npm|pnpm|yarn|bun)\s+(run\s+)?(test|check|lint|typecheck|build|verify)\b|\b(vitest|jest|tsc|eslint|biome)\b/i;

function loadConfig() {
  try {
    const p = projectVibePath(PROJECT_DIR, 'config.json');
    if (!fs.existsSync(p)) return {};
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch { return {}; }
}

/** 커맨드/파일 경로 + 에러 시그니처로 중복 제거용 짧은 해시 */
function sigHash(parts) {
  return crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 6);
}

/** Bash tool_response 에서 실패 여부와 요약 추출 */
function interpretBashResponse(input, response) {
  if (!response || typeof response !== 'object') return null;
  const exitCode = response.exit_code ?? response.exitCode ?? response.code;
  const stderr = typeof response.stderr === 'string' ? response.stderr : '';
  const stdout = typeof response.stdout === 'string' ? response.stdout : '';
  const isError = response.is_error === true || response.isError === true;
  const cmd = (input && typeof input === 'object' && typeof input.command === 'string') ? input.command : '';

  const failed = isError || (typeof exitCode === 'number' && exitCode !== 0);
  if (!failed) return null;
  if (!cmd || !QUALITY_CMD_RE.test(cmd)) return null;

  const errBody = (stderr || stdout || '').split('\n').filter(Boolean).slice(-8).join('\n');
  return {
    tool: 'Bash',
    command: cmd,
    exitCode: exitCode ?? 'nonzero',
    errSummary: errBody.slice(0, 500),
    symptom: `Bash failure on quality command: ${cmd.slice(0, 80)}`,
  };
}

/** Edit/Write tool_response 에서 구조적 실패 감지 */
function interpretEditWriteResponse(toolName, input, response) {
  if (!response || typeof response !== 'object') return null;
  const failed = response.success === false || response.is_error === true
    || typeof response.error === 'string' || typeof response.error_message === 'string';
  if (!failed) return null;
  const filePath = (input && typeof input === 'object' && typeof input.file_path === 'string') ? input.file_path : 'unknown';
  const errMsg = response.error || response.error_message || 'Edit/Write failed (no error message)';
  return {
    tool: toolName,
    command: filePath,
    exitCode: 'structural',
    errSummary: String(errMsg).slice(0, 500),
    symptom: `${toolName} failure on ${filePath}`,
  };
}

/** regression .md 작성 (덮어쓰기 안전) */
function writeRegressionRecord(details) {
  const root = projectVibeRoot();
  const dir = path.join(root, 'regressions');
  fs.mkdirSync(dir, { recursive: true });

  const hash = sigHash([details.tool, details.command, details.errSummary.slice(0, 80)]);
  const slug = `auto-${details.tool.toLowerCase()}-${hash}`;
  const file = path.join(dir, `${slug}.md`);

  // 이미 resolved 상태면 재오픈 안 함
  if (fs.existsSync(file)) {
    const existing = fs.readFileSync(file, 'utf-8');
    if (/^status:\s*resolved\s*$/m.test(existing)) return null;
    return slug; // 중복 open 은 등록만 건너뜀
  }

  const today = new Date().toISOString().slice(0, 10);
  const feature = inferFeature();
  const body = [
    '---',
    `slug: ${slug}`,
    `symptom: ${JSON.stringify(details.symptom)}`,
    `root-cause-tag: other`,
    `fix-commit: pending`,
    `test-path: pending`,
    `status: open`,
    `registered: ${today}`,
    `feature: ${feature}`,
    `source: post-tool-failure-hook`,
    '---',
    '',
    '## Reproduction',
    '',
    '```',
    details.command,
    '```',
    '',
    `**Exit**: ${details.exitCode}`,
    '',
    '## Error output',
    '',
    '```',
    details.errSummary,
    '```',
    '',
    '## Root cause',
    '',
    '_To be investigated._',
    '',
    '## Fix',
    '',
    '_Pending. Run `/vibe.regress generate ' + slug + '` after fixing._',
    '',
  ].join('\n');

  fs.writeFileSync(file, body);
  return slug;
}

/** 현재 feature 추론 — .vibe/features/current 또는 git branch */
function inferFeature() {
  try {
    const currentFile = path.join(projectVibeRoot(), 'features', 'current');
    if (fs.existsSync(currentFile)) return fs.readFileSync(currentFile, 'utf-8').trim() || 'unknown';
  } catch { /* ignore */ }
  return 'unknown';
}

// ─── Main ───────────────────────────────────────────────────────────

if (process.env.VIBE_HOOK_DEPTH) process.exit(0);

const cfg = loadConfig();
if (cfg?.regress?.autoRegisterOnFailure === false) process.exit(0);

const payload = await readHookPayload();
if (!payload) process.exit(0);

const toolName = payload.tool_name;
const toolInput = payload.tool_input;
const toolResponse = payload.tool_response;

let details = null;
if (toolName === 'Bash') {
  details = interpretBashResponse(toolInput, toolResponse);
} else if (toolName === 'Edit' || toolName === 'Write') {
  details = interpretEditWriteResponse(toolName, toolInput, toolResponse);
}

if (!details) process.exit(0);

const slug = writeRegressionRecord(details);
if (slug) {
  logHookDecision('post-tool-failure', toolName, 'register', `slug=${slug}`);
  // 사용자 알림은 stderr — assistant 컨텍스트에 주입 금지 (루프 유발)
  process.stderr.write(`[regress] auto-registered: ${slug} — run \`/vibe.regress generate ${slug}\` after fix\n`);
}

process.exit(0);
