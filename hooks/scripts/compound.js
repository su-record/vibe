/**
 * UserPromptSubmit Hook - 버그 해결/PR 머지 시 솔루션 저장
 */
import { getToolsBaseUrl, PROJECT_DIR } from './utils.js';

const BASE_URL = getToolsBaseUrl();

async function main() {
  try {
    const module = await import(`${BASE_URL}memory/index.js`);
    const result = await module.saveMemory({
      key: `solution-${Date.now()}`,
      value: `Solution documented at ${new Date().toISOString()}`,
      category: 'solution',
      projectPath: PROJECT_DIR,
    });
    console.log('[COMPOUND]', result.content[0].text);
  } catch (e) {
    console.log('[COMPOUND] ✗ Error:', e.message);
  }
}

main();
