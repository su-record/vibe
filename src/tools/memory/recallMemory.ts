// Memory management tool - SQLite based (v1.3)

import { MemoryManager } from '../../infra/lib/MemoryManager.js';
import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';

export const recallMemoryDefinition: ToolDefinition = {
  name: 'recall_memory',
  description: `특정 메모리를 키로 조회합니다.

키워드: 떠올려, recall, 기억나, remember what, what was, remind

💡 전체 컨텍스트가 필요하면 get_session_context를 먼저 사용하세요.`,
  inputSchema: {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'Memory key to retrieve' },
      category: { type: 'string', description: 'Memory category to search in' },
      projectPath: { type: 'string', description: 'Project directory path for project-specific memory' }
    },
    required: ['key']
  },
  annotations: {
    title: 'Recall Memory',
    audience: ['user', 'assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export async function recallMemory(args: { key: string; category?: string; projectPath?: string }): Promise<ToolResult> {
  const { key: recallKey, projectPath } = args;

  try {
    const memoryManager = MemoryManager.getInstance(projectPath);
    const memory = memoryManager.recall(recallKey);

    if (memory) {
      return {
        content: [{ type: 'text', text: `${memory.key}: ${memory.value}\n[${memory.category}]` }]
      };
    } else {
      return {
        content: [{ type: 'text', text: `✗ Not found: "${recallKey}"` }]
      };
    }
  } catch (error) {
    return {
      content: [{ type: 'text', text: `✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
    };
  }
}
