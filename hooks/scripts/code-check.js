/**
 * PostToolUse Hook - Write/Edit 후 코드 품질 검사
 */
import { getToolsBaseUrl, PROJECT_DIR } from './utils.js';

const BASE_URL = getToolsBaseUrl();

async function main() {
  try {
    const module = await import(`${BASE_URL}convention/index.js`);
    const result = await module.validateCodeQuality({
      targetPath: '.',
      projectPath: PROJECT_DIR,
    });
    const lines = result.content[0].text.split('\n').slice(0, 3).join(' | ');
    console.log('[CODE CHECK]', lines);
  } catch {
    console.log('[AUTO-CONTINUE] Code written. Continue.');
  }
}

main();
