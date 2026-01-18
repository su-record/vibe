// Memory management tool - SQLite based (v1.5)

import { MemoryManager } from '../../lib/MemoryManager.js';
import { ToolResult, ToolDefinition } from '../../types/tool.js';

export const startSessionDefinition: ToolDefinition = {
  name: 'start_session',
  description: 'vibe|hello|hi|start - Start session with context',
  inputSchema: {
    type: 'object',
    properties: {
      greeting: { type: 'string', description: 'Greeting message that triggered this action (e.g., "hello", "vibe")' },
      loadMemory: { type: 'boolean', description: 'Load relevant project memories (default: true)' },
      restoreContext: { type: 'boolean', description: 'Restore previous session context (default: true)' },
      projectPath: { type: 'string', description: 'Project directory path for project-specific memory' }
    },
    required: []
  },
  annotations: {
    title: 'Start Session',
    audience: ['user', 'assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false
  }
};

export async function startSession(args: { greeting?: string; loadMemory?: boolean; restoreContext?: boolean; projectPath?: string }): Promise<ToolResult> {
  const { greeting = '', loadMemory = true, restoreContext = true, projectPath } = args;

  try {
    const memoryManager = MemoryManager.getInstance(projectPath);
    let summary = `${greeting ? greeting + '! ' : ''}Session started.\n`;

    // Load relevant project memories
    if (loadMemory) {
      const projectMemories = memoryManager.list('project');
      const codeMemories = memoryManager.list('code');
      const memories = [...projectMemories, ...codeMemories].slice(0, 5);

      if (memories.length > 0) {
        summary += `\nRecent Project Info:\n`;
        memories.forEach(mem => {
          const preview = mem.value.substring(0, 80);
          summary += `  • ${mem.key}: ${preview}${mem.value.length > 80 ? '...' : ''}\n`;
        });
      }
    }

    // Restore context
    if (restoreContext) {
      const contextMemories = memoryManager.list('context').slice(0, 3);

      if (contextMemories.length > 0) {
        summary += `\nPrevious Context:\n`;
        contextMemories.forEach(ctx => {
          try {
            const data = JSON.parse(ctx.value);
            summary += `  • ${data.urgency?.toUpperCase() || 'MEDIUM'} priority from ${new Date(ctx.timestamp).toLocaleString()}\n`;
          } catch { /* ignore: optional operation */
            summary += `  • Context from ${new Date(ctx.timestamp).toLocaleString()}\n`;
          }
        });
      }
    }

    summary += '\nReady to continue development! What would you like to work on?';

    return {
      content: [{ type: 'text', text: summary }]
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `${greeting ? greeting + '! ' : ''}Session started.\n\nReady to begin! What can I help you with?` }]
    };
  }
}
