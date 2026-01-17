// Memory management tool - SQLite based (v1.4)

import { MemoryManager } from '../../lib/MemoryManager.js';
import { ToolResult, ToolDefinition } from '../../types/tool.js';
import * as fs from 'fs';
import * as path from 'path';

export const startSessionDefinition: ToolDefinition = {
  name: 'start_session',
  description: 'vibe|hello|안녕|하이 - Start session with context',
  inputSchema: {
    type: 'object',
    properties: {
      greeting: { type: 'string', description: 'Greeting message that triggered this action (e.g., "안녕", "vibe")' },
      loadMemory: { type: 'boolean', description: 'Load relevant project memories (default: true)' },
      loadGraph: { type: 'boolean', description: 'Load learned patterns from graph (default: true)' },
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

export async function startSession(args: { greeting?: string; loadMemory?: boolean; loadGraph?: boolean; restoreContext?: boolean; projectPath?: string }): Promise<ToolResult> {
  const { greeting = '', loadMemory = true, loadGraph = true, restoreContext = true, projectPath } = args;

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

    // Load learned patterns from graph
    if (loadGraph) {
      const graphDir = path.join(projectPath || process.cwd(), '.claude', 'vibe', 'graph');

      if (fs.existsSync(graphDir)) {
        const graphFiles = fs.readdirSync(graphDir)
          .filter(f => f.endsWith('.md'))
          .sort((a, b) => b.localeCompare(a)) // newest first
          .slice(0, 5);

        if (graphFiles.length > 0) {
          summary += `\n📚 Learned Patterns (${graphFiles.length}):\n`;

          for (const file of graphFiles) {
            try {
              const content = fs.readFileSync(path.join(graphDir, file), 'utf-8');
              const problemMatch = content.match(/problem:\s*(.+)/);
              const categoryMatch = content.match(/category:\s*(.+)/);
              const severityMatch = content.match(/severity:\s*(.+)/);

              if (problemMatch) {
                const problem = problemMatch[1].substring(0, 50);
                const category = categoryMatch?.[1] || 'unknown';
                const severity = severityMatch?.[1] || 'P3';
                summary += `  • [${severity}/${category}] ${problem}${problemMatch[1].length > 50 ? '...' : ''}\n`;
              }
            } catch { /* ignore: file read error */ }
          }

          summary += `  → 비슷한 문제 발생 시 이 패턴들을 참조하세요.\n`;
        }
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