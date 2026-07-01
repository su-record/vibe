#!/usr/bin/env node
/**
 * sync-agent-models.ts — agents/(**)/*.md 의 `## Model` 섹션을
 * CLAUDE_MODEL_MAPPING(단일 SSOT)와 동기화한다.
 *
 * WHY: 모델 할당은 src/cli/postinstall/constants.ts > CLAUDE_MODEL_MAPPING 이
 * 유일 SSOT 다(postinstall 이 이 맵을 읽어 설치 시 frontmatter `model:` 을 주입).
 * 과거에는 각 agents/*.md 가 제목·`## Model`·Task() 예시에 모델명을 손으로 박아
 * 매핑과 드리프트했다(예: ui-* 는 문서상 Haiku 지만 매핑은 sonnet). 이 스크립트가
 * `## Model` 섹션을 매핑 기준으로 재작성하고 제목의 버전 표기를 제거한다.
 *
 * Usage:
 *   npx tsx scripts/sync-agent-models.ts          # 재작성 (파일 수정)
 *   npx tsx scripts/sync-agent-models.ts --check   # 드리프트 검출 (있으면 exit 1)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const AGENTS_DIR = path.join(ROOT, 'agents');
const CONSTANTS_FILE = path.join(ROOT, 'src', 'cli', 'postinstall', 'constants.ts');

/** 매핑 tier → 문서 표기 (버전 없이 tier 만 — 매핑 granularity 와 일치) */
const DISPLAY: Record<string, string> = {
  haiku: 'Haiku',
  sonnet: 'Sonnet',
  opus: 'Opus',
  inherit: 'Inherit',
};

/** `## Model` 섹션이 비어있거나 신규 삽입일 때 쓰는 기본 설명 */
const DEFAULT_NOTE: Record<string, string> = {
  haiku: 'Fast, lightweight tasks',
  sonnet: 'Balanced reasoning and quality',
  opus: 'Deep reasoning for complex work',
  inherit: "Inherits the caller's model",
};

const SEP = ' — ';

/** 기존 모델 라인 파싱: `[-] **Model[ 4.5]** [(inherit)] [-—:] note` */
const MODEL_LINE_RE =
  /^\s*-?\s*\*\*(Haiku|Sonnet|Opus|Inherit)(?:\s+[\d.]+)?\*\*\s*(?:\(inherit\))?\s*[-—:]\s*(.+?)\s*$/i;

/** 제목 끝의 버전 박힌 괄호 표기 `(Haiku 4.5)` → `(Haiku)` */
const TITLE_MODEL_RE = /\((Haiku|Sonnet|Opus|Inherit)\s+[\d.]+\)/i;

export function loadModelMapping(): Record<string, string> {
  const content = fs.readFileSync(CONSTANTS_FILE, 'utf-8');
  const block = content.match(/CLAUDE_MODEL_MAPPING[^{]*\{([\s\S]*?)\n\};/);
  if (!block) throw new Error('CLAUDE_MODEL_MAPPING not found in constants.ts');
  const map: Record<string, string> = {};
  for (const m of block[1].matchAll(/'([\w-]+)':\s*'([\w-]+)'/g)) {
    map[m[1]] = m[2];
  }
  return map;
}

export function listAgentFiles(dir: string = AGENTS_DIR): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listAgentFiles(full));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out.sort();
}

/** tier + (선택) 기존 라인 → 정규화된 모델 라인. 기존 note 는 보존한다. */
function canonicalLine(tier: string, existingFirstLine?: string): string {
  const display = DISPLAY[tier] ?? DISPLAY.sonnet;
  let note = DEFAULT_NOTE[tier] ?? DEFAULT_NOTE.sonnet;
  if (existingFirstLine) {
    const m = existingFirstLine.match(MODEL_LINE_RE);
    if (m && m[2].trim()) note = m[2].trim();
  }
  return `**${display}**${SEP}${note}`;
}

/** `## Model` 섹션이 없는 파일에 삽입 (Role 섹션 뒤 → 없으면 첫 `## ` 앞) */
function insertModelSection(lines: string[], tier: string): string[] {
  const block = ['## Model', '', canonicalLine(tier), ''];
  const roleIdx = lines.findIndex((l) => /^##\s+Role\s*$/.test(l));
  let insertAt: number;
  if (roleIdx !== -1) {
    insertAt = lines.findIndex((l, i) => i > roleIdx && /^##\s/.test(l));
  } else {
    insertAt = lines.findIndex((l) => /^##\s/.test(l));
  }
  if (insertAt === -1) insertAt = lines.length;
  return [...lines.slice(0, insertAt), ...block, ...lines.slice(insertAt)];
}

/** 한 파일을 매핑 tier 에 맞춰 동기화. { changed, content } 반환. */
export function syncFile(file: string, tier: string): { changed: boolean; content: string } {
  const orig = fs.readFileSync(file, 'utf-8');
  let lines = orig.split('\n');

  // 1) 제목의 버전 박힌 모델 표기 제거 (예: "(Sonnet 4)" → "(Sonnet)")
  if (lines[0] && /^#\s/.test(lines[0])) {
    lines[0] = lines[0].replace(TITLE_MODEL_RE, (_m, name: string) => `(${name})`);
  }

  // 2) `## Model` 섹션 정규화
  const headingIdx = lines.findIndex((l) => /^##\s+Model\s*$/.test(l));
  if (headingIdx === -1) {
    lines = insertModelSection(lines, tier);
  } else {
    let i = headingIdx + 1;
    while (i < lines.length && !/^##\s/.test(lines[i]) && lines[i].trim() === '') i++;
    const hasBody = i < lines.length && !/^##\s/.test(lines[i]);
    if (hasBody) {
      lines[i] = canonicalLine(tier, lines[i]); // 첫 모델 라인만 교체 — 나머지 보존
    } else {
      lines.splice(headingIdx + 1, 0, '', canonicalLine(tier));
    }
  }

  const content = lines.join('\n');
  return { changed: content !== orig, content };
}

/** 드리프트된 파일 목록 (repo 상대경로) */
export function findDrift(): string[] {
  const map = loadModelMapping();
  const drifted: string[] = [];
  for (const file of listAgentFiles()) {
    const tier = map[path.basename(file, '.md')];
    if (!tier) continue;
    if (syncFile(file, tier).changed) drifted.push(path.relative(ROOT, file));
  }
  return drifted;
}

function main(): void {
  const check = process.argv.includes('--check');
  const map = loadModelMapping();
  const files = listAgentFiles();
  const drifted: string[] = [];
  const unmapped: string[] = [];

  for (const file of files) {
    const tier = map[path.basename(file, '.md')];
    if (!tier) {
      unmapped.push(path.relative(ROOT, file));
      continue;
    }
    const { changed, content } = syncFile(file, tier);
    if (!changed) continue;
    drifted.push(path.relative(ROOT, file));
    if (!check) fs.writeFileSync(file, content);
  }

  for (const f of unmapped) console.warn(`SKIP (no CLAUDE_MODEL_MAPPING entry): ${f}`);

  if (check) {
    if (drifted.length > 0) {
      console.error(
        `STALE: ${drifted.length} agent file(s) out of sync with CLAUDE_MODEL_MAPPING:\n  ${drifted.join('\n  ')}\nRun: npm run sync:agent-models`
      );
      process.exit(1);
    }
    console.log(`FRESH: all ${files.length} agent model sections in sync.`);
    return;
  }

  console.log(
    drifted.length > 0
      ? `Synced ${drifted.length} file(s):\n  ${drifted.join('\n  ')}`
      : `No changes (${files.length} files already in sync).`
  );
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) main();
