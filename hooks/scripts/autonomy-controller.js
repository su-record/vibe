#!/usr/bin/env node
/**
 * Autonomy Controller — /autonomy suggest|auto|disabled|status
 *
 * config.json의 autonomy.mode를 변경하거나 상태를 표시합니다.
 */
import fs from 'fs';
import path from 'path';

const prompt = process.argv[2] || '';
const match = /^\/autonomy\s+(\w+)/i.exec(prompt);
if (!match) process.exit(0);

const action = match[1].toLowerCase();
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const configPath = path.join(PROJECT_DIR, '.claude', 'vibe', 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch { /* ignore */ }
  return {};
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (e) {
    process.stderr.write(`[Autonomy] Config save error: ${e.message}\n`);
  }
}

const VALID_MODES = ['suggest', 'auto', 'disabled'];

if (VALID_MODES.includes(action)) {
  const config = loadConfig();
  if (!config.autonomy) config.autonomy = {};
  config.autonomy.mode = action;
  saveConfig(config);

  const modeDesc = {
    suggest: 'Suggest mode — 분해 결과만 표시, 사용자 승인 후 실행',
    auto: 'Auto mode — LOW/MEDIUM 자동 실행, HIGH는 오너 확인',
    disabled: 'Disabled — TaskDecomposer 비활성화',
  };

  console.log(`🤖 Autonomy mode → ${action}`);
  console.log(`   ${modeDesc[action]}`);
} else if (action === 'status') {
  const config = loadConfig();
  const mode = config.autonomy?.mode || 'suggest';
  const sentinelEnabled = config.sentinel?.enabled !== false;
  const proactiveEnabled = config.autonomy?.proactive?.enabled !== false;
  const timeout = config.sentinel?.confirmationTimeout || 300;
  const maxSteps = config.autonomy?.maxConcurrentSteps || 3;

  console.log(`🤖 Agent Autonomy: ${mode} mode`);
  console.log(`   🛡️ Sentinel: ${sentinelEnabled ? 'enabled' : 'disabled'}`);
  console.log(`   💡 Proactive: ${proactiveEnabled ? 'enabled' : 'disabled'}`);
  console.log(`   ⏱️ Confirmation timeout: ${timeout}s`);
  console.log(`   🔄 Max concurrent steps: ${maxSteps}`);

  // DB 통계 (가능하면)
  try {
    const { getLibBaseUrl } = await import('./utils.js');
    const LIB_BASE = getLibBaseUrl();
    const memMod = await import(`${LIB_BASE}memory/MemoryStorage.js`);
    const storage = new memMod.MemoryStorage(PROJECT_DIR);
    const db = storage.getDatabase();

    const last24h = new Date(Date.now() - 86_400_000).toISOString();

    let totalActions = 0;
    let blockedActions = 0;
    let pendingSuggestions = 0;
    let pendingConfirmations = 0;

    try {
      totalActions = db.prepare('SELECT COUNT(*) as c FROM audit_events WHERE createdAt >= ?').get(last24h)?.c ?? 0;
      blockedActions = db.prepare("SELECT COUNT(*) as c FROM audit_events WHERE createdAt >= ? AND outcome = 'blocked'").get(last24h)?.c ?? 0;
    } catch { /* table may not exist */ }

    try {
      pendingSuggestions = db.prepare("SELECT COUNT(*) as c FROM suggestions WHERE status = 'pending'").get()?.c ?? 0;
    } catch { /* table may not exist */ }

    try {
      pendingConfirmations = db.prepare("SELECT COUNT(*) as c FROM confirmations WHERE status = 'pending'").get()?.c ?? 0;
    } catch { /* table may not exist */ }

    if (totalActions > 0 || pendingSuggestions > 0 || pendingConfirmations > 0) {
      console.log(`   📊 Last 24h: ${totalActions} actions (${totalActions - blockedActions} allowed, ${blockedActions} blocked)`);
      if (pendingSuggestions > 0) console.log(`   💡 ${pendingSuggestions} pending suggestions`);
      if (pendingConfirmations > 0) console.log(`   ⏳ ${pendingConfirmations} pending confirmations`);
    }

    storage.close();
  } catch { /* DB not available, skip stats */ }
}
