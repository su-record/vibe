/**
 * update 명령어
 */

import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { CliOptions } from '../types.js';
import { log, ensureDir, getPackageJson, formatVoiceHint } from '../utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { detectTechStacks } from '../detect.js';
import { formatLLMStatus, getLLMAuthStatus } from '../auth.js';
import { setupCollaboratorAutoInstall } from '../collaborator.js';
import {
  updateConstitution,
  updateClaudeMd,
  updateRules,
  migrateLegacyCore,
  updateGitignore,
  updateConfig,
  cleanupLegacy,
  removeLocalAssets,
  cleanupClaudeConfig,
  cleanupLegacyMcp,
  installProjectHooks,
  installCursorRules,
} from '../setup.js';
import { updateCursorGlobalAssets } from './init.js';

/**
 * 최신 버전 확인 및 업그레이드
 */
export async function checkAndUpgradeVibe(options: CliOptions = { silent: false }): Promise<boolean> {
  try {
    log(`⬆️ Upgrading to latest version...\n`);

    execSync('npm install -g @su-record/core@latest', {
      stdio: options.silent ? 'pipe' : 'inherit'
    });

    // 업그레이드 완료 후 새 버전으로 설정 업데이트 (--skip-upgrade로 무한 루프 방지)
    execSync(`vibe update --skip-upgrade${options.silent ? ' --silent' : ''}`, {
      stdio: 'inherit',
      cwd: process.cwd()
    });
    return true;
  } catch { /* ignore: optional operation */
    return false;
  }
}

/**
 * update 명령어 실행
 */
export async function update(options: CliOptions = { silent: false }, skipUpgrade = false): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const coreDir = path.join(projectRoot, '.claude', 'vibe');
    const claudeDir = path.join(projectRoot, '.claude');
    const legacyCoreDir = path.join(projectRoot, '.core');

    // CI/프로덕션 환경에서는 스킵
    if (process.env.NODE_ENV === 'production' || process.env.CI === 'true') {
      return;
    }

    // 1. 최신 버전 확인 및 업그레이드 (전역 패키지 먼저)
    // npm install -g 실행 시 postinstall이 전역 설정을 자동 처리
    // --skip-upgrade 플래그가 있으면 업그레이드 체크 건너뜀 (무한 루프 방지)
    if (!skipUpgrade) {
      const wasUpgraded = await checkAndUpgradeVibe(options);
      if (wasUpgraded) return;
    }

    // 2. 프로젝트 설정 업데이트
    // 레거시 마이그레이션
    if (fs.existsSync(legacyCoreDir) && !fs.existsSync(coreDir)) {
      migrateLegacyCore(projectRoot, coreDir);
    }

    if (!fs.existsSync(coreDir) && !fs.existsSync(legacyCoreDir)) {
      // 프로젝트가 없어도 전역 업그레이드는 완료됨
      const packageJson = getPackageJson();
      log(`✅ core global updated (v${packageJson.version})
${formatLLMStatus()}
`);
      return;
    }

    ensureDir(coreDir);

    // 레거시 정리
    cleanupLegacy(projectRoot, claudeDir);

    // 기술 스택 감지
    const { stacks: detectedStacks, details: stackDetails } = detectTechStacks(projectRoot);

    // config.json 업데이트
    updateConfig(coreDir, detectedStacks, stackDetails, true);

    // constitution.md 업데이트
    updateConstitution(coreDir, detectedStacks, stackDetails);

    // CLAUDE.md 업데이트
    updateClaudeMd(projectRoot, detectedStacks, true);

    // 규칙 업데이트
    updateRules(coreDir, detectedStacks, true);

    // 프로젝트 로컬 자산 제거 (core 소유 파일만 선별 삭제, 사용자 커스텀 파일 보존)
    const packageRoot = path.resolve(__dirname, '..', '..', '..');
    removeLocalAssets(claudeDir, packageRoot);

    // .gitignore 업데이트
    updateGitignore(projectRoot);

    // 협업자 자동 설치 설정
    setupCollaboratorAutoInstall(projectRoot);

    // 프로젝트 레벨 훅 설치
    installProjectHooks(projectRoot);

    // Cursor 글로벌 에셋 업데이트 (agents, skills, rules-template) - 먼저 실행!
    const stackTypes = detectedStacks.map(s => s.type);
    updateCursorGlobalAssets(stackTypes, options);

    // Cursor IDE 룰 설치/업데이트 (프로젝트 레벨) - rules-template 생성 후 현재 스택에 해당하는 룰만 복사
    installCursorRules(projectRoot, stackTypes);

    // ~/.claude.json 정리
    cleanupClaudeConfig();

    // 레거시 mcp 폴더 정리
    cleanupLegacyMcp(coreDir);

    const packageJson = getPackageJson();

    const authStatus = getLLMAuthStatus();
    log(`✅ vibe updated (v${packageJson.version})
${formatLLMStatus()}
${formatVoiceHint(authStatus.gemini.length > 0)}
📦 Context7 plugin (recommended): /plugin install context7
`);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Update failed:', message);
    process.exit(1);
  }
}
