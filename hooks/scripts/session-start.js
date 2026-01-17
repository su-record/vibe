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
  } catch (e) {
    console.log('[Session] Error:', e.message);
  }
}

main();
