/**
 * skills.sh 통합 — 외부 스킬 설치
 */

import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { log } from '../utils.js';
import { resolveExternalSkills } from '../postinstall/constants.js';
import { VibeConfig } from '../types.js';
import {
  getProjectConfigPath,
  getProjectConfigPaths,
} from '../../infra/lib/config/GlobalConfigManager.js';

/**
 * skills.sh 설치 대상 검증 — `owner/repo` 와 `owner/repo@skill` 둘 다 허용한다.
 *
 * WHY: `@skill` 은 skills.sh 가 문서에 쓰는 **단일 스킬 설치 표기**다
 * (`npx skills add vercel-labs/agent-skills@react-best-practices`). 그런데 vibe 의
 * 검증기는 `@` 를 아예 몰라서, 공식 문서를 그대로 따라 친 사용자가
 * "Invalid skill target" 을 받았다. 레포 전체를 받는 형태만 통과시키고 있었던 셈이다.
 *
 * 같은 이유로 `https://github.com/owner/repo` 전체 URL 형태도 받는다 — taste-skill 등
 * 여러 배포처가 README 에 URL 형태만 싣는다(실측: skills.sh 문서에 세 표기가 모두 있다).
 *
 * 셸 주입 방지가 이 검증기의 목적이므로 허용 문자는 계속 화이트리스트로 좁게 둔다 —
 * 표기 세 가지를 여는 것이지 임의 문자열을 통과시키는 것이 아니다.
 */
const OWNER_REPO = String.raw`[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+`;
const SKILL_SUFFIX = String.raw`(@[a-zA-Z0-9_.-]+)?`;
const SKILL_TARGET = new RegExp(
  `^(https:\\/\\/github\\.com\\/)?${OWNER_REPO}${SKILL_SUFFIX}$`,
);

function isValidSkillTarget(target: string): boolean {
  return SKILL_TARGET.test(target);
}

/**
 * skills.sh 에코시스템에서 스킬 설치
 */
export function skillsAdd(target?: string): void {
  if (!target) {
    console.log(`
Usage: vibe skills add <owner/repo>

Install skills from skills.sh ecosystem.

Examples:
  vibe skills add vercel-labs/agent-skills                        # whole repo
  vibe skills add vercel-labs/agent-skills@react-best-practices   # one skill
    `);
    return;
  }

  if (!isValidSkillTarget(target)) {
    console.error(`❌ Invalid skill target: "${target}" (expected: owner/repo)`);
    process.exit(1);
  }

  console.log(`\nInstalling skill: ${target}...\n`);

  try {
    execSync(`npx skills add ${target} --agent claude-code`, {
      stdio: 'inherit',
    });
    console.log(`\n✅ Skill "${target}" installed successfully.`);
  } catch {
    console.error(`\n❌ Failed to install skill "${target}".`);
    process.exit(1);
  }
}

/**
 * 스택 기반 외부 스킬 자동 설치 (init/update 시 호출)
 * 이미 설치된 패키지는 config.json으로 추적하여 스킵
 */
export function installExternalSkills(
  projectRoot: string,
  stackTypes: string[],
  capabilities: string[] = [],
): void {
  const packages = resolveExternalSkills(stackTypes, capabilities);
  if (packages.length === 0) return;

  const configPath = getProjectConfigPath(projectRoot);
  const readConfigPath = getProjectConfigPaths(projectRoot).find(p => fs.existsSync(p)) || configPath;
  let installed: string[] = [];

  if (fs.existsSync(readConfigPath)) {
    try {
      const config: VibeConfig = JSON.parse(fs.readFileSync(readConfigPath, 'utf-8'));
      installed = config.installedExternalSkills ?? [];
    } catch { /* ignore */ }
  }

  const toInstall = packages.filter((pkg: string) => !installed.includes(pkg));
  if (toInstall.length === 0) return;

  const newlyInstalled: string[] = [];

  for (const pkg of toInstall) {
    if (!isValidSkillTarget(pkg)) continue;
    try {
      log(`   📦 Installing external skill: ${pkg}...\n`);
      // `-y` 없이는 프롬프트가 뜬다. skills CLI 는 에이전트 환경을 감지하면 알아서
      // 비대화로 돌지만, 사용자가 **평범한 셸에서** `vibe init` 을 돌리면 감지가
      // 안 되고 stdio:'pipe' 라 프롬프트가 보이지도 않는다 — 60초를 기다렸다가
      // "Failed (skipped)" 로 조용히 넘어간다. 비대화 경로에서는 명시적으로 끈다.
      execSync(`npx skills add ${pkg} --agent claude-code -y`, {
        stdio: 'pipe',
        cwd: projectRoot,
        timeout: 60_000,
      });
      newlyInstalled.push(pkg);
    } catch {
      log(`   ⚠️ Failed to install external skill: ${pkg} (skipped)\n`);
    }
  }

  if (newlyInstalled.length === 0) return;

  // config.json에 설치 기록 저장
  if (fs.existsSync(readConfigPath)) {
    try {
      const config: VibeConfig = JSON.parse(fs.readFileSync(readConfigPath, 'utf-8'));
      const merged = new Set([...(config.installedExternalSkills ?? []), ...newlyInstalled]);
      config.installedExternalSkills = [...merged];
      fs.writeFileSync(readConfigPath, JSON.stringify(config, null, 2));
    } catch { /* ignore */ }
  }

  log(`   📦 External skills installed: ${newlyInstalled.join(', ')}\n`);
}
