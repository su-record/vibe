#!/usr/bin/env node
/**
 * validate-counts.ts — README / package.json 의 capability count claim 검증
 *
 * 검증 대상:
 *   - skillCount:          skills/ 하위 디렉토리 중 SKILL.md 가 있는 디렉토리 수
 *   - installedAgentCount: agents/ 에서 teams/ 와 CONDITIONAL_AGENT_GROUPS
 *                          (ui, figma, event) 를 제외한 .md 파일 수
 *                          (postinstall 의 전역 설치 대상과 동일한 기준)
 *
 * 검사 대상 파일:
 *   - README.md           — "**N개 스킬**" / "**40+ 에이전트**" 형식
 *   - README.en.md        — "**N skills**" / "**40+ agents**" 형식
 *   - package.json        — description 필드의 "N skills" / "N+ agents" 토큰
 *
 * 위반 시 exit code 1.
 *
 * Usage:
 *   npx tsx scripts/validate-counts.ts
 *
 * Note: CI 파이프라인에서 별도 게이트로 실행하세요.
 *   npm run validate:counts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SKILLS_DIR = path.join(ROOT, 'skills');
const AGENTS_DIR = path.join(ROOT, 'agents');

/** postinstall 전역 설치에서 제외되는 조건부 그룹 (constants.ts CONDITIONAL_AGENT_GROUPS 와 동일) */
const CONDITIONAL_AGENT_GROUPS: ReadonlySet<string> = new Set(['ui', 'figma', 'event']);

function countSkills(): number {
  let count = 0;
  for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (fs.existsSync(path.join(SKILLS_DIR, entry.name, 'SKILL.md'))) count++;
  }
  return count;
}

/**
 * agents/ 에서 teams/ 와 conditional groups 를 제외한 .md 파일 수.
 * postinstall SSOT 와 동일 기준.
 */
function countInstalledAgents(): number {
  let count = 0;

  function walk(dir: string, topLevelName: string | null): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const childTopLevel = topLevelName ?? entry.name;
        if (topLevelName === null && entry.name === 'teams') continue;
        if (topLevelName === null && CONDITIONAL_AGENT_GROUPS.has(entry.name)) continue;
        walk(path.join(dir, entry.name), childTopLevel);
      } else if (entry.name.endsWith('.md')) {
        count++;
      }
    }
  }

  walk(AGENTS_DIR, null);
  return count;
}

interface CountClaim {
  file: string;
  description: string;
  pattern: RegExp;
  expected: string;
}

function buildClaims(skillCount: number, agentCount: number): CountClaim[] {
  const agentLabel = `${agentCount}+`;
  return [
    {
      file: path.join(ROOT, 'README.md'),
      description: `README.md skill count (expected **${skillCount}개 스킬**)`,
      pattern: /\*\*\d+개 스킬\*\*/,
      expected: `**${skillCount}개 스킬**`,
    },
    {
      file: path.join(ROOT, 'README.md'),
      description: `README.md agent count (expected **${agentLabel} 에이전트**)`,
      pattern: /\*\*\d+\+ 에이전트\*\*/,
      expected: `**${agentLabel} 에이전트**`,
    },
    {
      file: path.join(ROOT, 'README.en.md'),
      description: `README.en.md skill count (expected **${skillCount} skills**)`,
      pattern: /\*\*\d+ skills\*\*/,
      expected: `**${skillCount} skills**`,
    },
    {
      file: path.join(ROOT, 'README.en.md'),
      description: `README.en.md agent count (expected **${agentLabel} agents**)`,
      pattern: /\*\*\d+\+ agents\*\*/,
      expected: `**${agentLabel} agents**`,
    },
    {
      file: path.join(ROOT, 'package.json'),
      description: `package.json description skill count (expected "${skillCount} skills")`,
      pattern: /\d+ skills/,
      expected: `${skillCount} skills`,
    },
    {
      file: path.join(ROOT, 'package.json'),
      description: `package.json description agent count (expected "${agentLabel} agents")`,
      pattern: /\d+\+ agents/,
      expected: `${agentLabel} agents`,
    },
  ];
}

function main(): void {
  const skillCount = countSkills();
  const agentCount = countInstalledAgents();

  console.log(`Derived counts:`);
  console.log(`  skills (SKILL.md dirs):          ${skillCount}`);
  console.log(`  installed agents (non-teams, non-conditional): ${agentCount}`);

  const claims = buildClaims(skillCount, agentCount);
  const errors: string[] = [];

  for (const claim of claims) {
    const content = fs.readFileSync(claim.file, 'utf-8');
    const match = content.match(claim.pattern);
    if (!match) {
      errors.push(`${path.relative(ROOT, claim.file)}: pattern not found — ${claim.description}`);
      continue;
    }
    if (match[0] !== claim.expected) {
      errors.push(
        `${path.relative(ROOT, claim.file)}: count drift — found "${match[0]}", expected "${claim.expected}"`
      );
    }
  }

  if (errors.length === 0) {
    console.log(`\n✓ All count claims match (${skillCount} skills, ${agentCount}+ agents).`);
    return;
  }

  console.error(`\n✗ ${errors.length} count drift(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

main();
