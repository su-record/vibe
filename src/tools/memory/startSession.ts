// Memory management tool - SQLite based (v2.0)
// Enhanced with auto-orientation + observations + session summaries

import { MemoryManager } from '../../lib/MemoryManager.js';
import { SessionSummarizer } from '../../lib/memory/SessionSummarizer.js';
import { MemoryStorage } from '../../lib/memory/MemoryStorage.js';
import { ToolResult, ToolDefinition } from '../../types/tool.js';
import { loadProgress, getProgressSummary, incrementSession } from '../../lib/ProgressTracker.js';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export const startSessionDefinition: ToolDefinition = {
  name: 'start_session',
  description: 'core|hello|hi|start - Start session with context',
  inputSchema: {
    type: 'object',
    properties: {
      greeting: { type: 'string', description: 'Greeting message that triggered this action (e.g., "hello", "core")' },
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
  const projectRoot = projectPath || process.cwd();

  try {
    const memoryManager = MemoryManager.getInstance(projectPath);
    let summary = `${greeting ? greeting + '! ' : ''}Session started.\n`;

    // ============================================
    // Auto-Orientation (Anthropic pattern)
    // ============================================

    // 1. Check for active feature progress
    const progressSummary = getProgressSummary(projectRoot);
    if (progressSummary) {
      incrementSession(projectRoot);
      const progress = loadProgress(projectRoot);
      summary += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      summary += `📋 ACTIVE FEATURE\n`;
      summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      summary += `Feature: ${progress?.feature}\n`;
      summary += `Status: ${progress?.status?.toUpperCase()}\n`;
      summary += `Phase: ${progress?.currentPhase}/${progress?.totalPhases}\n`;
      summary += `Sessions: ${progress?.sessionCount}\n`;

      if (progress?.blockers && progress.blockers.length > 0) {
        summary += `⚠️ Blockers: ${progress.blockers.join(', ')}\n`;
      }
      summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    }

    // 2. Get recent git history
    const gitLogSummary = getRecentGitLog(projectRoot);
    if (gitLogSummary) {
      summary += `\n📝 Recent commits:\n${gitLogSummary}`;
    }

    // 3. Check for test status
    const testStatus = getTestStatus(projectRoot);
    if (testStatus) {
      summary += `\n${testStatus}`;
    }

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

    // Inject observations and session summaries context
    try {
      const storage = new MemoryStorage(projectRoot);
      const summarizer = new SessionSummarizer(storage);
      const obsContext = summarizer.generateSessionContext(2000);
      if (obsContext.trim()) {
        summary += `\n${obsContext}`;
      }
    } catch {
      // Observation context injection is non-critical
    }

    // Inject high-value reflections from previous sessions
    try {
      const reflectionStore = memoryManager.getReflectionStore();
      const highValueReflections = reflectionStore.getHighValue(0.7, 5);

      if (highValueReflections.length > 0) {
        summary += '\n## Previous Session Insights\n';
        for (const ref of highValueReflections) {
          if (ref.insights.length > 0) {
            summary += `  Insights: ${ref.insights.slice(0, 3).join('; ')}\n`;
          }
          if (ref.decisions.length > 0) {
            summary += `  Decisions: ${ref.decisions.slice(0, 3).join('; ')}\n`;
          }
          if (ref.patterns.length > 0) {
            summary += `  Patterns: ${ref.patterns.slice(0, 3).join('; ')}\n`;
          }
        }
      }
    } catch {
      // Reflection injection is non-critical
    }

    // Inject Session RAG context (active goals, constraints, recent decisions)
    try {
      const ragContext = memoryManager.retrieveActiveContext();

      if (ragContext.goals.length > 0) {
        summary += '\n## Active Goals\n';
        ragContext.goals.forEach(g => {
          const progress = g.progressPercent > 0 ? ` [${g.progressPercent}%]` : '';
          summary += `  - ${g.title}${progress}\n`;
        });
      }

      if (ragContext.constraints.length > 0) {
        summary += '\n## Key Constraints\n';
        ragContext.constraints.forEach(c => {
          summary += `  - [${c.severity.toUpperCase()}] ${c.title}\n`;
        });
      }

      if (ragContext.decisions.length > 0) {
        summary += '\n## Recent Decisions\n';
        ragContext.decisions.forEach(d => {
          summary += `  - ${d.title}`;
          if (d.rationale) summary += ` (${d.rationale})`;
          summary += '\n';
        });
      }
    } catch {
      // Session RAG context injection is non-critical
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

/**
 * Get recent git log (last 3 commits)
 */
function getRecentGitLog(projectRoot: string): string | null {
  try {
    const result = execSync(
      `git log --oneline -3 2>/dev/null`,
      { cwd: projectRoot, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim();

    if (result) {
      return result.split('\n').map(line => `  • ${line}`).join('\n') + '\n';
    }
  } catch {
    // Not a git repo or git not available
  }
  return null;
}

/**
 * Check test status (last run result if available)
 */
function getTestStatus(projectRoot: string): string | null {
  // Check for common test result indicators
  const testIndicators = [
    { file: 'test-results.json', parser: parseJestResults },
    { file: 'coverage/coverage-summary.json', parser: parseCoverageResults },
    { file: '.nyc_output/processinfo/index.json', parser: () => '✅ Coverage data available' },
  ];

  for (const indicator of testIndicators) {
    const filePath = path.join(projectRoot, indicator.file);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return indicator.parser(content);
      } catch {
        // Ignore parse errors
      }
    }
  }

  return null;
}

function parseJestResults(content: string): string | null {
  try {
    const data = JSON.parse(content);
    const passed = data.numPassedTests || 0;
    const failed = data.numFailedTests || 0;
    const total = data.numTotalTests || passed + failed;

    if (failed > 0) {
      return `🧪 Tests: ❌ ${failed}/${total} failing`;
    }
    return `🧪 Tests: ✅ ${passed}/${total} passing`;
  } catch {
    return null;
  }
}

function parseCoverageResults(content: string): string | null {
  try {
    const data = JSON.parse(content);
    const lines = data.total?.lines?.pct;
    if (lines !== undefined) {
      const icon = lines >= 80 ? '✅' : lines >= 50 ? '⚠️' : '❌';
      return `📊 Coverage: ${icon} ${lines.toFixed(1)}%`;
    }
  } catch {
    // Ignore
  }
  return null;
}
