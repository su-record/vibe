/**
 * update 명령어 — 프로젝트 설정 업데이트
 * 패키지 업그레이드는 `vibe upgrade` 사용
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { CliOptions, VibeConfig } from '../types.js';
import { log, ensureDir, getPackageJson, formatVoiceHint } from '../utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { detectTechStacks } from '../detect.js';
import { formatLLMStatus, getLLMAuthStatus } from '../auth.js';
import { setupCollaboratorAutoInstall } from '../collaborator.js';
import {
  updateConstitution,
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
  updateCodexAgentsMd,
  updateGeminiMd,
  installGeminiHooks,
} from '../setup.js';
import {
  updateCursorGlobalAssets,
  updateCodexGlobalAssets,
  updateGeminiGlobalAssets,
  installLocalSkills,
  installLanguageRules,
} from './init.js';
import { installExternalSkills } from './skills.js';
import { detectCodexCli, detectGeminiCli } from '../utils/cli-detector.js';
import { Provisioner } from '../setup/Provisioner.js';

/**
 * update 명령어 실행 — 프로젝트 설정만 업데이트
 */
export function update(options: CliOptions = { silent: false }): void {
  try {
    const projectRoot = process.cwd();
    const coreDir = path.join(projectRoot, '.claude', 'vibe');
    const claudeDir = path.join(projectRoot, '.claude');
    const legacyCoreDir = path.join(projectRoot, '.core');

    // CI/프로덕션 환경에서는 스킵
    if (process.env.NODE_ENV === 'production' || process.env.CI === 'true') {
      return;
    }

    // 레거시 마이그레이션
    if (fs.existsSync(legacyCoreDir) && !fs.existsSync(coreDir)) {
      migrateLegacyCore(projectRoot, coreDir);
    }

    // 프로젝트 감지: 홈 디렉토리이거나 프로젝트 마커(.git, package.json)가 없으면
    // 전역 업그레이드만 수행하고 프로젝트 설정 업데이트는 건너뜀
    // (홈의 ~/.claude/vibe/는 postinstall이 만든 전역 디렉토리)
    const isHome = path.resolve(projectRoot) === path.resolve(os.homedir());
    const hasProjectMarker = fs.existsSync(path.join(projectRoot, '.git'))
      || fs.existsSync(path.join(projectRoot, 'package.json'));
    const isProject = !isHome && hasProjectMarker
      && (fs.existsSync(coreDir) || fs.existsSync(legacyCoreDir));

    if (!isProject) {
      const packageJson = getPackageJson();
      log(`\n✅ core global updated (v${packageJson.version})\n\n${formatLLMStatus()}\n`);
      return;
    }

    ensureDir(coreDir);

    // 레거시 정리
    cleanupLegacy(projectRoot, claudeDir);

    // 기술 스택 감지
    const { stacks: detectedStacks, details: stackDetails } = detectTechStacks(projectRoot);

    // config.json에 저장된 사용자 선택 capabilities 병합 (init 시 선택한 값 보존)
    const configPath = path.join(coreDir, 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const existingConfig: VibeConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const storedCaps = existingConfig.details?.capabilities ?? [];
        if (storedCaps.length > 0) {
          const merged = new Set([...stackDetails.capabilities, ...storedCaps]);
          stackDetails.capabilities = [...merged];
        }
      } catch { /* ignore: optional operation */ }
    }

    // config.json 업데이트
    updateConfig(coreDir, detectedStacks, stackDetails, true);

    // constitution.md 업데이트
    updateConstitution(coreDir, detectedStacks, stackDetails);

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

    // 감지된 스택 언어 룰 설치/업데이트 (.claude/vibe/languages/)
    installLanguageRules(projectRoot, stackTypes);

    // Codex CLI 글로벌 에셋 업데이트
    updateCodexGlobalAssets(stackTypes, options);

    // Gemini CLI 글로벌 에셋 업데이트
    updateGeminiGlobalAssets(stackTypes, options);

    // Codex/Gemini 프로젝트 레벨 설정
    const codexStatus = detectCodexCli();
    if (codexStatus.installed) {
      updateCodexAgentsMd(projectRoot, detectedStacks);
    }
    const geminiStatus = detectGeminiCli();
    if (geminiStatus.installed) {
      updateGeminiMd(projectRoot, detectedStacks);
      installGeminiHooks(projectRoot);
    }

    // 스택 + capability 기반 로컬 스킬 업데이트 (.claude/skills/)
    installLocalSkills(projectRoot, stackTypes, stackDetails.capabilities);

    // 스택 기반 외부 스킬 자동 설치 (skills.sh)
    installExternalSkills(projectRoot, stackTypes, stackDetails.capabilities);

    // Provisioner: 추천 에이전트 + SPEC 템플릿 생성 (미존재 시에만)
    Provisioner.provision(projectRoot, detectedStacks, stackDetails);

    // ~/.claude.json 정리
    cleanupClaudeConfig();

    // 레거시 mcp 폴더 정리
    cleanupLegacyMcp(coreDir);

    const packageJson = getPackageJson();

    const authStatus = getLLMAuthStatus();
    log(`\n✅ vibe updated (v${packageJson.version})\n\n${formatLLMStatus()}\n${formatVoiceHint(authStatus.gemini.length > 0)}\n📦 Context7 plugin (recommended): /plugin install context7\n`);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Update failed:', message);
    process.exit(1);
  }
}
