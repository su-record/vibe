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
  replaceTemplatesInDir,
} from './fs-utils.js';
import { GLOBAL_SKILLS } from './constants.js';
import { cleanupGlobalSettingsHooks, ensureGlobalEnvSettings } from './global-config.js';
import { seedInlineSkills } from './inline-skills.js';
import { generateCursorRules } from './cursor-rules.js';
import { installCursorAgents } from './cursor-agents.js';
import { installClaudeAgents } from './claude-agents.js';
import { generateCursorSkills } from './cursor-skills.js';
import { installCodexPlugin } from './codex-agents.js';
import { installGeminiAgents } from './gemini-agents.js';
import { generateGeminiMd } from './gemini-instruction.js';
import { detectCodexCli, detectGeminiCli } from '../utils/cli-detector.js';
import { getClaudeCodeStatus, formatClaudeCodeStatus } from '../auth.js';
import { migrateLegacyFiles } from '../../infra/lib/config/GlobalConfigManager.js';

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

    // 4. ~/.claude/ 전역 assets 설치 (commands, agents, skills)
    const globalClaudeDir = path.join(os.homedir(), '.claude');
    ensureDir(globalClaudeDir);

    // commands 복사 (이전 파일 정리 후 복사)
    const commandsSource = path.join(packageRoot, 'commands');
    const globalCommandsDir = path.join(globalClaudeDir, 'commands');
    if (fs.existsSync(commandsSource)) {
      if (fs.existsSync(globalCommandsDir)) {
        removeDirRecursive(globalCommandsDir);
      }
      ensureDir(globalCommandsDir);
      copyDirRecursive(commandsSource, globalCommandsDir);
      replaceTemplatesInDir(globalCommandsDir);
    }

    // agents 변환 및 설치 (Claude Code 네이티브 서브에이전트 형식)
    const agentsSource = path.join(packageRoot, 'agents');
    const globalAgentsDir = path.join(globalClaudeDir, 'agents');
    installClaudeAgents(agentsSource, globalAgentsDir);

    // skills 복사 (전역 공통 스킬만 설치, 스택별 스킬은 vibe init/update에서 로컬 설치)
    const skillsSource = path.join(packageRoot, 'skills');
    const globalSkillsDir = path.join(globalClaudeDir, 'skills');
    if (fs.existsSync(skillsSource)) {
      ensureDir(globalSkillsDir);
      copySkillsFiltered(skillsSource, globalSkillsDir, GLOBAL_SKILLS);
      replaceTemplatesInDir(globalSkillsDir);
    }

    // 5. ~/.claude/vibe/ 전역 문서 설치 (rules, languages, templates)
    // 프로젝트별로 복사하지 않고 전역에서 참조
    const globalCoreAssetsDir = path.join(globalClaudeDir, 'vibe');
    ensureDir(globalCoreAssetsDir);

    // ~/.claude/vibe/skills/ 전역 vibe 스킬 설치 (공통 스킬만)
    const coreSkillsDir = path.join(globalCoreAssetsDir, 'skills');
    ensureDir(coreSkillsDir);
    if (fs.existsSync(skillsSource)) {
      copySkillsFiltered(skillsSource, coreSkillsDir, GLOBAL_SKILLS);
      replaceTemplatesInDir(coreSkillsDir);
    }
    // 인라인 기본 스킬 추가 (번들에 없는 추가 스킬)
    seedInlineSkills(coreSkillsDir);

    // vibe/ui-ux-data 복사 (UI/UX Design Intelligence CSV 데이터)
    const uiUxDataSource = path.join(packageRoot, 'vibe', 'ui-ux-data');
    const globalUiUxDataDir = path.join(globalCoreAssetsDir, 'ui-ux-data');
    if (fs.existsSync(uiUxDataSource)) {
      if (fs.existsSync(globalUiUxDataDir)) {
        removeDirRecursive(globalUiUxDataDir);
      }
      copyDirRecursive(uiUxDataSource, globalUiUxDataDir);
    }

    // vibe/rules 복사
    const rulesSource = path.join(packageRoot, 'vibe', 'rules');
    const globalRulesDir = path.join(globalCoreAssetsDir, 'rules');
    if (fs.existsSync(rulesSource)) {
      if (fs.existsSync(globalRulesDir)) {
        removeDirRecursive(globalRulesDir);
      }
      copyDirRecursive(rulesSource, globalRulesDir);
    }

    // vibe/templates 복사
    const templatesSource = path.join(packageRoot, 'vibe', 'templates');
    const globalTemplatesDir = path.join(globalCoreAssetsDir, 'templates');
    if (fs.existsSync(templatesSource)) {
      if (fs.existsSync(globalTemplatesDir)) {
        removeDirRecursive(globalTemplatesDir);
      }
      copyDirRecursive(templatesSource, globalTemplatesDir);
    }

    // languages 복사
    const languagesSource = path.join(packageRoot, 'languages');
    const globalLanguagesDir = path.join(globalCoreAssetsDir, 'languages');
    if (fs.existsSync(languagesSource)) {
      if (fs.existsSync(globalLanguagesDir)) {
        removeDirRecursive(globalLanguagesDir);
      }
      copyDirRecursive(languagesSource, globalLanguagesDir);
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
    // 모든 설정은 ~/.vibe/config.json에서 관리 (vibe gpt auth, vibe gemini auth)

    // 6-4. 전역 env 설정 (Agent Teams 등 모든 프로젝트에 필요한 환경변수)
    ensureGlobalEnvSettings();

    // 7. Cursor IDE 지원 - ~/.cursor/agents/에 변환된 서브에이전트 설치
    const cursorAgentsDir = path.join(os.homedir(), '.cursor', 'agents');
    installCursorAgents(agentsSource, cursorAgentsDir);

    // 8. Cursor 프로젝트 룰 템플릿 생성 - ~/.cursor/rules-template/
    // 프로젝트별로 .cursor/rules/에 복사해서 사용
    // postinstall에서는 스택 감지 없이 공통 룰만 생성
    const cursorRulesTemplateDir = path.join(os.homedir(), '.cursor', 'rules-template');
    generateCursorRules(cursorRulesTemplateDir, [], globalLanguagesDir);

    // 9. Cursor Skills 생성 - ~/.cursor/skills/
    // VIBE 커맨드를 Cursor 스킬로 변환
    const cursorSkillsDir = path.join(os.homedir(), '.cursor', 'skills');
    generateCursorSkills(cursorSkillsDir);

    // 10. Codex CLI 지원 (플러그인 시스템)
    try {
      const codexStatus = detectCodexCli();
      if (codexStatus.installed) {
        installCodexPlugin(agentsSource, skillsSource, codexStatus.configDir, packageRoot);
        console.log(`✅ codex plugin installed: ${codexStatus.pluginDir}`);
      }
    } catch {
      // Non-critical — don't fail postinstall
    }

    // 11. Gemini CLI 지원
    try {
      const geminiStatus = detectGeminiCli();
      if (geminiStatus.installed) {
        const geminiAgentsDir = path.join(geminiStatus.configDir, 'agents');
        installGeminiAgents(agentsSource, geminiAgentsDir);
        copySkillsFiltered(skillsSource, path.join(geminiStatus.configDir, 'skills'), GLOBAL_SKILLS);
        generateGeminiMd(geminiStatus.configDir, packageRoot);
        console.log(`✅ gemini agents/skills installed: ${geminiStatus.configDir}`);
      }
    } catch {
      // Non-critical — don't fail postinstall
    }

    // 12. Claude Code CLI 존재 확인 (인증은 vibe init에서)
    const claudeStatus = getClaudeCodeStatus(false);
    const claudeStatusMsg = formatClaudeCodeStatus(claudeStatus);

    console.log(`✅ core global setup complete: ${globalCoreDir}`);
    console.log(`✅ claude agents installed: ${globalAgentsDir}`);
    console.log(`✅ cursor agents installed: ${cursorAgentsDir}`);
    console.log(`✅ cursor rules template: ${cursorRulesTemplateDir}`);
    console.log(`✅ cursor skills installed: ${cursorSkillsDir}`);
    console.log(`🧠 Claude Code: ${claudeStatusMsg}`);
    if (!claudeStatus.installed) {
      console.warn('⚠️  Claude Code is required for full VIBE features.');
      console.warn('   Install: npm i -g @anthropic-ai/claude-code');
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
