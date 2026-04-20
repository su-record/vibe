/**
 * 정보 명령어 (help, status, version)
 */

import path from 'path';
import fs from 'fs';
import { VibeConfig } from '../types.js';
import { getPackageJson } from '../utils.js';
import { formatLLMStatus } from '../auth.js';

/**
 * 도움말 표시
 */
export function showHelp(): void {
  console.log(`
VIBE - Personalized AI Agent (Claude Code exclusive)

Commands:
  vibe setup              셋업 위자드 (인증, 설정 한번에)
  vibe init [project]     프로젝트 초기화 (.claude/ 대상)
  vibe init --coco        프로젝트 초기화 (.coco/ 대상)
  vibe init --codex       프로젝트 초기화 (.codex/ + AGENTS.md)
  vibe init --gemini      프로젝트 초기화 (.gemini/ + GEMINI.md)
  vibe update             설정 업데이트
  vibe upgrade            최신 버전으로 업그레이드
  vibe remove             프로젝트에서 제거
  vibe status             전체 상태 확인
  vibe config show        설정 통합 보기 (모든 소스)
  vibe stats              세션 통계 및 품질 트렌드
  vibe env import [path]  .env → ~/.vibe/config.json 가져오기

LLM:
  vibe claude <cmd>       Claude (key, status, logout)
  vibe gpt <cmd>          GPT (key, status, logout)
  vibe gemini <cmd>       Gemini (key, status, logout)

Figma:
  vibe figma setup <token>  Set Figma access token
  vibe figma breakpoints    Show/set responsive breakpoints
  vibe figma status         Check configuration

Skills:
  vibe skills add <pkg>   Install skill from skills.sh

Slash Commands (Claude Code):
  /vibe.spec "feature"    SPEC 작성 + 리서치
  /vibe.run "feature"     구현 실행
  /vibe.verify "feature"  BDD 검증
  /vibe.review            병렬 코드 리뷰 (13+ agents)
  /vibe.reason "problem"  체계적 추론
  /vibe.analyze           프로젝트 분석
  /vibe.trace "feature"   요구사항 추적 매트릭스
  /vibe.utils             유틸리티 (--e2e, --diagram, --continue)
  /vibe.figma             Figma 디자인 → 코드 변환

Docs: https://github.com/su-record/vibe
  `);
}

/**
 * 상태 표시 — 모든 시스템 상태를 한 곳에서 확인
 */
export function showStatus(): void {
  const projectRoot = process.cwd();
  const coreDir = path.join(projectRoot, '.claude', 'vibe');
  const configPath = path.join(coreDir, 'config.json');

  const packageJson = getPackageJson();
  const isCoreProject = fs.existsSync(coreDir);

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
