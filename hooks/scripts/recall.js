/**
 * UserPromptSubmit Hook - 메모리 검색
 */
const VIBE_PATH = process.env.VIBE_PATH || process.cwd();
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || '.';

const BASE_URL = `file:///${VIBE_PATH}/node_modules/@su-record/vibe/dist/tools/memory/index.js`;

async function main() {
  try {
    const module = await import(BASE_URL);
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
