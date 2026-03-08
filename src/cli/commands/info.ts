/**
 * 정보 명령어 (help, status, version)
 */

import path from 'path';
import fs from 'fs';
import { VibeConfig } from '../types.js';
import { getPackageJson } from '../utils.js';
import { getLLMAuthStatus, formatAuthMethods } from '../auth.js';
import { getGlobalConfigDir } from '../llm/config.js';
import { detectCodexCli, detectGeminiCli } from '../utils/cli-detector.js';

/**
 * 도움말 표시
 */
export function showHelp(): void {
  console.log(`
VIBE - Personalized AI Agent (Claude Code exclusive)

Commands:
  vibe setup              셋업 위자드 (인증, 채널, 설정 한번에)
  vibe init [project]     프로젝트 초기화
  vibe update             설정 업데이트
  vibe upgrade            최신 버전으로 업그레이드
  vibe remove             프로젝트에서 제거
  vibe status             전체 상태 확인

LLM:
  vibe claude <cmd>       Claude (key, status, logout)
  vibe gpt <cmd>          GPT (auth, key, status, logout)
  vibe gemini <cmd>       Gemini (auth, key, status, logout)
  vibe env import [path]  .env → ~/.vibe/config.json 가져오기

Skills:
  vibe skills add <pkg>   Install skill from skills.sh

Channels:
  vibe telegram <cmd>     Telegram (setup, chat, status)
  vibe slack <cmd>        Slack (setup, channel, status)

Slash Commands (Claude Code):
  /vibe.spec "feature"    SPEC 작성 + 리서치
  /vibe.run "feature"     구현 실행
  /vibe.verify "feature"  BDD 검증
  /vibe.review            병렬 코드 리뷰 (13+ agents)
  /vibe.reason "problem"  체계적 추론
  /vibe.analyze           프로젝트 분석
  /vibe.trace "feature"   요구사항 추적 매트릭스
  /vibe.utils             유틸리티 (--e2e, --diagram, --continue)

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

  const authStatus = getLLMAuthStatus();

  const codexCli = detectCodexCli();
  const geminiCli = detectGeminiCli();

  const claudeStatusText = formatAuthMethods(authStatus.claude);
  const gptStatusText = formatAuthMethods(authStatus.gpt, codexCli.installed);
  const geminiStatusText = formatAuthMethods(authStatus.gemini, geminiCli.installed);

  // 프로젝트 상태
  const projectStatus = isCoreProject
    ? `✅ ${projectRoot}`
    : `⬚ Not a core project (run: vibe init)`;

  // Autonomy / Sentinel 상태 (config.json에서 읽기)
  const autonomyCfg = config.autonomy as Record<string, unknown> | undefined;
  const sentinelCfg = config.sentinel as Record<string, unknown> | undefined;
  const autonomyMode = (autonomyCfg?.mode as string) || 'suggest';
  const sentinelOn = sentinelCfg?.enabled !== false;
  const proactiveCfg = autonomyCfg?.proactive as Record<string, unknown> | undefined;
  const proactiveOn = proactiveCfg?.enabled !== false;

  // DB 통계 (가능하면)
  let dbStats = '';
  try {
    const dbPath = path.join(coreDir, 'memory.db');
    if (fs.existsSync(dbPath)) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Database = require('better-sqlite3');
      const db = new Database(dbPath, { readonly: true });
      const last24h = new Date(Date.now() - 86_400_000).toISOString();

      let totalActions = 0;
      let blockedActions = 0;
      try {
        totalActions = (db.prepare('SELECT COUNT(*) as c FROM audit_events WHERE createdAt >= ?').get(last24h) as { c: number })?.c ?? 0;
        blockedActions = (db.prepare("SELECT COUNT(*) as c FROM audit_events WHERE createdAt >= ? AND outcome = 'blocked'").get(last24h) as { c: number })?.c ?? 0;
      } catch { /* table may not exist */ }

      if (totalActions > 0) {
        dbStats = `  Last 24h: ${totalActions} actions (${blockedActions} blocked)\n`;
      }
      db.close();
    }
  } catch { /* DB not available */ }

  console.log(`
VIBE Status (v${packageJson.version})

Project: ${projectStatus}
${isCoreProject ? `Language: ${config.language || 'ko'}` : ''}

LLM:
  Claude          ${claudeStatusText}
  GPT             ${gptStatusText}
  Gemini          ${geminiStatusText}

Agent:
  Autonomy        ${autonomyMode} mode
  Sentinel        ${sentinelOn ? 'ON' : 'OFF'}
  Proactive       ${proactiveOn ? 'ON' : 'OFF'}
${dbStats}
Services:
  Google Apps      ${fs.existsSync(path.join(getGlobalConfigDir(), 'google-tokens.json')) ? '\u2705 Connected (Gmail, Drive, Sheets, Calendar, YouTube)' : '\u2B1A Not connected (vibe setup)'}

  `);
}

/**
 * 버전 표시
 */
export function showVersion(): void {
  const packageJson = getPackageJson();
  console.log(`core v${packageJson.version}`);
}
