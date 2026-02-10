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
