/**
 * TaskContext - Scoped context boundaries per task/agent
 * Prevents memory pollution during concurrent multi-agent execution
 * Pure static registry (no instantiation)
 */
// ============================================================================
// TaskContext (static registry)
// ============================================================================
export class TaskContext {
    static registry = new Map();
    constructor() {
        // Pure static class — no instantiation
    }
    static create(opts) {
        const data = {
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
    static fork(parentContext, forkOpts) {
        const data = {
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
    static getScoped(taskId) {
        return TaskContext.registry.get(taskId) ?? null;
    }
    static cleanup(taskId) {
        const children = TaskContext.getChildren(taskId);
        for (const child of children) {
            TaskContext.cleanup(child.taskId);
        }
        return TaskContext.registry.delete(taskId);
    }
    static buildScopeFilter(context) {
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
    static getChildren(parentTaskId) {
        const children = [];
        for (const data of TaskContext.registry.values()) {
            if (data.parentTaskId === parentTaskId) {
                children.push(data);
            }
        }
        return children;
    }
    static clear() {
        TaskContext.registry.clear();
    }
}
//# sourceMappingURL=TaskContext.js.map