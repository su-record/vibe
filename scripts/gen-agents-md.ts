/**
 * `CLAUDE.md` → `AGENTS.md` 생성 · 드리프트 게이트.
 *
 *   npm run gen:agents-md          # AGENTS.md 재생성
 *   npm run gen:agents-md:check    # 저장소 파일이 생성 결과와 같은가 (CI test job)
 *
 * 번역 규칙의 집은 `scripts/agents-md-rules.json` 하나다. 판정 로직은
 * `src/tools/docs/agentsMd.ts` 가 소유한다 — 이 스크립트는 파일을 읽고 쓴다.
 */
import fs from 'fs';
import path from 'path';
import { generateAgentsMd, type AgentsMdRules } from '../src/tools/docs/agentsMd.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE = path.join(ROOT, 'CLAUDE.md');
const TARGET = path.join(ROOT, 'AGENTS.md');
const RULES = path.join(ROOT, 'scripts', 'agents-md-rules.json');

function firstDiff(a: string, b: string): string {
  const la = a.split('\n');
  const lb = b.split('\n');
  for (let i = 0; i < Math.max(la.length, lb.length); i++) {
    if (la[i] !== lb[i]) {
      return `AGENTS.md:${i + 1}\n    저장소: ${JSON.stringify(lb[i] ?? '(없음)')}\n    생성값: ${JSON.stringify(la[i] ?? '(없음)')}`;
    }
  }
  return '(줄 단위 차이 없음 — 줄바꿈 문자 차이)';
}

function main(): void {
  const check = process.argv.includes('--check');
  const rules = JSON.parse(fs.readFileSync(RULES, 'utf-8')) as AgentsMdRules;
  const { output, findings } = generateAgentsMd(fs.readFileSync(SOURCE, 'utf-8'), rules);

  if (findings.length > 0) {
    console.error(`BROKEN RULES: ${findings.length} rule(s) in scripts/agents-md-rules.json`);
    for (const f of findings) console.error(`  ${f}`);
    console.error('CLAUDE.md 가 바뀌었는데 규칙이 따라오지 않았다 — 규칙의 find 를 현재 원문에 맞춘다.');
    process.exit(1);
  }

  if (!check) {
    fs.writeFileSync(TARGET, output, 'utf-8');
    console.log(`GENERATED: AGENTS.md (${output.split('\n').length} lines) from CLAUDE.md`);
    return;
  }

  const current = fs.readFileSync(TARGET, 'utf-8');
  if (current !== output) {
    console.error('DRIFT: AGENTS.md 가 CLAUDE.md 에서 생성한 결과와 다르다');
    console.error(`  ${firstDiff(output, current)}`);
    console.error('고칠 곳은 AGENTS.md 가 아니라 CLAUDE.md 다. 그 뒤 `npm run gen:agents-md` 로 재생성한다.');
    process.exit(1);
  }
  console.log('FRESH: AGENTS.md matches CLAUDE.md under scripts/agents-md-rules.json.');
}

main();
