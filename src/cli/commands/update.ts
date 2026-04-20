/**
 * update 명령어 — 프로젝트 설정 업데이트
 * 패키지 업그레이드는 `vibe upgrade` 사용
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { CliOptions, VibeConfig } from '../types.js';
import { log, ensureDir, getPackageJson } from '../utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { detectTechStacks } from '../detect.js';
import { formatLLMStatus } from '../auth.js';
import { setupCollaboratorAutoInstall } from '../collaborator.js';
import {
  updateConstitution,
  updateRules,
  migrateLegacyCore,
  consolidateLegacyVibe,
  updateGitignore,
  updateConfig,
  cleanupLegacy,
  removeLocalAssets,
  cleanupClaudeConfig,
  cleanupLegacyMcp,
  installProjectHooks,
  installCursorRules,
  generateProjectClaudeMd,
  generateProjectAgentsMd,
  generateProjectGeminiMd,
  generateGlobalClaudeMd,
  generateGlobalAgentsMd,
  generateGlobalCodexAgentsMd,
  generateGlobalGeminiMd,
} from '../setup.js';
import {
  updateCursorGlobalAssets,
  installLocalSkills,
  installLanguageRules,
} from './init.js';
import { installExternalSkills } from './skills.js';
import { detectCocoCli, detectCodexCli, detectGeminiCli } from '../utils/cli-detector.js';
import { Provisioner } from '../setup/Provisioner.js';

/**
 * scope.json을 활성 SPEC 기반으로 자동 동기화.
 * 수동 관리(auto != true) 중이거나 SPEC이 없으면 no-op.
 */
function syncProjectScope(projectRoot: string, packageRoot: string): void {
  try {
    const scriptPath = path.join(packageRoot, 'hooks', 'scripts', 'lib', 'scope-from-spec.js');
    if (!fs.existsSync(scriptPath)) return;
    execSync(`node "${scriptPath}" "${projectRoot}"`, { stdio: 'inherit', timeout: 5000 });
  } catch { /* best-effort */ }
}

/**
 * update 명령어 실행 — 프로젝트 설정만 업데이트
 */
export function update(options: CliOptions = { silent: false }): void {
  try {
    const projectRoot = process.cwd();
    const coreDir = path.join(projectRoot, '.vibe');
    const claudeDir = path.join(projectRoot, '.claude');
    const legacyCoreDir = path.join(projectRoot, '.core');

    // CI/프로덕션 환경에서는 스킵
    if (process.env.NODE_ENV === 'production' || process.env.CI === 'true') {
      return;
    }

    // SSOT 통합 — `.claude/vibe/`, `.coco/vibe/`, `.claude/memories/`, `.coco/memories/` → `.vibe/`
    // (legacy 와 `.vibe/` 가 공존해도 안전하게 병합)
    const consolidated = consolidateLegacyVibe(projectRoot);
    if (consolidated.length > 0) {
      log(`📦 Consolidated into .vibe/: ${consolidated.join(', ')}\n`);
    }

    // 레거시 `.core/` 마이그레이션
    if (fs.existsSync(legacyCoreDir) && !fs.existsSync(coreDir)) {
      migrateLegacyCore(projectRoot, coreDir);
    }

    // 프로젝트 감지
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

    // config.json 업데이트 — 현재 프로젝트의 주 harness 감지 (우선순위: coco > codex > gemini > claude)
    const HARNESS_PRIORITY = ['.coco', '.codex', '.gemini', '.claude'];
    const primaryHarness =
      HARNESS_PRIORITY.find(d => fs.existsSync(path.join(projectRoot, d))) || '.claude';
    updateConfig(coreDir, detectedStacks, stackDetails, true, primaryHarness);

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

    // 프로젝트 레벨 훅 설치 — 존재하는 하네스 디렉토리 모두 대응
    //   .gemini/는 hook 스키마 다름 → 스킵
    const PROJECT_HARNESS_DIRS = ['.claude', '.coco', '.codex'];
    const presentHarnesses = PROJECT_HARNESS_DIRS.filter(d =>
      fs.existsSync(path.join(projectRoot, d))
    );
    const hookTargets = presentHarnesses.length > 0 ? presentHarnesses : ['.claude'];
    for (const hd of hookTargets) {
      installProjectHooks(projectRoot, hd);
    }

    // Cursor 글로벌 에셋 업데이트 (agents, skills, rules-template) - 먼저 실행!
    const stackTypes = detectedStacks.map(s => s.type);
    updateCursorGlobalAssets(stackTypes, options);

    // Cursor IDE 룰 설치/업데이트 (프로젝트 레벨) - rules-template 생성 후 현재 스택에 해당하는 룰만 복사
    installCursorRules(projectRoot, stackTypes);

    // 감지된 스택 언어 룰 설치/업데이트 (.claude/vibe/languages/)
    installLanguageRules(projectRoot, stackTypes);

    // ── 전역 규약 갱신 ── 감지된 CLI 모두
    const cocoStatus = detectCocoCli();
    const codexStatus = detectCodexCli();
    const geminiStatus = detectGeminiCli();
    generateGlobalClaudeMd();
    if (cocoStatus.installed) generateGlobalAgentsMd();
    if (codexStatus.installed) generateGlobalCodexAgentsMd();
    if (geminiStatus.installed) generateGlobalGeminiMd();

    // ── 프로젝트 엔트리 갱신 ── 로컬 폴더 구성에 맞춰 동적으로
    //   - 이미 존재하는 CLAUDE.md / AGENTS.md / GEMINI.md 만 갱신 (createIfMissing=false)
    //   - 존재하지 않는 파일은 건드리지 않음 (init에서만 생성)
    generateProjectClaudeMd(projectRoot, detectedStacks, stackDetails, false);
    generateProjectAgentsMd(projectRoot, detectedStacks, stackDetails, false);
    generateProjectGeminiMd(projectRoot, detectedStacks, stackDetails, false);

    // 스택 + capability 기반 로컬 스킬 업데이트 — 존재하는 하네스 디렉토리 모두 대응
    for (const hd of hookTargets) {
      installLocalSkills(projectRoot, stackTypes, stackDetails.capabilities, hd);
    }

    // 스택 기반 외부 스킬 자동 설치 (skills.sh)
    installExternalSkills(projectRoot, stackTypes, stackDetails.capabilities);

    // Provisioner: 추천 에이전트 + SPEC 템플릿 생성 (미존재 시에만)
    Provisioner.provision(projectRoot, detectedStacks, stackDetails);

    // ~/.claude.json 정리
    cleanupClaudeConfig();

    // 레거시 mcp 폴더 정리
    cleanupLegacyMcp(coreDir);

    // scope.json 자동 동기화 (활성 SPEC 기반)
    syncProjectScope(projectRoot, packageRoot);

    const packageJson = getPackageJson();

    log(`\n✅ vibe updated (v${packageJson.version})\n\n${formatLLMStatus()}\n📦 Context7 plugin (recommended): /plugin install context7\n`);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Update failed:', message);
    process.exit(1);
  }
}
