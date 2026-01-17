/**
 * UserPromptSubmit Hook - 코드 리뷰 요청 시 품질 검사
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
    const lines = result.content[0].text.split('\n').slice(0, 5).join(' | ');
    console.log('[CODE REVIEW]', lines);
  } catch (e) {
    console.log('[CODE REVIEW] Error:', e.message);
  }
}

main();
