/**
 * SessionStart Hook - 세션 시작 시 메모리/시간 로드
 */
import { getToolsBaseUrl, PROJECT_DIR } from './utils.js';

const BASE_URL = getToolsBaseUrl();

async function main() {
  try {
    const [memoryModule, timeModule] = await Promise.all([
      import(`${BASE_URL}memory/index.js`),
      import(`${BASE_URL}time/index.js`),
    ]);

    const [session, time, memories] = await Promise.all([
      memoryModule.startSession({ projectPath: PROJECT_DIR }),
      timeModule.getCurrentTime({ format: 'human', timezone: 'Asia/Seoul' }),
      memoryModule.listMemories({ limit: 5, projectPath: PROJECT_DIR }),
    ]);

    console.log(session.content[0].text);
    console.log('\n' + time.content[0].text);
    console.log('\n[Recent Memories]');
    console.log(memories.content[0].text);

    // Autonomy status summary
    try {
      const fs = await import('fs');
      const configPath = `${PROJECT_DIR}/.claude/vibe/config.json`;
      let autonomyMode = 'suggest';
      let sentinelEnabled = true;

      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        autonomyMode = config.autonomy?.mode || 'suggest';
        sentinelEnabled = config.sentinel?.enabled !== false;
      }

      const LIB_BASE_A = (await import('./utils.js')).getLibBaseUrl();
      const memModA = await import(`${LIB_BASE_A}memory/MemoryStorage.js`);
      const storageA = new memModA.MemoryStorage(PROJECT_DIR);
      const db = storageA.getDatabase();

      const last24h = new Date(Date.now() - 86_400_000).toISOString();
      let totalActions = 0;
      let allowedActions = 0;
      let blockedActions = 0;
      let pendingSuggestions = 0;
      let pendingConfirmations = 0;

      try {
        totalActions = db.prepare('SELECT COUNT(*) as c FROM audit_events WHERE createdAt >= ?').get(last24h)?.c ?? 0;
        allowedActions = db.prepare("SELECT COUNT(*) as c FROM audit_events WHERE createdAt >= ? AND outcome = 'allowed'").get(last24h)?.c ?? 0;
        blockedActions = db.prepare("SELECT COUNT(*) as c FROM audit_events WHERE createdAt >= ? AND outcome = 'blocked'").get(last24h)?.c ?? 0;
      } catch { /* table not initialized yet */ }

      try {
        pendingSuggestions = db.prepare("SELECT COUNT(*) as c FROM suggestions WHERE status = 'pending'").get()?.c ?? 0;
      } catch { /* table not initialized yet */ }

      try {
        pendingConfirmations = db.prepare("SELECT COUNT(*) as c FROM confirmations WHERE status = 'pending'").get()?.c ?? 0;
      } catch { /* table not initialized yet */ }

      const parts = [`${autonomyMode} mode`];
      if (sentinelEnabled) parts.push('sentinel ON');
      if (pendingConfirmations > 0) parts.push(`${pendingConfirmations} pending confirmations`);
      if (pendingSuggestions > 0) parts.push(`${pendingSuggestions} suggestions`);
      if (totalActions > 0) parts.push(`${totalActions} actions (${allowedActions} ok, ${blockedActions} blocked)`);

      console.log(`\n🤖 Autonomy: ${parts.join(' | ')}`);
      storageA.close();
    } catch { /* autonomy not yet initialized, skip */ }

    // Evolution status summary
    try {
      const LIB_BASE = (await import('./utils.js')).getLibBaseUrl();
      const [memMod, regMod, insMod] = await Promise.all([
        import(`${LIB_BASE}memory/MemoryStorage.js`),
        import(`${LIB_BASE}evolution/GenerationRegistry.js`),
        import(`${LIB_BASE}evolution/InsightStore.js`),
      ]);
      const storage = new memMod.MemoryStorage(PROJECT_DIR);
      const registry = new regMod.GenerationRegistry(storage);
      const insightStore = new insMod.InsightStore(storage);

      const genStats = registry.getStats();
      const active = genStats.byStatus?.active || 0;
      const drafts = genStats.byStatus?.draft || 0;
      const gaps = insightStore.getByType('skill_gap').length;

      if (active > 0 || drafts > 0 || gaps > 0) {
        const parts = [];
        if (active > 0) parts.push(`${active} active skills`);
        if (drafts > 0) parts.push(`${drafts} pending approval`);
        if (gaps > 0) parts.push(`${gaps} gaps detected`);
        console.log(`\n🧬 Evolution: ${parts.join(', ')}`);
      }
      storage.close();
    } catch { /* evolution not yet initialized, skip */ }
  } catch (e) {
    console.log('[Session] Error:', e.message);
  }
}

main();
