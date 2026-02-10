// Memory management tool - completely independent

import { MemoryManager } from '../../core/lib/MemoryManager.js';
import { ToolResult, ToolDefinition } from '../../core/types/tool.js';

export const listMemoriesDefinition: ToolDefinition = {
  name: 'list_memories',
  description: `저장된 메모리 목록을 조회합니다. 카테고리별 필터링 가능.

키워드: 뭐 있었지, 저장된 거, 목록, what did I save, list memories, show saved

💡 세션 시작 시 전체 컨텍스트가 필요하면 get_session_context를 사용하세요.`,
  inputSchema: {
    type: 'object',
    properties: {
      category: { type: 'string', description: 'Filter by category' },
      limit: { type: 'number', description: 'Maximum number of results' },
      projectPath: { type: 'string', description: 'Project directory path for project-specific memory' }
    },
    required: []
  },
  annotations: {
    title: 'List Memories',
    audience: ['user', 'assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export async function listMemories(args: { category?: string; limit?: number; projectPath?: string }): Promise<ToolResult> {
  const { category: listCategory, limit = 10, projectPath } = args;

  try {
    const mm = MemoryManager.getInstance(projectPath);
    const allMemories = mm.list(listCategory);
    const limitedMemories = allMemories.slice(0, limit);

    const memoryList = limitedMemories.map(m =>
      `• ${m.key} (${m.category}): ${m.value.substring(0, 50)}${m.value.length > 50 ? '...' : ''}`
    ).join('\n');

    return {
      content: [{
        type: 'text',
        text: `✓ Found ${allMemories.length} memories${listCategory ? ` in '${listCategory}'` : ''}:\n${memoryList || 'None'}`
      }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
    };
  }
}
