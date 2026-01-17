/**
 * UserPromptSubmit Hook - 복잡도 분석
 */
const VIBE_PATH = process.env.VIBE_PATH || process.cwd();
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || '.';

const BASE_URL = `file:///${VIBE_PATH}/node_modules/@su-record/vibe/dist/tools/convention/index.js`;

async function main() {
  try {
    const module = await import(BASE_URL);
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
