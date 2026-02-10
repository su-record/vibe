/**
 * Tool Index - 전체 Tool 목록
 * Phase 3: Function Calling Tool Definitions
 *
 * ToolRegistry 제거 후 직접 ToolDefinition[] 반환
 */

import type { ToolDefinition } from '../types.js';
import { claudeCodeTool } from './claude-code.js';
import { geminiSttTool } from './gemini-stt.js';
import { googleSearchTool } from './google-search.js';
import { kimiAnalyzeTool } from './kimi-analyze.js';
import { webBrowseTool } from './web-browse.js';
import { sendTelegramTool } from './send-telegram.js';
import { saveMemoryTool, recallMemoryTool } from './manage-memory.js';
import { visionCaptureTool } from './vision-capture.js';
import { visionAnalyzeTool } from './vision-analyze.js';
import { sendSlackTool } from './send-slack.js';
import { dmPairTool } from './dm-pair.js';

const ALL_TOOLS: ToolDefinition[] = [
  claudeCodeTool,
  geminiSttTool,
  googleSearchTool,
  kimiAnalyzeTool,
  webBrowseTool,
  sendTelegramTool,
  saveMemoryTool,
  recallMemoryTool,
  visionCaptureTool,
  visionAnalyzeTool,
  sendSlackTool,
  dmPairTool,
];

/** Get all tool definitions (replaces registerAllTools) */
export function getAllTools(): ToolDefinition[] {
  return ALL_TOOLS;
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
  visionCaptureTool,
  visionAnalyzeTool,
  sendSlackTool,
  dmPairTool,
};
