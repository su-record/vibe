/**
 * UserPromptSubmit Hook - 버그 해결/PR 머지 시 솔루션 저장
 */
const VIBE_PATH = process.env.VIBE_PATH || process.cwd();
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || '.';

const BASE_URL = `file:///${VIBE_PATH}/node_modules/@su-record/vibe/dist/tools/memory/index.js`;

async function main() {
  try {
    const module = await import(BASE_URL);
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
