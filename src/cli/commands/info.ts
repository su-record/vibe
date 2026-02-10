/**
 * 정보 명령어 (help, status, version)
 */

import path from 'path';
import fs from 'fs';
import { VibeConfig } from '../types.js';
import { getPackageJson, isSoxInstalled } from '../utils.js';
import { getLLMAuthStatus, formatAuthMethods } from '../auth.js';
import { loadSyncAuth } from '../../lib/sync/index.js';

/**
 * 도움말 표시
 */
export function showHelp(): void {
  console.log(`
VIBE - Personalized AI Agent (Claude Code exclusive)

Lifecycle:
  vibe setup              셋업 위자드 (인증, 채널, 설정 한번에)
  vibe start              데몬 시작 + 인터페이스 활성화
  vibe stop               데몬 중지
  vibe restart            데몬 재시작
  vibe status             전체 상태 확인

Commands:
  vibe init [project]     프로젝트 초기화
  vibe update             설정 업데이트
  vibe sync <cmd>         클라우드 동기화 (login, push, pull, status, logout)

Channels:
  vibe telegram <cmd>     Telegram (setup, chat, status)
  vibe slack <cmd>        Slack (setup, channel, status)

LLM:
  vibe gpt <cmd>          GPT (auth, key, status, logout)
  vibe gemini <cmd>       Gemini (auth, key, status, logout)
  vibe az <cmd>           AZ (key, status, logout)
  vibe kimi <cmd>         Kimi (key, status, logout)
  vibe config <cmd>       Provider priority (embedding-priority, kimi-priority, show)

Slash Commands (Claude Code):
  /vibe.spec "feature"    SPEC 작성 + 리서치
  /vibe.run "feature"     구현 실행
  /vibe.verify "feature"  BDD 검증
  /vibe.review            병렬 코드 리뷰 (13+ agents)
  /vibe.reason "problem"  체계적 추론
  /vibe.analyze           프로젝트 분석
  /vibe.trace "feature"   요구사항 추적 매트릭스
  /vibe.utils             유틸리티 (--e2e, --diagram, --continue)
  /vibe.voice             음성 코딩 (Gemini + sox)

Docs: https://github.com/su-record/core
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

  const gptStatusText = formatAuthMethods(authStatus.gpt);
  const geminiStatusText = formatAuthMethods(authStatus.gemini);
  const azStatusText = formatAuthMethods(authStatus.az);
  const kimiStatusText = formatAuthMethods(authStatus.kimi);

  // Voice 상태 (Gemini 활성화 + sox 설치)
  let voiceStatusText = '⬚ Disabled (requires Gemini)';
  if (authStatus.gemini.length > 0) {
    if (isSoxInstalled()) {
      voiceStatusText = '✅ Ready';
    } else {
      const soxCmd = process.platform === 'darwin' ? 'brew install sox'
        : process.platform === 'win32' ? 'choco install sox' : 'apt install sox';
      voiceStatusText = `⚠️  sox not installed (${soxCmd})`;
    }
  }

  // vibe sync 상태
  const syncAuth = loadSyncAuth();
  const syncStatusText = syncAuth ? `✅ ${syncAuth.email ?? 'Logged in'}` : '⬚ Not logged in (vibe sync login)';

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
  GPT             ${gptStatusText}
  Gemini          ${geminiStatusText}
  AZ              ${azStatusText}
  Kimi            ${kimiStatusText}

Agent:
  Autonomy        ${autonomyMode} mode
  Sentinel        ${sentinelOn ? 'ON' : 'OFF'}
  Proactive       ${proactiveOn ? 'ON' : 'OFF'}
${dbStats}
Features:
  /vibe.voice       ${voiceStatusText}
  vibe sync         ${syncStatusText}
  `);
}

/**
 * 버전 표시
 */
export function showVersion(): void {
  const packageJson = getPackageJson();
  console.log(`core v${packageJson.version}`);
}
