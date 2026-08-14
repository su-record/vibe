#!/usr/bin/env node
/**
 * Phase 3 — Recipe extractor (post-task curation)
 *
 * `/vibe.verify` 마지막 단계에서 호출됨. PostToolUse hot-path 가 아니라
 * 명시적 1회 호출이므로 LLM 호출 허용.
 *
 * 동작:
 *   1) `.vibe/metrics/current-run.jsonl` 읽기 (Phase 1 의 산출)
 *   2) 휴리스틱 게이트: total_tools ≥ 8 AND fail_count ≥ 3 (= 어렵게 푼 task)
 *   3) Haiku 로 3줄 요약 (When/Recipe/Anti-tip)
 *   4) `.vibe/recipes/<slug>.md` 작성 (frontmatter 강제)
 *
 * 안전성:
 *   - 모든 실패 silent — recipe 가 없는 게 잘못된 recipe 보다 낫다.
 *   - LLM 호출 재귀 가드: VIBE_HOOK_DEPTH (다른 hook 와 동일 패턴).
 *   - 테스트 모드: VIBE_RECIPE_LLM=mock 이면 LLM 스킵, 결정적 stub 사용.
 *
 * 사용:
 *   node hooks/scripts/recipe-extractor.js
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { PROJECT_DIR, projectVibePath, projectVibeRoot } from './utils.js';

const METRICS_DIR = projectVibePath(PROJECT_DIR, 'metrics');
const CURRENT_RUN_JSONL = path.join(METRICS_DIR, 'current-run.jsonl');
const CURRENT_RUN_JSON = path.join(METRICS_DIR, 'current-run.json');

// 휴리스틱 게이트 — SPEC 의 "Risk #1: LLM 호출 비용" 대응
const MIN_TOOLS = 8;
const MIN_FAILS = 3;

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

// ─────────────────────────────────────────────────────
// 재귀 가드
// ─────────────────────────────────────────────────────
function isRecursive() {
  const depth = parseInt(process.env.VIBE_HOOK_DEPTH || '0', 10);
  return depth >= 1;
}

// ─────────────────────────────────────────────────────
// jsonl 로드 + 게이트 평가
// ─────────────────────────────────────────────────────
function loadJsonl() {
  if (!fs.existsSync(CURRENT_RUN_JSONL)) return [];
  return fs.readFileSync(CURRENT_RUN_JSONL, 'utf-8')
    .split('\n').filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

function loadCurrentRunMeta() {
  try { return JSON.parse(fs.readFileSync(CURRENT_RUN_JSON, 'utf-8')); }
  catch { return { feature: null, startedAt: null, steps: 0 }; }
}

function evaluateGate(records) {
  const total = records.length;
  const fails = records.filter((r) => r.ok === false).length;
  const lastIsSuccess = records.length > 0 && records[records.length - 1].ok === true;
  const passes = total >= MIN_TOOLS && fails >= MIN_FAILS && lastIsSuccess;
  return { passes, total, fails };
}

// ─────────────────────────────────────────────────────
// LLM 프롬프트 빌드
// ─────────────────────────────────────────────────────
function buildPrompt(records, meta) {
  const tools = [...new Set(records.map((r) => r.tool))].join(', ');
  const failsByCategory = {};
  for (const r of records) {
    if (r.ok === false && r.error_category) {
      failsByCategory[r.error_category] = (failsByCategory[r.error_category] || 0) + 1;
    }
  }
  const failSummary = Object.entries(failsByCategory)
    .map(([cat, n]) => `${cat}×${n}`).join(', ') || 'none';

  // 최근 12개 호출만 — 토큰 절약
  const tail = records.slice(-12).map((r, i) => {
    const mark = r.ok ? '✓' : '✗';
    const cat = r.error_category ? ` [${r.error_category}]` : '';
    const file = r.target_file ? ` ${r.target_file}` : '';
    return `${i + 1}. ${mark} ${r.tool}${file}${cat}`;
  }).join('\n');

  return `You are summarizing a successfully completed task into a 3-line reusable recipe.

Task feature: ${meta.feature || 'unknown'}
Tool calls: ${records.length} total, ${failSummary}
Tools used: ${tools}

Last 12 calls (chronological):
${tail}

Output EXACTLY 3 lines of plain text, no markdown, no preamble:
LINE 1 — When to use this recipe (1 sentence, the situation/context)
LINE 2 — The working approach (1-2 sentences, what actually worked)
LINE 3 — Anti-tip: one thing to avoid (1 sentence)

Be specific — name the tools, the file types, the error categories. Do not output anything else.`;
}

// ─────────────────────────────────────────────────────
// claude CLI 호출 — --model 우선, fallback 가능
// ─────────────────────────────────────────────────────
let _modelFlagSupported = null;

function detectModelFlag() {
  if (_modelFlagSupported !== null) return _modelFlagSupported;
  try {
    const help = spawnSync('claude', ['--help'], { encoding: 'utf-8', timeout: 3000 });
    const out = (help.stdout || '') + (help.stderr || '');
    _modelFlagSupported = /--model\b/.test(out);
  } catch {
    _modelFlagSupported = false;
  }
  return _modelFlagSupported;
}

function callClaude(prompt) {
  if (process.env.VIBE_RECIPE_LLM === 'mock') {
    // 테스트용 결정적 stub
    return {
      ok: true,
      text: 'When auth + integration retries pile up.\nUse claude CLI with explicit model + retry on transient failures.\nAvoid swallowing stderr; surface error_category for downstream classification.',
    };
  }

  const args = ['--print', '--dangerously-skip-permissions'];
  if (detectModelFlag()) {
    args.unshift('--model', HAIKU_MODEL);
  }

  const env = { ...process.env, VIBE_HOOK_DEPTH: '1' };
  try {
    const r = spawnSync('claude', args, {
      input: prompt,
      encoding: 'utf-8',
      timeout: 60_000,
      env,
    });
    if (r.status !== 0) return { ok: false, text: '' };
    const text = (r.stdout || '').trim();
    if (!text) return { ok: false, text: '' };
    return { ok: true, text };
  } catch {
    return { ok: false, text: '' };
  }
}

// ─────────────────────────────────────────────────────
// Recipe md 작성
// ─────────────────────────────────────────────────────
function timestampSlug() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function safeFeature(name) {
  if (!name) return 'anon';
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'anon';
}

function writeRecipe({ records, meta, summary }) {
  const vibeRoot = projectVibeRoot(PROJECT_DIR);
  const dir = path.join(vibeRoot, 'recipes');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const slug = `${safeFeature(meta.feature)}__${timestampSlug()}`;
  const file = path.join(dir, `${slug}.md`);
  if (fs.existsSync(file)) return null; // 동시 호출 dedup

  const today = new Date().toISOString().slice(0, 10);
  const tools = [...new Set(records.map((r) => r.tool))];
  const failCount = records.filter((r) => r.ok === false).length;

  // summary 가 3줄 보장 안 되면 채워서 안전화
  const lines = summary.split('\n').map((l) => l.trim()).filter(Boolean);
  while (lines.length < 3) lines.push('—');
  const [whenLine, recipeLine, antiTip] = lines.slice(0, 3);

  const body =
`---
slug: ${slug}
type: recipe
symptom-context: "${(meta.feature || 'unknown').replace(/"/g, '\\"')}"
recipe: "${recipeLine.replace(/"/g, '\\"')}"
tools-touched: [${tools.map((t) => JSON.stringify(t)).join(', ')}]
retry-count-saved: ${failCount}
created: ${today}
source-run: "${meta.startedAt || 'unknown'}"
confidence: low
---

# Recipe: ${meta.feature || 'unknown'}

## When to use
${whenLine}

## What worked
${recipeLine}

## Avoid
${antiTip}

## Stats
- Total tool calls: ${records.length}
- Failures before success: ${failCount}
- Tools touched: ${tools.join(', ')}
- Source run started: ${meta.startedAt || 'unknown'}

> Auto-generated by \`recipe-extractor.js\` from \`.vibe/metrics/current-run.jsonl\`. \
Confidence \`low\` — single observation. Increment to \`medium\`/\`high\` when the same recipe is seen multiple times across runs.
`;

  fs.writeFileSync(file, body);
  return file;
}

// ─────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────
function main() {
  if (isRecursive()) return; // claude CLI 가 다시 우리 hook 을 트리거하는 것 방지

  let records;
  try { records = loadJsonl(); } catch { return; }
  if (records.length === 0) return;

  const gate = evaluateGate(records);
  if (!gate.passes) return;

  const meta = loadCurrentRunMeta();
  const prompt = buildPrompt(records, meta);
  const llm = callClaude(prompt);
  if (!llm.ok) return;

  try { writeRecipe({ records, meta, summary: llm.text }); }
  catch { /* silent */ }
}

try { main(); } catch { /* never throw */ }
process.exit(0);
