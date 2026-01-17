/**
 * PostToolUse Hook - Write/Edit 후 코드 품질 검사
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
    const lines = result.content[0].text.split('\n').slice(0, 3).join(' | ');
    console.log('[CODE CHECK]', lines);
  } catch {
    console.log('[AUTO-CONTINUE] Code written. Continue.');
  }
}

main();
