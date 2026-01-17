/**
 * UserPromptSubmit Hook - 메모리 검색
 */
import { getToolsBaseUrl, PROJECT_DIR } from './utils.js';

const BASE_URL = getToolsBaseUrl();

async function main() {
  try {
    const module = await import(`${BASE_URL}memory/index.js`);
    const result = await module.listMemories({
      limit: 10,
      projectPath: PROJECT_DIR,
    });
    const lines = result.content[0].text.split('\n');
    console.log(`[RECALL] ✓ Found ${lines.length} memories:`, lines.slice(0, 7).join(' | '));
  } catch (e) {
    console.log('[RECALL] Error:', e.message);
  }
}

main();
