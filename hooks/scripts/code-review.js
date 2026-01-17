/**
 * UserPromptSubmit Hook - 코드 리뷰 요청 시 품질 검사
 */
const VIBE_PATH = process.env.VIBE_PATH || process.cwd();
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || '.';

const BASE_URL = `file:///${VIBE_PATH}/node_modules/@su-record/vibe/dist/tools/convention/index.js`;

async function main() {
  try {
    const module = await import(BASE_URL);
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
