/**
 * TaskContext - Scoped context boundaries per task/agent
 * Prevents memory pollution during concurrent multi-agent execution
 * Pure static registry (no instantiation)
 */

// ============================================================================
// Types
// ============================================================================

export type ContextScope = 'task' | 'session' | 'project';

export interface TaskContextData {
  readonly taskId: string;
  readonly sessionId: string;
  readonly projectPath: string;
  readonly scope: ContextScope;
  readonly parentTaskId: string | null;
  readonly agentName: string | null;
  readonly createdAt: string;
}

export interface TaskContextCreateOptions {
  taskId: string;
  sessionId: string;
  projectPath: string;
  scope?: ContextScope;
  agentName?: string;
}

export interface TaskContextForkOptions {
  taskId: string;
  agentName?: string;
  scope?: ContextScope;
}

export interface ScopeFilter {
  clause: string;
  params: unknown[];
}

// ============================================================================
// TaskContext (static registry)
// ============================================================================

export class TaskContext {
  private static registry: Map<string, TaskContextData> = new Map();

  private constructor() {
    // Pure static class — no instantiation
  }

  static create(opts: TaskContextCreateOptions): TaskContextData {
    const data: TaskContextData = {
      taskId: opts.taskId,
      sessionId: opts.sessionId,
      projectPath: opts.projectPath,
      scope: opts.scope ?? 'task',
      parentTaskId: null,
      agentName: opts.agentName ?? null,
      createdAt: new Date().toISOString(),
    };
    TaskContext.registry.set(opts.taskId, data);
    return data;
  }

  static fork(
    parentContext: TaskContextData,
    forkOpts: TaskContextForkOptions,
  ): TaskContextData {
    const data: TaskContextData = {
      taskId: forkOpts.taskId,
      sessionId: parentContext.sessionId,
      projectPath: parentContext.projectPath,
      scope: forkOpts.scope ?? parentContext.scope,
      parentTaskId: parentContext.taskId,
      agentName: forkOpts.agentName ?? null,
      createdAt: new Date().toISOString(),
    };
    TaskContext.registry.set(forkOpts.taskId, data);
    return data;
  }

  static getScoped(taskId: string): TaskContextData | null {
    return TaskContext.registry.get(taskId) ?? null;
  }

  static cleanup(taskId: string): boolean {
    const children = TaskContext.getChildren(taskId);
    for (const child of children) {
      TaskContext.cleanup(child.taskId);
    }
    return TaskContext.registry.delete(taskId);
  }

  static buildScopeFilter(context?: TaskContextData): ScopeFilter {
    if (!context) {
      return { clause: '', params: [] };
    }

    switch (context.scope) {
      case 'task':
        return {
          clause: ' AND taskId = ?',
          params: [context.taskId],
        };
      case 'session':
        return {
          clause: ' AND sessionId = ?',
          params: [context.sessionId],
        };
      case 'project':
        return { clause: '', params: [] };
      default:
        return { clause: '', params: [] };
    }
  }

  static getChildren(parentTaskId: string): TaskContextData[] {
    const children: TaskContextData[] = [];
    for (const data of TaskContext.registry.values()) {
      if (data.parentTaskId === parentTaskId) {
        children.push(data);
      }
    }
    return children;
  }

  static clear(): void {
    TaskContext.registry.clear();
  }
}
