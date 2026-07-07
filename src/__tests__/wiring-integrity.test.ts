import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { globSync } from 'glob';
import {
  GLOBAL_SKILLS,
  GLOBAL_SKILLS_OPTIONAL,
  STACK_TO_SKILLS,
  CAPABILITY_SKILLS,
} from '../cli/postinstall/constants.js';

/**
 * F1–F3 — 정적 무결성 테스트 (SPEC: system-lean-hardening Track 4).
 *
 * A1/B1–B3/B5–B6 처럼 "설치 목록에 없는 걸 체인 호출" / "아무도 참조 안 하는 자산"
 * 결함이 재발하지 않도록, 배선(entry→body 스킬 / 훅 스크립트 / 에이전트)을
 * 순수 fs+regex 로 검증한다. 빌드 산출물 불필요 — 소스만 읽는다.
 */

const ROOT = path.resolve(__dirname, '..', '..');
const SKILLS_DIR = path.join(ROOT, 'skills');
const HOOKS_DIR = path.join(ROOT, 'hooks');
const HOOK_SCRIPTS_DIR = path.join(HOOKS_DIR, 'scripts');
const AGENTS_DIR = path.join(ROOT, 'agents');
const SRC_DIR = path.join(ROOT, 'src');
const RULES_DIR = path.join(ROOT, 'vibe', 'rules');

// ---------------------------------------------------------------------------
// F1 — entry→body skill install integrity
// ---------------------------------------------------------------------------

/**
 * SKILL.md 본문에서 체인 호출("Load skill `X`" 및 한국어 "`X` 스킬을 로드")로
 * 참조된 body 스킬 이름을 추출한다. `figma:figma-use` 처럼 subcommand 가
 * 붙은 경우 ':' 앞부분(실제 스킬 디렉토리명)만 취한다.
 */
function extractChainedSkills(content: string): string[] {
  const names = new Set<string>();
  const patterns = [/load skill `([^`]+)`/gi, /`([^`]+)`\s*스킬을\s*로드/g];

  for (const re of patterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
      const base = match[1].trim().split(':')[0].trim();
      if (base) names.add(base);
    }
  }

  return [...names];
}

function flattenMap(map: Record<string, ReadonlyArray<string>>): string[] {
  return Object.values(map).flat();
}

describe('F1 — entry→body skill install integrity', () => {
  const installedSkillSet = new Set<string>([...GLOBAL_SKILLS]);
  const allowedBodySet = new Set<string>([
    ...GLOBAL_SKILLS,
    ...flattenMap(STACK_TO_SKILLS),
    ...flattenMap(CAPABILITY_SKILLS),
    ...GLOBAL_SKILLS_OPTIONAL,
  ]);

  for (const skillName of installedSkillSet) {
    const skillFile = path.join(SKILLS_DIR, skillName, 'SKILL.md');

    it(`${skillName}: SKILL.md exists`, () => {
      expect(fs.existsSync(skillFile), `missing skills/${skillName}/SKILL.md`).toBe(true);
    });

    if (!fs.existsSync(skillFile)) continue;

    const content = fs.readFileSync(skillFile, 'utf-8');
    const referenced = extractChainedSkills(content);

    for (const body of referenced) {
      it(`${skillName}: chain-called body skill \`${body}\` is installed`, () => {
        expect(
          allowedBodySet.has(body),
          `skills/${skillName}/SKILL.md chain-calls \`${body}\`, but it is not a member of ` +
            `GLOBAL_SKILLS ∪ STACK_TO_SKILLS ∪ CAPABILITY_SKILLS ∪ GLOBAL_SKILLS_OPTIONAL. ` +
            `Fix: add "${body}" to the appropriate list in src/cli/postinstall/constants.ts.`,
        ).toBe(true);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// F2 — hook script reference integrity
// ---------------------------------------------------------------------------

function collectHookScriptNames(): string[] {
  return fs
    .readdirSync(HOOK_SCRIPTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => entry.name);
}

function isReferencedInHookScripts(scriptName: string): boolean {
  const otherScripts = collectHookScriptNames().filter((name) => name !== scriptName);
  return otherScripts.some((name) => {
    const content = fs.readFileSync(path.join(HOOK_SCRIPTS_DIR, name), 'utf-8');
    return content.includes(scriptName);
  });
}

function isReferencedInFiles(scriptName: string, files: string[]): boolean {
  return files.some((file) => fs.readFileSync(file, 'utf-8').includes(scriptName));
}

describe('F2 — hook script reference integrity', () => {
  const scriptNames = collectHookScriptNames();
  const hooksJson = path.join(HOOKS_DIR, 'hooks.json');
  const antigravityJson = path.join(HOOKS_DIR, 'antigravity-hooks.json');
  const srcFiles = globSync('**/*.ts', { cwd: SRC_DIR, absolute: true });
  const skillMdFiles = [
    ...globSync('*/SKILL.md', { cwd: SKILLS_DIR, absolute: true }),
    ...globSync('*/references/*.md', { cwd: SKILLS_DIR, absolute: true }),
  ];

  it('discovers hook scripts', () => {
    expect(scriptNames.length).toBeGreaterThan(0);
  });

  for (const scriptName of scriptNames) {
    it(`${scriptName} is referenced by hooks.json, another script, src/, or a skill`, () => {
      const referenced =
        isReferencedInFiles(scriptName, [hooksJson, antigravityJson]) ||
        isReferencedInHookScripts(scriptName) ||
        isReferencedInFiles(scriptName, srcFiles) ||
        isReferencedInFiles(scriptName, skillMdFiles);

      expect(
        referenced,
        `hooks/scripts/${scriptName} has no reference in hooks.json, antigravity-hooks.json, ` +
          `another hooks/scripts/*.js, src/**/*.ts, or skills/**/SKILL.md(+references/*.md). ` +
          `Fix: register it or delete it if genuinely dead.`,
      ).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// F3 — agent reference integrity
// ---------------------------------------------------------------------------

/**
 * 순수 uninstall-cleanup 목록 파일 — 여기서만 등장하는 건 "살아있다"로 치지 않는다
 * (삭제 목록에 남아있어도 참조가 아니라 오히려 제거 대상이라는 뜻이기 때문).
 * constants.ts 의 모델/툴 매핑 데이터 테이블도 동일한 이유로 단독으로는 불충분하다
 * (실 디스패치/사용 근거가 아니라 설치 시 주입되는 메타데이터 테이블일 뿐).
 */
const NON_COUNTING_SRC_FILES = new Set(['remove.ts', 'constants.ts']);

/**
 * 알려진 미배선 에이전트 — 발견되면 여기 이름을 추가하고 왜 아직 안 지웠는지 주석을 남긴다.
 * (F3 는 이 목록에 있는 에이전트는 실패시키지 않되, 디버트로서 눈에 띄게 남긴다.)
 * 현재는 13개 에이전트 전부 정상 배선되어 있어 비어 있다.
 */
const KNOWN_UNWIRED: ReadonlyArray<string> = [];

function collectAgentBasenames(): string[] {
  return globSync('**/*.md', { cwd: AGENTS_DIR }).map((rel) => path.basename(rel, '.md'));
}

function isReferencedInMarkdown(agentName: string, dir: string): boolean {
  if (!fs.existsSync(dir)) return false;
  const files = globSync('**/*.md', { cwd: dir, absolute: true });
  return files.some((file) => new RegExp(`\\b${agentName}\\b`).test(fs.readFileSync(file, 'utf-8')));
}

function isReferencedInSrc(agentName: string): boolean {
  const files = globSync('**/*.ts', { cwd: SRC_DIR, absolute: true }).filter(
    (file) => !NON_COUNTING_SRC_FILES.has(path.basename(file)),
  );
  return files.some((file) => new RegExp(`\\b${agentName}\\b`).test(fs.readFileSync(file, 'utf-8')));
}

describe('F3 — agent reference integrity', () => {
  const agentNames = collectAgentBasenames();

  it('discovers agent files', () => {
    expect(agentNames.length).toBeGreaterThan(0);
  });

  for (const agentName of agentNames) {
    it(`${agentName} is referenced in skills/, vibe/rules/, or src/ (excluding cleanup-only lists)`, () => {
      if (KNOWN_UNWIRED.includes(agentName)) return;

      const referenced =
        isReferencedInMarkdown(agentName, SKILLS_DIR) ||
        isReferencedInMarkdown(agentName, RULES_DIR) ||
        isReferencedInSrc(agentName);

      expect(
        referenced,
        `agents/${agentName}.md has no dispatch/usage reference in skills/**/*.md, ` +
          `vibe/rules/**/*.md, or src/ (excluding remove.ts / constants.ts alone). ` +
          `This is a genuine orphan — add it to KNOWN_UNWIRED with a reason, or delete the agent.`,
      ).toBe(true);
    });
  }
});
