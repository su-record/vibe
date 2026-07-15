#!/usr/bin/env node
/**
 * postinstall 메인 오케스트레이션
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import {
  getCoreConfigDir,
  ensureDir,
  copyDirRecursive,
  removeDirRecursive,
  copySkillsFiltered,
  removeLegacySkills,
  replaceTemplatesInDir,
  cleanupDuplicateSkillDirs,
  applyCodexSkillInvocationPolicies,
  cleanupOptionalSkills,
} from './fs-utils.js';
import { GLOBAL_SKILLS, GLOBAL_SKILLS_OPTIONAL, LEGACY_SKILL_DIRS, CONDITIONAL_AGENT_GROUPS } from './constants.js';
import { cleanupGlobalSettingsHooks, ensureGlobalEnvSettings } from './global-config.js';
import { seedInlineSkills } from './inline-skills.js';
import { generateCursorRules } from './cursor-rules.js';
import { installCursorAgents } from './cursor-agents.js';
import { installClaudeAgents } from './claude-agents.js';
import { generateCursorSkills } from './cursor-skills.js';
import { detectAntigravityCli, detectClaudeCli, detectCodexCli } from '../utils/cli-detector.js';
import { getClaudeCodeStatus, formatClaudeCodeStatus } from '../auth.js';
import { migrateLegacyFiles } from '../../infra/lib/config/GlobalConfigManager.js';
import {
  generateGlobalClaudeMd,
  generateGlobalCodexAgentsMd,
  generateGlobalAntigravityMd,
  installCodexNotify,
} from '../setup/ProjectSetup.js';
import { writeHookPackageJson } from '../setup/GlobalInstaller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * postinstall 메인 함수
 */
export function main(): void {
  try {
    const globalCoreDir = getCoreConfigDir();
    const nodeModulesDir = path.join(globalCoreDir, 'node_modules');
    const corePackageDir = path.join(nodeModulesDir, '@su-record', 'vibe');
    const packageRoot = path.resolve(__dirname, '..', '..', '..');

    // 1. 전역 vibe 디렉토리 구조 생성
    ensureDir(globalCoreDir);
    writeHookPackageJson(globalCoreDir);
    ensureDir(nodeModulesDir);
    ensureDir(path.join(nodeModulesDir, '@su-record'));

    // 2. 패키지 복사
    if (fs.existsSync(corePackageDir)) {
      removeDirRecursive(corePackageDir);
    }
    if (fs.existsSync(packageRoot)) {
      copyDirRecursive(packageRoot, corePackageDir);
    }

    // 3. 훅 스크립트 복사 (%APPDATA%/vibe/hooks/scripts/)
    const hooksSource = path.join(packageRoot, 'hooks', 'scripts');
    const hooksTarget = path.join(globalCoreDir, 'hooks', 'scripts');
    if (fs.existsSync(hooksSource)) {
      ensureDir(path.join(globalCoreDir, 'hooks'));
      if (fs.existsSync(hooksTarget)) {
        removeDirRecursive(hooksTarget);
      }
      copyDirRecursive(hooksSource, hooksTarget);
    }

    // 4. CLI 호환 디렉토리에 전역 assets 설치 (agents, skills)
    //    ~/.claude/ (필수)
    //    NOTE: commands/ 폴더는 더 이상 사용하지 않음 — Codex는 /skills 또는 $skill로 스킬을 명시 호출
    const agentsSource = path.join(packageRoot, 'agents');
    const skillsSource = path.join(packageRoot, 'skills');

    /** 레거시 vibe.*.md 커맨드 파일을 ~/.claude/commands/ 에서 제거 (도트 스킬로 마이그레이션됨) */
    function removeLegacyVibeCommands(cmdsDir: string): void {
      if (!fs.existsSync(cmdsDir)) return;
      const entries = fs.readdirSync(cmdsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (/^vibe\..+\.md$/.test(entry.name)) {
          fs.rmSync(path.join(cmdsDir, entry.name), { force: true });
        }
      }
    }

    function installCliAssets(targetDir: string, label: string): void {
      ensureDir(targetDir);

      // commands — 레거시 vibe.*.md 정리 (스킬 기반 호출로 마이그레이션)
      const cmdsDir = path.join(targetDir, 'commands');
      removeLegacyVibeCommands(cmdsDir);

      // agents — 조건부 그룹(ui/figma/event)은 전역 제외, vibe init/update가
      // 스택·capability 매칭 시 프로젝트 로컬(.claude/agents/)에 설치
      const agtsDir = path.join(targetDir, 'agents');
      installClaudeAgents(agentsSource, agtsDir, { skipDirs: CONDITIONAL_AGENT_GROUPS });

      // skills
      const sklsDir = path.join(targetDir, 'skills');
      if (fs.existsSync(skillsSource)) {
        ensureDir(sklsDir);
        removeLegacySkills(sklsDir, LEGACY_SKILL_DIRS);
        // optional 스킬 정리 — vibe 소유이고 사용자 미수정인 경우에만 삭제
        const cleanupResults = cleanupOptionalSkills(sklsDir, GLOBAL_SKILLS_OPTIONAL, skillsSource);
        for (const r of cleanupResults) {
          if (r.action === 'removed') {
            console.log(`   optional skill removed: ${r.name}`);
          } else {
            console.log(`   optional skill notice [${r.name}]: ${r.reason}`);
          }
        }
        copySkillsFiltered(skillsSource, sklsDir, GLOBAL_SKILLS);
        replaceTemplatesInDir(sklsDir);
        if (label === 'codex') applyCodexSkillInvocationPolicies(sklsDir);
      }

      console.log(`✅ ${label} assets installed: ${targetDir}`);
    }

    // ~/.claude/ (필수)
    const globalClaudeDir = path.join(os.homedir(), '.claude');
    installCliAssets(globalClaudeDir, 'claude');

    const codexStatus = detectCodexCli();
    if (codexStatus.installed) {
      installCliAssets(codexStatus.configDir, 'codex');
    }

    // 5. ~/.<cli>/vibe/ 전역 문서 설치 (rules, languages, templates, 인라인 스킬)
    function installCoreAssets(targetDir: string): string {
      const coreAssetsDir = path.join(targetDir, 'vibe');
      ensureDir(coreAssetsDir);

      // 인라인 스킬 전용 (flat .md 파일)
      const sklDir = path.join(coreAssetsDir, 'skills');
      ensureDir(sklDir);
      removeLegacySkills(sklDir, LEGACY_SKILL_DIRS);
      cleanupDuplicateSkillDirs(sklDir);
      seedInlineSkills(sklDir);

      // 독립 디렉토리 복사
      const copies = [
        { source: path.join(packageRoot, 'vibe', 'ui-ux-data'), target: path.join(coreAssetsDir, 'ui-ux-data') },
        { source: path.join(packageRoot, 'vibe', 'rules'), target: path.join(coreAssetsDir, 'rules') },
        { source: path.join(packageRoot, 'vibe', 'templates'), target: path.join(coreAssetsDir, 'templates') },
        { source: path.join(packageRoot, 'languages'), target: path.join(coreAssetsDir, 'languages') },
      ];
      for (const { source, target } of copies) {
        if (fs.existsSync(source)) {
          if (fs.existsSync(target)) removeDirRecursive(target);
          copyDirRecursive(source, target);
        }
      }
      return path.join(coreAssetsDir, 'languages');
    }

    const globalLanguagesDir = installCoreAssets(globalClaudeDir);
    if (codexStatus.installed) {
      installCoreAssets(codexStatus.configDir);
    }

    // 5-0. 전역 CLAUDE.md / AGENTS.md / GEMINI.md 에 vibe 규약 섹션 주입 (idempotent)
    try {
      generateGlobalClaudeMd();
      if (codexStatus.installed) {
        generateGlobalCodexAgentsMd();
        installCodexNotify(codexStatus.configDir);
      }
      if (detectAntigravityCli().installed) generateGlobalAntigravityMd();
    } catch (e) {
      console.warn('⚠️  global CLAUDE.md/AGENTS.md/GEMINI.md 갱신 실패:', (e as Error).message);
    }

    // 5-1. 레거시 설정 파일 → ~/.vibe/config.json 마이그레이션
    try {
      migrateLegacyFiles();
    } catch {
      // 마이그레이션 실패해도 설치 계속
    }

    // 6. hooks는 프로젝트 레벨에서 관리 (vibe init/update에서 처리)
    // 전역 설정에는 훅을 등록하지 않음 - 프로젝트별 .claude/settings.local.json 사용
    // 6-1. 레거시 전역 hooks 정리 (이전 버전 호환성)
    cleanupGlobalSettingsHooks();

    // 6-2. (제거됨) 패키지 .env 주입 금지 — 키 노출 위험
    // 모든 설정은 ~/.vibe/config.json에서 관리 (vibe gpt key, vibe antigravity key)

    // 6-4. 전역 env 설정 (Agent Teams 등 모든 프로젝트에 필요한 환경변수)
    ensureGlobalEnvSettings();

    // 7-9. IDE 지원: Cursor agents + rules + skills (독립 작업)
    const cursorAgentsDir = path.join(os.homedir(), '.cursor', 'agents');
    const cursorRulesTemplateDir = path.join(os.homedir(), '.cursor', 'rules-template');
    const cursorSkillsDir = path.join(os.homedir(), '.cursor', 'skills');
    installCursorAgents(agentsSource, cursorAgentsDir);
    generateCursorRules(cursorRulesTemplateDir, [], globalLanguagesDir);
    generateCursorSkills(cursorSkillsDir);

    // Claude Code CLI 존재 확인 (인증은 vibe init에서)
    const claudeStatus = getClaudeCodeStatus(false);
    const claudeStatusMsg = formatClaudeCodeStatus(claudeStatus);

    console.log(`✅ core global setup complete: ${globalCoreDir}`);
    console.log(`✅ cursor agents installed: ${cursorAgentsDir}`);
    console.log(`✅ cursor rules template: ${cursorRulesTemplateDir}`);
    console.log(`✅ cursor skills installed: ${cursorSkillsDir}`);
    console.log(`🧠 Claude Code: ${claudeStatusMsg}`);
    if (!claudeStatus.installed && !codexStatus.installed) {
      console.warn('⚠️  Install Claude Code or Codex CLI to use VIBE harness features.');
    }
  } catch (error) {
    // postinstall 실패해도 설치는 계속 진행
    console.warn('⚠️  core postinstall warning:', (error as Error).message);
  }
}

// CLI로 직접 실행할 때만 main() 호출 (ESM entry point detection)
// import.meta.url과 process.argv[1]을 비교하여 직접 실행 여부 판단
const currentUrl = import.meta.url;
const isDirectRun = process.argv[1] && (
  currentUrl.includes(process.argv[1].replace(/\\/g, '/')) ||
  process.argv[1].includes('postinstall')
);

if (isDirectRun) {
  main();
}
