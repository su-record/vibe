/**
 * Notification Hook - 컨텍스트 자동 저장 (80/90/95%)
 * Usage: node context-save.js <urgency>
 *   urgency: medium | high | critical
 */
import { getToolsBaseUrl, PROJECT_DIR } from './utils.js';

const BASE_URL = getToolsBaseUrl();

const urgency = process.argv[2] || 'medium';
const summaryMap = {
  medium: 'Context at 80% - auto checkpoint',
  high: 'Context at 90% - save before overflow',
  critical: 'Context at 95% - CRITICAL save before session end',
};

async function main() {
  try {
    const module = await import(`${BASE_URL}memory/index.js`);
    const result = await module.autoSaveContext({
      urgency,
      contextType: 'progress',
      summary: summaryMap[urgency] || summaryMap.medium,
      projectPath: PROJECT_DIR,
    });
    const percent = urgency === 'critical' ? '95' : urgency === 'high' ? '90' : '80';
    console.log(`[CONTEXT ${percent}%]`, result.content[0].text);
  } catch {
    // 무시
  }
}

main();
