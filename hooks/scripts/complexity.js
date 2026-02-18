/**
 * UserPromptSubmit Hook - 복잡도 분석
 */
import { getToolsBaseUrl, PROJECT_DIR } from './utils.js';

const BASE_URL = getToolsBaseUrl();

async function main() {
  try {
    const module = await import(`${BASE_URL}convention/index.js`);
    const result = await module.analyzeComplexity({
      targetPath: '.',
      projectPath: PROJECT_DIR,
    });
    const lines = result.content[0].text.split('\n').slice(0, 5).join(' | ');
    console.log('[COMPLEXITY]', lines);
  } catch (e) {
    console.log('[COMPLEXITY] Error:', e.message);
  }
}

main();
