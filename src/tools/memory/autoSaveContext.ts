// Memory management tool - SQLite based
// (구 ContextCompressor 압축은 제거 — 네이티브 컨텍스트 컴팩션이 담당하며,
//  저장 시에는 요약 우선 + 원문 상한 절단만 적용한다)

import { MemoryManager } from '../../infra/lib/MemoryManager.js';
import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';

/** fullContext 저장 상한 (문자) — DB 행 비대 방지용 단순 절단 */
const FULL_CONTEXT_MAX_CHARS = 24_000;

export const autoSaveContextDefinition: ToolDefinition = {
  name: 'auto_save_context',
  description: 'commit|save|checkpoint|backup - Auto-save context',
  inputSchema: {
    type: 'object',
    properties: {
      urgency: { type: 'string', description: 'Urgency level', enum: ['low', 'medium', 'high', 'critical'] },
      contextType: { type: 'string', description: 'Type of context to save', enum: ['progress', 'decisions', 'code-snippets', 'debugging', 'planning'] },
      sessionId: { type: 'string', description: 'Current session identifier' },
      summary: { type: 'string', description: 'Brief summary of current context' },
      fullContext: { type: 'string', description: 'Full context to save (truncated beyond cap)' },
      projectPath: { type: 'string', description: 'Project directory path for project-specific memory' }
    },
    required: ['urgency', 'contextType']
  },
  annotations: {
    title: 'Auto-Save Context',
    audience: ['user', 'assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export async function autoSaveContext(args: {
  urgency: string;
  contextType: string;
  sessionId?: string;
  summary?: string;
  fullContext?: string;
  projectPath?: string;
}): Promise<ToolResult> {
  const { urgency, contextType, sessionId, summary, fullContext, projectPath } = args;

  try {
    const memoryManager = MemoryManager.getInstance(projectPath);

    let contextToSave = summary || '';

    if (fullContext) {
      contextToSave = fullContext.length > FULL_CONTEXT_MAX_CHARS
        ? `${fullContext.slice(0, FULL_CONTEXT_MAX_CHARS)}\n…[truncated]`
        : fullContext;
    }

    const contextData = {
      timestamp: new Date().toISOString(),
      urgency,
      contextType,
      sessionId,
      summary,
      context: contextToSave,
      compressed: false,
    };

    const priority = urgency === 'high' || urgency === 'critical' ? 2 : urgency === 'medium' ? 1 : 0;
    const contextKey = sessionId ? `context:session_${sessionId}_${Date.now()}` : `context:${Date.now()}`;

    memoryManager.save(contextKey, JSON.stringify(contextData), 'context', priority);

    let resultText = `✓ Context saved: ${contextType} (${urgency})`;
    if (sessionId) resultText += `\nSession: ${sessionId}`;
    if (summary) resultText += `\n${summary}`;

    return {
      content: [{
        type: 'text',
        text: resultText
      }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
    };
  }
}
