#!/usr/bin/env node
/**
 * 알림 훅 — 판정하지 않는다. 항상 exit 0.
 *
 *   post  PostToolUse(Edit|Write): `vibe state --json` 을 돌려 DONE 무효화·열린 인박스를 모델에게 알린다.
 *   pre   PreToolUse(Bash): 되돌릴 수 없는 명령인데 최근 authorize 기록이 없으면 stderr 로 경고한다.
 *
 * 훅이 없는 환경에서도 게이트는 같다 — 판정은 어디서든 `vibe check` 하나다.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2] || 'post';
const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, '..', 'dist', 'cli.js');
const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

function readPayload() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf-8'));
  } catch {
    return {};
  }
}

function emitContext(text) {
  process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: mode === 'post' ? 'PostToolUse' : 'PreToolUse', additionalContext: text } })}\n`);
}

const IRREVERSIBLE = [
  ['push', /\bgit\s+push\b/],
  ['deploy', /\b(vercel|netlify|fly|wrangler|gcloud|aws)\s+(deploy|apply|publish)\b|\bnpm\s+publish\b|\bkubectl\s+apply\b|\bterraform\s+apply\b/],
  ['send', /\b(sendmail|mail\s+-s|curl\s+[^|]*-X\s*POST)\b/],
  ['delete', /\brm\s+-rf\b|\bgit\s+push\s+[^|]*--force\b|\bDROP\s+TABLE\b/i],
];

function recentAuthorize(action) {
  try {
    const lines = fs.readFileSync(path.join(root, '.vibe', 'ledger.jsonl'), 'utf-8').trim().split('\n');
    const cutoff = Date.now() - 10 * 60 * 1000;
    return lines.some((line) => {
      try {
        const e = JSON.parse(line);
        return e.event === 'authorize' && String(e.detail || '').startsWith(`${action}:`) && new Date(e.at).getTime() >= cutoff;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

if (!fs.existsSync(path.join(root, '.vibe'))) process.exit(0);

if (mode === 'pre') {
  const payload = readPayload();
  const command = String((payload.tool_input && payload.tool_input.command) || '');
  for (const [action, re] of IRREVERSIBLE) {
    if (re.test(command) && !recentAuthorize(action)) {
      process.stderr.write(`[vibe] "${action}" 는 되돌릴 수 없는 행동인데 최근 10분 안에 authorize 기록이 없다 — \`vibe ask --needs authorize:${action}\` 로 사람 토큰을 받아 \`vibe authorize\` 를 먼저 한다\n`);
      break;
    }
  }
  process.exit(0);
}

if (!fs.existsSync(cli)) process.exit(0);
const result = spawnSync(process.execPath, [cli, 'state', '--json'], { cwd: root, encoding: 'utf-8', timeout: 15000 });
if (result.status !== 0 || !result.stdout) process.exit(0);
try {
  const view = JSON.parse(result.stdout);
  const notes = [...(view.notices || [])];
  if (view.inbox && view.inbox.open > 0) notes.push(`인박스에 답이 필요한 질문 ${view.inbox.open}건 — \`vibe inbox\``);
  if (notes.length > 0) emitContext(`[vibe] ${notes.join(' · ')}`);
} catch {
  // 조용히
}
process.exit(0);
