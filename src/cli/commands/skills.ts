/**
 * skills.sh 통합 — 외부 스킬 설치
 */

import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { log } from '../utils.js';
import { resolveExternalSkills } from '../postinstall/constants.js';
import { VibeConfig } from '../types.js';

/** skills.sh 패키지 이름 검증 (owner/repo 형식만 허용) */
function isValidSkillTarget(target: string): boolean {
  return /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(target);
}

/**
 * skills.sh 에코시스템에서 스킬 설치
 */
export function skillsAdd(target?: string): void {
  if (!target) {
    console.log(`
Usage: vibe skills add <owner/repo>

Install skills from skills.sh ecosystem.
Example: vibe skills add vercel-labs/skills
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

  const configPath = path.join(projectRoot, '.claude', 'vibe', 'config.json');
  let installed: string[] = [];

  if (fs.existsSync(configPath)) {
    try {
      const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
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
      execSync(`npx skills add ${pkg} --agent claude-code`, {
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
  if (fs.existsSync(configPath)) {
    try {
      const config: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const merged = new Set([...(config.installedExternalSkills ?? []), ...newlyInstalled]);
      config.installedExternalSkills = [...merged];
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    } catch { /* ignore */ }
  }

  log(`   📦 External skills installed: ${newlyInstalled.join(', ')}\n`);
}
