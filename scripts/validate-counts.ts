#!/usr/bin/env node
/**
 * validate-counts.ts — README / package.json 의 capability count claim 검증
 *
 * 검증 대상:
 *   - coreCount / extraCount: skills/ · skills-extra/ 하위 디렉토리 중 SKILL.md 가 있는 디렉토리 수
 *                             (코어 = 코딩 루프, extras = capability 옵트인·명시 호출 — SPEC skill-tier-boundary)
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
const EXTRA_SKILLS_DIR = path.join(ROOT, 'skills-extra');
const AGENTS_DIR = path.join(ROOT, 'agents');
const CLI_DETECTOR = path.join(ROOT, 'src/cli/utils/cli-detector.ts');

/**
 * detect*Cli 심볼 → README 표에 쓰이는 하네스 이름.
 * 하네스를 추가/제거하면 detector 와 이 표를 함께 고쳐야 한다.
 */
const HARNESS_LABELS: Readonly<Record<string, string>> = {
  Claude: 'Claude Code',
  Codex: 'Codex',
  Antigravity: 'Antigravity',
};

/** 지원 하네스 SSOT — cli-detector.ts 가 실제로 export 하는 detector 에서 파생한다. */
function supportedHarnesses(): string[] {
  const source = fs.readFileSync(CLI_DETECTOR, 'utf-8');
  const found = [...source.matchAll(/export function detect(\w+)Cli\s*\(/g)].map((m) => m[1]);
  const unknown = found.filter((name) => !(name in HARNESS_LABELS));
  if (unknown.length > 0) {
    throw new Error(
      `cli-detector.ts exports detector(s) with no README label: ${unknown.join(', ')}. ` +
        'Add them to HARNESS_LABELS in scripts/validate-counts.ts.',
    );
  }
  return found.map((name) => HARNESS_LABELS[name]);
}

/** README 의 지원 도구 표에 나열된 하네스 이름을 추출한다. */
function harnessRowsIn(content: string, heading: string): string[] {
  const start = content.indexOf(heading);
  if (start === -1) throw new Error(`heading not found: ${heading}`);
  const section = content.slice(start, content.indexOf('\n---', start));
  const rows: string[] = [];
  for (const line of section.split('\n')) {
    const cell = line.match(/^\|\s*(?:\[([^\]]+)\]\([^)]*\)|([^|]+?))\s*\|/);
    if (!cell) continue;
    const name = (cell[1] ?? cell[2] ?? '').trim();
    if (!name || name === 'CLI' || /^-+$/.test(name)) continue;
    rows.push(name);
  }
  return rows;
}

/** package.json engines.node 에서 최소 버전을 뽑는다 (">=20.12.0" → "20.12.0"). */
function requiredNodeVersion(): string {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8')) as {
    engines?: { node?: string };
  };
  const range = pkg.engines?.node;
  if (!range) throw new Error('package.json has no engines.node');
  const min = range.match(/(\d+(?:\.\d+)*)/);
  if (!min) throw new Error(`cannot parse engines.node: ${range}`);
  return min[1];
}

/**
 * README 의 Node 버전 주장이 engines.node 와 일치하는지 검사한다.
 * 배지(`node-%3E%3DX`)와 본문(`Node.js >= X`)이 서로, 그리고 engines 와 어긋난 적이 있다.
 */
function nodeVersionErrors(): string[] {
  const required = requiredNodeVersion();
  const errors: string[] = [];
  for (const file of ['README.md', 'README.en.md']) {
    const content = fs.readFileSync(path.join(ROOT, file), 'utf-8');

    const badge = content.match(/badge\/node-%3E%3D([\d.]+)-/);
    if (!badge) errors.push(`${file}: Node badge not found`);
    else if (!required.startsWith(badge[1])) {
      errors.push(`${file}: Node badge claims >=${badge[1]}, engines.node requires >=${required}`);
    }

    const prose = content.match(/Node\.js\s*>=\s*([\d.]+)/);
    if (!prose) errors.push(`${file}: "Node.js >= X" prose not found`);
    else if (prose[1] !== required) {
      errors.push(`${file}: prose claims >=${prose[1]}, engines.node requires >=${required}`);
    }
  }
  return errors;
}

/**
 * README 지원 도구 표가 실제 지원 하네스와 일치하는지 검사한다.
 * Cursor 지원 제거(30eb6e7) 후에도 두 README 가 계속 Cursor 를 광고했다.
 */
function harnessErrors(): string[] {
  const expected = supportedHarnesses();
  const errors: string[] = [];
  const sections: ReadonlyArray<[string, string]> = [
    ['README.md', '## 지원 도구'],
    ['README.en.md', '## Supported Tools'],
  ];

  for (const [file, heading] of sections) {
    const listed = harnessRowsIn(fs.readFileSync(path.join(ROOT, file), 'utf-8'), heading);
    const stale = listed.filter((name) => !expected.some((e) => name.startsWith(e)));
    const missing = expected.filter((e) => !listed.some((name) => name.startsWith(e)));
    for (const name of stale) {
      errors.push(`${file}: "${name}" is listed but cli-detector.ts has no detector for it`);
    }
    for (const name of missing) {
      errors.push(`${file}: "${name}" is supported but missing from the table`);
    }
  }
  return errors;
}

/** postinstall 전역 설치에서 제외되는 조건부 그룹 (constants.ts CONDITIONAL_AGENT_GROUPS 와 동일) */
const CONDITIONAL_AGENT_GROUPS: ReadonlySet<string> = new Set(['ui', 'figma', 'event']);

function countSkills(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (fs.existsSync(path.join(dir, entry.name, 'SKILL.md'))) count++;
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

function buildClaims(coreCount: number, extraCount: number, agentCount: number): CountClaim[] {
  const agentLabel = `${agentCount}+`;
  return [
    {
      file: path.join(ROOT, 'README.md'),
      description: `README.md core skill count (expected **${coreCount}개 코어 스킬**)`,
      pattern: /\*\*\d+개 코어 스킬\*\*/,
      expected: `**${coreCount}개 코어 스킬**`,
    },
    {
      file: path.join(ROOT, 'README.md'),
      description: `README.md extras count (expected "extras ${extraCount}개")`,
      pattern: /extras \d+개/,
      expected: `extras ${extraCount}개`,
    },
    {
      // `claude plugin details vibe` 예시 줄 — 플러그인 트리는 코어+스택만 굽는다
      file: path.join(ROOT, 'README.md'),
      description: `README.md plugin details line (expected "# Skills ${coreCount} ·")`,
      pattern: /# Skills \d+ ·/,
      expected: `# Skills ${coreCount} ·`,
    },
    {
      file: path.join(ROOT, 'README.md'),
      description: `README.md harness table skills row (expected "| skills (${coreCount}) |")`,
      pattern: /\| skills \(\d+\) \|/,
      expected: `| skills (${coreCount}) |`,
    },
    {
      file: path.join(ROOT, 'README.md'),
      description: `README.md agent count (expected **${agentLabel} 에이전트**)`,
      pattern: /\*\*\d+\+ 에이전트\*\*/,
      expected: `**${agentLabel} 에이전트**`,
    },
    {
      file: path.join(ROOT, 'README.en.md'),
      description: `README.en.md core skill count (expected **${coreCount} core skills**)`,
      pattern: /\*\*\d+ core skills\*\*/,
      expected: `**${coreCount} core skills**`,
    },
    {
      file: path.join(ROOT, 'README.en.md'),
      description: `README.en.md extras count (expected "${extraCount} extras")`,
      pattern: /\d+ extras/,
      expected: `${extraCount} extras`,
    },
    {
      file: path.join(ROOT, 'README.en.md'),
      description: `README.en.md plugin details line (expected "# Skills ${coreCount} ·")`,
      pattern: /# Skills \d+ ·/,
      expected: `# Skills ${coreCount} ·`,
    },
    {
      file: path.join(ROOT, 'README.en.md'),
      description: `README.en.md agent count (expected **${agentLabel} agents**)`,
      pattern: /\*\*\d+\+ agents\*\*/,
      expected: `**${agentLabel} agents**`,
    },
    {
      file: path.join(ROOT, 'package.json'),
      description: `package.json description core skill count (expected "${coreCount} core skills")`,
      pattern: /\d+ core skills/,
      expected: `${coreCount} core skills`,
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
  const coreCount = countSkills(SKILLS_DIR);
  const extraCount = countSkills(EXTRA_SKILLS_DIR);
  const agentCount = countInstalledAgents();

  console.log(`Derived counts:`);
  console.log(`  core skills (skills/ SKILL.md dirs):        ${coreCount}`);
  console.log(`  extra skills (skills-extra/ SKILL.md dirs): ${extraCount}`);
  console.log(`  installed agents (non-teams, non-conditional): ${agentCount}`);

  const harnesses = supportedHarnesses();
  console.log(`  supported harnesses (cli-detector.ts):          ${harnesses.join(', ')}`);
  console.log(`  required Node (package.json engines):           >=${requiredNodeVersion()}`);

  const claims = buildClaims(coreCount, extraCount, agentCount);
  const errors: string[] = [...harnessErrors(), ...nodeVersionErrors()];

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
    console.log(
      `\n✓ All claims match (${coreCount} core + ${extraCount} extra skills, ${agentCount}+ agents, ` +
        `${harnesses.length} harnesses, Node >=${requiredNodeVersion()}).`,
    );
    return;
  }

  console.error(`\n✗ ${errors.length} drift(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

main();
