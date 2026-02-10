// Memory management tool - SQLite based (v1.3)

import { MemoryManager } from '../../infra/lib/MemoryManager.js';
import { ToolResult, ToolDefinition } from '../../infra/types/tool.js';

export const saveMemoryDefinition: ToolDefinition = {
  name: 'save_memory',
  description: `중요한 정보를 장기 메모리에 저장합니다. 프로젝트 결정사항, 아키텍처, 설정 등을 기록하세요.

키워드: 기억해, remember, 저장해, save, memorize, keep

💡 저장 후 link_memories로 관련 메모리를 연결하면 지식 그래프가 구축됩니다.`,
  inputSchema: {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'Memory key/identifier' },
      value: { type: 'string', description: 'Information to save' },
      category: { type: 'string', description: 'Memory category', enum: ['project', 'personal', 'code', 'notes'] },
      projectPath: { type: 'string', description: 'Project directory path for project-specific memory storage' }
    },
    required: ['key', 'value']
  },
  annotations: {
    title: 'Save Memory',
    audience: ['user', 'assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

export async function saveMemory(args: { key: string; value: string; category?: string; projectPath?: string }): Promise<ToolResult> {
  const { key: memoryKey, value: memoryValue, category = 'general', projectPath } = args;

  try {
    const memoryManager = MemoryManager.getInstance(projectPath);
    memoryManager.save(memoryKey, memoryValue, category);

    const location = projectPath ? `${projectPath}/.claude/vibe/memories/` : 'default';
    return {
      content: [{ type: 'text', text: `✓ Saved: ${memoryKey}\nCategory: ${category}\nLocation: ${location}` }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]
    };
  }
}
