/**
 * 정보 명령어 (help, status, version)
 */

import path from 'path';
import fs from 'fs';
import { VibeConfig } from '../types.js';
import { getPackageJson } from '../utils.js';
import { formatLLMStatus } from '../auth.js';
import { detectCodexCli } from '../utils/cli-detector.js';

/**
 * 도움말 표시
 */
export function showHelp(): void {
  console.log(`
VIBE - AI Coding Harness (Claude Code / Codex / Antigravity)

Commands:
  vibe setup              셋업 위자드 (인증, 설정 한번에)
  vibe init [project]     프로젝트 초기화 (.claude/ 대상)
  vibe init --codex       프로젝트 초기화 (.codex/ + AGENTS.md)
  vibe init --antigravity 프로젝트 초기화 (.gemini/ + GEMINI.md)
  vibe update             설정 업데이트
  vibe upgrade            최신 버전으로 업그레이드
  vibe remove             프로젝트에서 제거
  vibe status             전체 상태 확인
  vibe plugin [install]   Codex/ChatGPT 플러그인으로 설치 (status 로 상태 확인)
  vibe config show        설정 통합 보기 (모든 소스)
  vibe stats              세션 통계 및 품질 트렌드
  vibe env import [path]  .env → ~/.vibe/config.json 가져오기

LLM:
  vibe claude <cmd>       Claude (key, status, logout)
  vibe gpt <cmd>          GPT (key, status, logout)
  vibe antigravity <cmd>  Antigravity (key, status, logout)
  vibe zai <cmd>          ZAI / GLM (coding-key, key, status, logout)
  vibe llm <cmd>          List / refresh available models (list, refresh)

Figma:
  vibe figma setup <token>  Set Figma access token
  vibe figma breakpoints    Show/set responsive breakpoints
  vibe figma status         Check configuration

Skills:
  vibe skills add <pkg>   Install skill from skills.sh

Slash Commands (Claude Code / Codex):
  /vibe.spec "feature"    SPEC 작성 + 리서치
  /vibe.run "feature"     구현 실행
  /vibe.verify "feature"  BDD 검증
  /vibe.review            병렬 코드 리뷰 (13+ agents)
  /vibe.reason "problem"  체계적 추론
  /vibe.analyze           프로젝트 분석
  /vibe.trace "feature"   요구사항 추적 매트릭스
  /vibe.continue          세션 복원 (컨텍스트 이어가기)
  /vibe.image             이미지 생성
  /vibe.figma             Figma 디자인 → 코드 변환

Docs: https://github.com/su-record/vibe
  `);
}

/**
 * 프로젝트 훅 설치 상태 — 하네스별 한 줄 요약.
 *
 * WHY: 훅이 없으면 sentinel-guard·scope-guard·run-ledger·verify 게이트가 전부
 * 조용히 죽는다. 그런데 `vibe upgrade` 는 전역 자산만 갱신하므로 upgrade 만 쓰는
 * 사용자는 이 상태에 도달하고도 알 방법이 없었다. 상태 화면이 결정론적 가드의
 * 생사를 보여주지 않으면 loop-contract 의 전제를 검증할 수단이 없다.
 */
export function formatHookStatus(
  projectRoot: string,
  /** Codex CLI 설치 여부 — 생략하면 감지한다. 테스트가 머신 상태에 좌우되지 않도록 주입 가능. */
  codexInstalled: boolean = detectCodexCli().installed,
): string {
  const lines: string[] = [];

  const claudeSettings = path.join(projectRoot, '.claude', 'settings.local.json');
  let claudeOk = false;
  try {
    const parsed = JSON.parse(fs.readFileSync(claudeSettings, 'utf-8')) as { hooks?: unknown };
    claudeOk = Boolean(parsed.hooks);
  } catch { /* 없거나 손상 → 미설치 취급 */ }
  lines.push(
    claudeOk
      ? '  Claude Code         ✓ .claude/settings.local.json'
      : '  Claude Code         ⬚ not installed (run: vibe update)',
  );

  // Codex 훅 보고 여부는 **아티팩트가 아니라 하네스 설치 여부**로 정한다.
  //
  // 아티팩트(.codex/, AGENTS.md)로만 판정하면, 그 둘이 gitignore 대상이라
  // fresh clone 에서는 "Codex 프로젝트가 아니다" 로 결론내고 행 자체를 숨긴다 —
  // 정작 보고해야 할 미설치 상태에서 침묵하는 셈이다. `vibe init` 은 이미
  // detectCodexCli().installed 로 설치를 결정하므로 판정 기준을 거기에 맞춘다.
  const isCodexProject =
    codexInstalled ||
    fs.existsSync(path.join(projectRoot, '.codex')) ||
    fs.existsSync(path.join(projectRoot, 'AGENTS.md'));
  if (isCodexProject) {
    const codexOk = fs.existsSync(path.join(projectRoot, '.codex', 'hooks.json'));
    lines.push(
      codexOk
        ? '  Codex               ✓ .codex/hooks.json'
        : '  Codex               ⬚ not installed (run: vibe update)',
    );
  }

  return lines.join('\n');
}

/**
 * 상태 표시 — 모든 시스템 상태를 한 곳에서 확인
 */
export function showStatus(): void {
  const projectRoot = process.cwd();
  const coreDir = path.join(projectRoot, '.vibe');
  const legacyCoreDir = path.join(projectRoot, '.claude', 'vibe');
  const activeCoreDir = fs.existsSync(coreDir) ? coreDir : legacyCoreDir;
  const configPath = path.join(activeCoreDir, 'config.json');

  const packageJson = getPackageJson();
  const isCoreProject = fs.existsSync(activeCoreDir);

  let config: VibeConfig & Record<string, unknown> = { language: 'ko', models: {} };
  if (isCoreProject && fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }

  // 프로젝트 상태
  const projectStatus = isCoreProject
    ? `✅ ${projectRoot}`
    : `⬚ Not a core project (run: vibe init)`;

  console.log(`
VIBE Status (v${packageJson.version})

Project: ${projectStatus}
${isCoreProject ? `Language: ${config.language || 'ko'}\n` : ''}
${isCoreProject ? `Hooks (deterministic gates):\n${formatHookStatus(projectRoot)}\n` : ''}
${formatLLMStatus()}
  `);
}

/**
 * 버전 표시
 */
export function showVersion(): void {
  const packageJson = getPackageJson();
  console.log(`core v${packageJson.version}`);
}
