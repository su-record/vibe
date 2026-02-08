/**
 * Tool Index - 전체 Tool 등록
 * Phase 3: Function Calling Tool Definitions
 */

import type { ToolRegistry } from '../ToolRegistry.js';
import { claudeCodeTool } from './claude-code.js';
import { geminiSttTool } from './gemini-stt.js';
import { googleSearchTool } from './google-search.js';
import { kimiAnalyzeTool } from './kimi-analyze.js';
import { webBrowseTool } from './web-browse.js';
import { sendTelegramTool } from './send-telegram.js';
import { saveMemoryTool, recallMemoryTool } from './manage-memory.js';

const ALL_TOOLS = [
  claudeCodeTool,
  geminiSttTool,
  googleSearchTool,
  kimiAnalyzeTool,
  webBrowseTool,
  sendTelegramTool,
  saveMemoryTool,
  recallMemoryTool,
];

export function registerAllTools(registry: ToolRegistry): void {
  for (const tool of ALL_TOOLS) {
    registry.register(tool);
  }
}

export {
  claudeCodeTool,
  geminiSttTool,
  googleSearchTool,
  kimiAnalyzeTool,
  webBrowseTool,
  sendTelegramTool,
  saveMemoryTool,
  recallMemoryTool,
};
