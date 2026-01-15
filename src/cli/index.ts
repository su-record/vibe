#!/usr/bin/env node

/**
 * vibe CLI (TypeScript version 2.0)
 * SPEC-driven AI coding framework (Claude Code 전용)
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

// 분리된 모듈 import
import { CliOptions, VibeConfig } from './types.js';
import {
  log,
  setSilentMode,
  ensureDir,
  removeDirRecursive,
  getPackageJson,
  compareVersions,
} from './utils.js';
import { unregisterMcp } from './mcp.js';
import { detectTechStacks } from './detect.js';
import { formatLLMStatus, getLLMAuthStatus } from './auth.js';
import { setupCollaboratorAutoInstall } from './collaborator.js';
import {
  setupExternalLLM,
  removeExternalLLM,
  gptAuth,
  gptStatus,
  gptLogout,
  geminiAuth,
  geminiStatus,
  geminiLogout,
  showAuthHelp,
  showLogoutHelp,
} from './llm.js';
import {
  registerMcpServers,
  updateConstitution,
  updateClaudeMd,
  updateRules,
  installGlobalAssets,
  migrateLegacyVibe,
  updateGitignore,
  updateConfig,
  cleanupLegacy,
  removeLocalAssets,
  cleanupClaudeConfig,
  cleanupLegacyMcp,
} from './setup.js';

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Constants
// ============================================================================

const args = process.argv.slice(2);
const command = args[0];

const options: CliOptions = {
  silent: args.includes('--silent') || args.includes('-s')
};

const positionalArgs = args.filter(arg => !arg.startsWith('-'));

// Silent 모드 설정
setSilentMode(options.silent);

// ============================================================================
// Main Commands
// ============================================================================

async function init(projectName?: string): Promise<void> {
  try {
    let projectRoot = process.cwd();
    let isNewProject = false;

    if (projectName) {
      projectRoot = path.join(process.cwd(), projectName);

      if (fs.existsSync(projectRoot)) {
        log(`❌ 폴더가 이미 존재합니다: ${projectName}/`);
        return;
      }

      log(`📁 새 프로젝트 생성: ${projectName}/\n`);
      fs.mkdirSync(projectRoot, { recursive: true });
      isNewProject = true;
    }

    const claudeDir = path.join(projectRoot, '.claude');
    const vibeDir = path.join(claudeDir, 'vibe');
    if (fs.existsSync(vibeDir)) {
      log('❌ .claude/vibe/ 폴더가 이미 존재합니다.');
      return;
    }

    ensureDir(vibeDir);

    // MCP 서버 등록
    log('🔧 Claude Code MCP 서버 등록 중 (전역)...\n');
    registerMcpServers(false);

    // .claude/vibe 폴더 구조 생성
    ['specs', 'features'].forEach(dir => {
      ensureDir(path.join(vibeDir, dir));
    });

    // 레거시 마이그레이션
    migrateLegacyVibe(projectRoot, vibeDir);

    // .gitignore 업데이트
    updateGitignore(projectRoot);

    // 전역 assets 설치
    installGlobalAssets(false);

    // 기술 스택 감지
    const { stacks: detectedStacks, details: stackDetails } = detectTechStacks(projectRoot);
    if (detectedStacks.length > 0) {
      log(`   🔍 감지된 기술 스택:\n`);
      detectedStacks.forEach(s => {
        log(`      - ${s.type}${s.path ? ` (${s.path}/)` : ''}\n`);
      });
      if (stackDetails.databases.length > 0) {
        log(`      - DB: ${stackDetails.databases.join(', ')}\n`);
      }
      if (stackDetails.stateManagement.length > 0) {
        log(`      - State: ${stackDetails.stateManagement.join(', ')}\n`);
      }
    }

    // constitution.md 생성
    updateConstitution(vibeDir, detectedStacks, stackDetails);

    // config.json 생성
    updateConfig(vibeDir, detectedStacks, stackDetails, false);

    // CLAUDE.md 병합
    updateClaudeMd(projectRoot, detectedStacks, false);

    // 규칙 복사
    updateRules(vibeDir, detectedStacks, false);

    // 협업자 자동 설치 설정
    setupCollaboratorAutoInstall(projectRoot);

    // 완료 메시지
    log(`
✅ vibe 초기화 완료!

${isNewProject ? `프로젝트 위치:
  ${projectRoot}/

` : ''}전역 설치 (~/.claude/):
  ~/.claude/
  ├── commands/                  # 슬래시 커맨드 (7개)
  ├── agents/                    # 서브에이전트
  ├── skills/                    # 스킬 (7개)
  └── settings.json              # Hooks + MCP 설정

프로젝트 설정 (.claude/vibe/):
  CLAUDE.md                      # 프로젝트 컨텍스트
  .claude/vibe/
  ├── config.json                # 프로젝트 설정
  ├── constitution.md            # 프로젝트 원칙
  ├── setup.sh                   # 협업자 설치 스크립트
  ├── rules/                     # 코딩 규칙
  │   ├── core/                  # 핵심 원칙
  │   ├── quality/               # 품질 체크리스트
  │   └── languages/             # 언어별 규칙
  ├── specs/                     # SPEC 문서들
  └── features/                  # BDD Feature 파일들

내장 도구: ✓ (35+)
협업자 자동 설치: ✓

${formatLLMStatus()}

사용법:
  /vibe.spec "기능명"            SPEC 작성 (대화형)
  /vibe.run "기능명"             구현 실행
  /vibe.verify "기능명"          검증

다음 단계:
  ${isNewProject ? `cd ${projectName}\n  ` : ''}/vibe.spec "기능명" 으로 시작하세요!
    `);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ 초기화 실패:', message);
    process.exit(1);
  }
}

async function checkAndUpgradeVibe(): Promise<boolean> {
  const currentVersion = getPackageJson().version;

  try {
    const latestVersion = execSync('npm view @su-record/vibe version', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();

    const isNewer = compareVersions(latestVersion, currentVersion) > 0;
    if (isNewer) {
      log(`   📦 새 버전 발견: v${currentVersion} → v${latestVersion}\n`);
      log('   ⬆️  vibe 업그레이드 중...\n');

      execSync('npm install -g @su-record/vibe@latest', {
        stdio: options.silent ? 'pipe' : 'inherit'
      });

      log('   ✅ vibe 업그레이드 완료!\n');

      log('   🔄 새 버전으로 업데이트 재실행...\n\n');
      execSync(`vibe update${options.silent ? ' --silent' : ''}`, {
        stdio: 'inherit',
        cwd: process.cwd()
      });
      return true;
    } else {
      log(`   ✅ 최신 버전 사용 중 (v${currentVersion})\n`);
      return false;
    }
  } catch { /* ignore: optional operation */
    log(`   ℹ️  버전 확인 스킵 (오프라인 또는 네트워크 오류)\n`);
    return false;
  }
}

async function update(): Promise<void> {
  try {
    const projectRoot = process.cwd();
    const vibeDir = path.join(projectRoot, '.claude', 'vibe');
    const claudeDir = path.join(projectRoot, '.claude');
    const legacyVibeDir = path.join(projectRoot, '.vibe');

    // CI/프로덕션 환경에서는 스킵
    if (process.env.NODE_ENV === 'production' || process.env.CI === 'true') {
      return;
    }

    // 레거시 마이그레이션
    if (fs.existsSync(legacyVibeDir) && !fs.existsSync(vibeDir)) {
      migrateLegacyVibe(projectRoot, vibeDir);
    }

    if (!fs.existsSync(vibeDir) && !fs.existsSync(legacyVibeDir)) {
      if (!options.silent) {
        console.log('❌ vibe 프로젝트가 아닙니다. 먼저 vibe init을 실행하세요.');
      }
      return;
    }

    ensureDir(vibeDir);

    log('🔄 vibe 업데이트 중...\n');

    // 최신 버전 확인
    if (!options.silent) {
      const wasUpgraded = await checkAndUpgradeVibe();
      if (wasUpgraded) return;
    }

    // 레거시 정리
    cleanupLegacy(projectRoot, claudeDir);

    // 기술 스택 감지
    const { stacks: detectedStacks, details: stackDetails } = detectTechStacks(projectRoot);

    // config.json 업데이트
    updateConfig(vibeDir, detectedStacks, stackDetails, true);

    // constitution.md 업데이트
    updateConstitution(vibeDir, detectedStacks, stackDetails);
    log('   ✅ constitution.md 업데이트 완료\n');

    // CLAUDE.md 업데이트
    updateClaudeMd(projectRoot, detectedStacks, true);

    // 규칙 업데이트
    updateRules(vibeDir, detectedStacks, true);

    if (detectedStacks.length > 0) {
      const detectedTypes = new Set(detectedStacks.map(s => s.type));
      log(`   🔍 감지된 기술 스택: ${Array.from(detectedTypes).join(', ')}\n`);
    }

    // 전역 assets 업데이트
    installGlobalAssets(true);

    // 프로젝트 로컬 자산 제거
    removeLocalAssets(claudeDir);

    // .gitignore 업데이트
    updateGitignore(projectRoot);

    // 협업자 자동 설치 설정
    setupCollaboratorAutoInstall(projectRoot);

    // ~/.claude.json 정리
    cleanupClaudeConfig();

    // MCP 서버 등록
    registerMcpServers(true);

    // 레거시 mcp 폴더 정리
    cleanupLegacyMcp(vibeDir);

    const packageJson = getPackageJson();
    log(`
✅ vibe 업데이트 완료! (v${packageJson.version})

업데이트된 항목:
  - 슬래시 커맨드 (7개)
  - 코딩 규칙 (.claude/vibe/rules/)
  - 서브에이전트 (.claude/agents/)
  - Hooks 설정

${formatLLMStatus()}
    `);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ 업데이트 실패:', message);
    process.exit(1);
  }
}

function remove(): void {
  const projectRoot = process.cwd();
  const vibeDir = path.join(projectRoot, '.claude', 'vibe');
  const legacyVibeDir = path.join(projectRoot, '.vibe');
  const claudeDir = path.join(projectRoot, '.claude');

  if (!fs.existsSync(vibeDir) && !fs.existsSync(legacyVibeDir)) {
    console.log('❌ vibe 프로젝트가 아닙니다.');
    return;
  }

  console.log('🗑️  vibe 제거 중...\n');

  // MCP 서버 제거
  unregisterMcp('vibe');
  unregisterMcp('vibe-gemini');
  unregisterMcp('vibe-gpt');
  unregisterMcp('context7');
  console.log('   ✅ MCP 서버 제거 완료\n');

  // .claude/vibe 폴더 제거
  if (fs.existsSync(vibeDir)) {
    removeDirRecursive(vibeDir);
    console.log('   ✅ .claude/vibe/ 폴더 제거 완료\n');
  }

  // 레거시 .vibe 폴더도 제거
  if (fs.existsSync(legacyVibeDir)) {
    removeDirRecursive(legacyVibeDir);
    console.log('   ✅ .vibe/ 폴더 제거 완료 (레거시)\n');
  }

  // .claude/commands 제거
  const commandsDir = path.join(claudeDir, 'commands');
  if (fs.existsSync(commandsDir)) {
    const vibeCommands = ['vibe.spec.md', 'vibe.run.md', 'vibe.verify.md', 'vibe.reason.md', 'vibe.analyze.md', 'vibe.ui.md', 'vibe.diagram.md'];
    vibeCommands.forEach(cmd => {
      const cmdPath = path.join(commandsDir, cmd);
      if (fs.existsSync(cmdPath)) {
        fs.unlinkSync(cmdPath);
      }
    });
    console.log('   ✅ 슬래시 커맨드 제거 완료\n');
  }

  // .claude/agents 제거
  const agentsDir = path.join(claudeDir, 'agents');
  if (fs.existsSync(agentsDir)) {
    const vibeAgents = ['simplifier.md', 'explorer.md', 'implementer.md', 'tester.md', 'searcher.md'];
    vibeAgents.forEach(agent => {
      const agentPath = path.join(agentsDir, agent);
      if (fs.existsSync(agentPath)) {
        fs.unlinkSync(agentPath);
      }
    });
    console.log('   ✅ 서브에이전트 제거 완료\n');
  }

  // .claude/settings.json에서 hooks 제거
  const settingsPath = path.join(claudeDir, 'settings.json');
  if (fs.existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (settings.hooks) {
        delete settings.hooks;
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        console.log('   ✅ Hooks 설정 제거 완료\n');
      }
    } catch { /* ignore: optional operation */ }
  }

  console.log(`
✅ vibe 제거 완료!

제거된 항목:
  - MCP 서버 (vibe, context7)
  - .claude/vibe/ 폴더
  - 슬래시 커맨드 (7개)
  - 서브에이전트 (5개)
  - Hooks 설정

다시 설치하려면: vibe init
  `);
}

// ============================================================================
// Info Commands
// ============================================================================

function showHelp(): void {
  console.log(`
📖 Vibe - SPEC-driven AI coding framework (Claude Code 전용)

기본 명령어:
  vibe init [project]     프로젝트 초기화
  vibe update             설정 업데이트
  vibe status             현재 설정 상태
  vibe help               도움말
  vibe version            버전 정보

외부 LLM 인증:
  vibe auth gpt           GPT Plus/Pro OAuth 인증
  vibe auth gemini        Gemini 구독 OAuth 인증 (권장)
  vibe auth gpt --key <key>     GPT API 키 설정
  vibe auth gemini --key <key>  Gemini API 키 설정

상태 및 관리:
  vibe status             전체 상태 확인
  vibe status gpt         GPT 인증 상태 확인
  vibe status gemini      Gemini 인증 상태 확인
  vibe logout gpt         GPT 로그아웃
  vibe logout gemini      Gemini 로그아웃
  vibe remove gpt         GPT 제거
  vibe remove gemini      Gemini 제거
  vibe remove             vibe 전체 제거 (MCP, 설정, 패키지)

Claude Code 슬래시 커맨드:
  /vibe.spec "기능명"     SPEC 작성 (PTCF 구조) + 병렬 리서치
  /vibe.run "기능명"      구현 실행
  /vibe.run ... ultrawork 최대 성능 모드
  /vibe.verify "기능명"   BDD 검증
  /vibe.review            병렬 코드 리뷰 (13+ 에이전트)
  /vibe.reason "문제"     체계적 추론
  /vibe.analyze           프로젝트 분석
  /vibe.utils             유틸리티 (--e2e, --diagram, --continue)

모델 오케스트레이션:
  Opus 4.5    오케스트레이터 (메인)
  Sonnet 4    구현
  Haiku 4.5   코드 탐색
  GPT 5.2     아키텍처/디버깅 (선택적)
  Gemini 3    UI/UX 설계 (선택적)

Workflow:
  /vibe.spec → /vibe.run → /vibe.verify

문서:
  https://github.com/su-record/vibe
  `);
}

function showStatus(): void {
  const projectRoot = process.cwd();
  const vibeDir = path.join(projectRoot, '.claude', 'vibe');
  const configPath = path.join(vibeDir, 'config.json');

  if (!fs.existsSync(vibeDir)) {
    console.log('❌ vibe 프로젝트가 아닙니다. 먼저 vibe init을 실행하세요.');
    return;
  }

  const packageJson = getPackageJson();
  let config: VibeConfig = { language: 'ko', models: {} };
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  // 실제 OAuth 인증 상태 확인
  const authStatus = getLLMAuthStatus();

  // GPT 상태: OAuth 인증 > config enabled
  let gptStatusText = '⬚ 비활성';
  if (authStatus.gpt?.valid) {
    gptStatusText = authStatus.gpt.type === 'oauth'
      ? `✅ OAuth (${authStatus.gpt.email})`
      : '✅ API 키';
  } else if (config.models?.gpt?.enabled) {
    gptStatusText = '⚠️  설정됨 (인증 필요)';
  }

  // Gemini 상태: OAuth 인증 > config enabled
  let geminiStatusText = '⬚ 비활성';
  if (authStatus.gemini?.valid) {
    geminiStatusText = authStatus.gemini.type === 'oauth'
      ? `✅ OAuth (${authStatus.gemini.email})`
      : '✅ API 키';
  } else if (config.models?.gemini?.enabled) {
    geminiStatusText = '⚠️  설정됨 (인증 필요)';
  }

  console.log(`
📊 Vibe 상태 (v${packageJson.version})

프로젝트: ${projectRoot}
언어: ${config.language || 'ko'}

모델 오케스트레이션:
  Opus 4.5          오케스트레이터
  Sonnet 4          구현
  Haiku 4.5         코드 탐색
  GPT 5.2           ${gptStatusText}
  Gemini 3          ${geminiStatusText}

MCP 서버:
  context7          라이브러리 문서 검색

GPT/Gemini 호출 방식:
  Hook 기반 직접 호출 (MCP 불필요)
  - "gpt한테 물어봐" → GPT 자동 호출
  - "gemini한테 물어봐" → Gemini 자동 호출
  - import('@su-record/vibe/lib/gpt') 직접 사용

외부 LLM 설정:
  vibe auth gpt           GPT 활성화 (OAuth)
  vibe auth gemini        Gemini 활성화 (OAuth)
  vibe logout gpt         GPT 로그아웃
  vibe logout gemini      Gemini 로그아웃
  `);
}

function showVersion(): void {
  const packageJson = getPackageJson();
  console.log(`vibe v${packageJson.version}`);
}

// ============================================================================
// Tool Exports (for slash commands)
// ============================================================================

export * from '../lib/MemoryManager.js';
export * from '../lib/ProjectCache.js';
export * from '../lib/ContextCompressor.js';

export { saveMemory } from '../tools/memory/saveMemory.js';
export { recallMemory } from '../tools/memory/recallMemory.js';
export { listMemories } from '../tools/memory/listMemories.js';
export { deleteMemory } from '../tools/memory/deleteMemory.js';
export { updateMemory } from '../tools/memory/updateMemory.js';
export { searchMemoriesHandler as searchMemories } from '../tools/memory/searchMemories.js';
export { linkMemories } from '../tools/memory/linkMemories.js';
export { getMemoryGraph } from '../tools/memory/getMemoryGraph.js';
export { createMemoryTimeline } from '../tools/memory/createMemoryTimeline.js';
export { searchMemoriesAdvanced } from '../tools/memory/searchMemoriesAdvanced.js';
export { startSession } from '../tools/memory/startSession.js';
export { autoSaveContext } from '../tools/memory/autoSaveContext.js';
export { restoreSessionContext } from '../tools/memory/restoreSessionContext.js';
export { prioritizeMemory } from '../tools/memory/prioritizeMemory.js';
export { getSessionContext } from '../tools/memory/getSessionContext.js';

export { findSymbol } from '../tools/semantic/findSymbol.js';
export { findReferences } from '../tools/semantic/findReferences.js';
export { analyzeDependencyGraph } from '../tools/semantic/analyzeDependencyGraph.js';

export { analyzeComplexity } from '../tools/convention/analyzeComplexity.js';
export { validateCodeQuality } from '../tools/convention/validateCodeQuality.js';
export { checkCouplingCohesion } from '../tools/convention/checkCouplingCohesion.js';
export { suggestImprovements } from '../tools/convention/suggestImprovements.js';
export { applyQualityRules } from '../tools/convention/applyQualityRules.js';
export { getCodingGuide } from '../tools/convention/getCodingGuide.js';

export { createThinkingChain } from '../tools/thinking/createThinkingChain.js';
export { analyzeProblem } from '../tools/thinking/analyzeProblem.js';
export { stepByStepAnalysis } from '../tools/thinking/stepByStepAnalysis.js';
export { formatAsPlan } from '../tools/thinking/formatAsPlan.js';
export { breakDownProblem } from '../tools/thinking/breakDownProblem.js';
export { thinkAloudProcess } from '../tools/thinking/thinkAloudProcess.js';

export { generatePrd } from '../tools/planning/generatePrd.js';
export { createUserStories } from '../tools/planning/createUserStories.js';
export { analyzeRequirements } from '../tools/planning/analyzeRequirements.js';
export { featureRoadmap } from '../tools/planning/featureRoadmap.js';

export { enhancePrompt } from '../tools/prompt/enhancePrompt.js';
export { analyzePrompt } from '../tools/prompt/analyzePrompt.js';

export { previewUiAscii } from '../tools/ui/previewUiAscii.js';
export { getCurrentTime } from '../tools/time/getCurrentTime.js';

// ============================================================================
// Main Router
// ============================================================================

switch (command) {
  case 'init':
    init(positionalArgs[1]);
    break;

  case 'update':
    update();
    break;

  case 'remove':
  case 'uninstall':
    if (positionalArgs[1] === 'gpt' || positionalArgs[1] === 'gemini') {
      removeExternalLLM(positionalArgs[1]);
    } else {
      remove();
    }
    break;

  case 'auth':
    if (positionalArgs[1] === 'gpt') {
      const keyIndex = args.indexOf('--key');
      if (keyIndex !== -1 && args[keyIndex + 1]) {
        setupExternalLLM('gpt', args[keyIndex + 1]);
      } else {
        gptAuth();
      }
    } else if (positionalArgs[1] === 'gemini') {
      const keyIndex = args.indexOf('--key');
      if (keyIndex !== -1 && args[keyIndex + 1]) {
        setupExternalLLM('gemini', args[keyIndex + 1]);
      } else {
        geminiAuth();
      }
    } else {
      showAuthHelp();
    }
    break;

  case 'logout':
    if (positionalArgs[1] === 'gpt') {
      gptLogout();
    } else if (positionalArgs[1] === 'gemini') {
      geminiLogout();
    } else {
      showLogoutHelp();
    }
    break;

  case 'status':
    if (positionalArgs[1] === 'gpt') {
      gptStatus();
    } else if (positionalArgs[1] === 'gemini') {
      geminiStatus();
    } else {
      showStatus();
    }
    break;

  case 'version':
  case '-v':
  case '--version':
    showVersion();
    break;

  case 'help':
  case '-h':
  case '--help':
  case undefined:
    showHelp();
    break;

  default:
    console.log(`
❌ 알 수 없는 명령어: ${command}

사용 가능한 명령어:
  vibe init       프로젝트 초기화
  vibe update     설정 업데이트
  vibe auth       LLM 인증 (gpt, gemini)
  vibe status     상태 확인
  vibe logout     로그아웃
  vibe remove     제거
  vibe help       도움말
  vibe version    버전 정보

사용법: vibe help
    `);
    process.exit(1);
}
