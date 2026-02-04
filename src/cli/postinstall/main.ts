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
  copySkillsIfMissing,
} from './fs-utils.js';
import { cleanupGlobalSettingsHooks } from './global-config.js';
import { seedInlineSkills } from './inline-skills.js';
import { generateCursorRules } from './cursor-rules.js';
import { installCursorAgents } from './cursor-agents.js';
import { generateCursorSkills } from './cursor-skills.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * postinstall 메인 함수
 */
export function main(): void {
  try {
    const globalCoreDir = getCoreConfigDir();
    const nodeModulesDir = path.join(globalCoreDir, 'node_modules');
    const corePackageDir = path.join(nodeModulesDir, '@su-record', 'core');
    const packageRoot = path.resolve(__dirname, '..', '..', '..');

    // 1. 전역 core 디렉토리 구조 생성
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

    // 3. 훅 스크립트 복사 (%APPDATA%/core/hooks/scripts/)
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
    }

    // agents 복사
    const agentsSource = path.join(packageRoot, 'agents');
    const globalAgentsDir = path.join(globalClaudeDir, 'agents');
    if (fs.existsSync(agentsSource)) {
      ensureDir(globalAgentsDir);
      copyDirRecursive(agentsSource, globalAgentsDir);
    }

    // skills 복사 (덮어쓰지 않고 없는 것만 추가)
    const skillsSource = path.join(packageRoot, 'skills');
    const globalSkillsDir = path.join(globalClaudeDir, 'skills');
    if (fs.existsSync(skillsSource)) {
      ensureDir(globalSkillsDir);
      copySkillsIfMissing(skillsSource, globalSkillsDir);
    }

    // 5. ~/.claude/core/ 전역 문서 설치 (rules, languages, templates)
    // 프로젝트별로 복사하지 않고 전역에서 참조
    const globalCoreAssetsDir = path.join(globalClaudeDir, 'core');
    ensureDir(globalCoreAssetsDir);

    // ~/.claude/core/skills/ 전역 core 스킬 설치 (v2.5.12)
    const coreSkillsDir = path.join(globalCoreAssetsDir, 'skills');
    ensureDir(coreSkillsDir);
    if (fs.existsSync(skillsSource)) {
      copySkillsIfMissing(skillsSource, coreSkillsDir);
    }
    // 인라인 기본 스킬 추가 (번들에 없는 추가 스킬)
    seedInlineSkills(coreSkillsDir);

    // core/rules 복사
    const rulesSource = path.join(packageRoot, 'core', 'rules');
    const globalRulesDir = path.join(globalCoreAssetsDir, 'rules');
    if (fs.existsSync(rulesSource)) {
      if (fs.existsSync(globalRulesDir)) {
        removeDirRecursive(globalRulesDir);
      }
      copyDirRecursive(rulesSource, globalRulesDir);
    }

    // core/templates 복사
    const templatesSource = path.join(packageRoot, 'core', 'templates');
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

    // 6. hooks는 프로젝트 레벨에서 관리 (vibe init/update에서 처리)
    // 전역 설정에는 훅을 등록하지 않음 - 프로젝트별 .claude/settings.local.json 사용
    // 6-1. 레거시 전역 hooks 정리 (이전 버전 호환성)
    cleanupGlobalSettingsHooks();

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

    console.log(`✅ core global setup complete: ${globalCoreDir}`);
    console.log(`✅ cursor agents installed: ${cursorAgentsDir}`);
    console.log(`✅ cursor rules template: ${cursorRulesTemplateDir}`);
    console.log(`✅ cursor skills installed: ${cursorSkillsDir}`);
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
