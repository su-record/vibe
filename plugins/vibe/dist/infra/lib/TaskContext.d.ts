/**
 * TaskContext - Scoped context boundaries per task/agent
 * Prevents memory pollution during concurrent multi-agent execution
 * Pure static registry (no instantiation)
 */
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
export declare class TaskContext {
    private static registry;
    private constructor();
    static create(opts: TaskContextCreateOptions): TaskContextData;
    static fork(parentContext: TaskContextData, forkOpts: TaskContextForkOptions): TaskContextData;
    static getScoped(taskId: string): TaskContextData | null;
    static cleanup(taskId: string): boolean;
    static buildScopeFilter(context?: TaskContextData): ScopeFilter;
    static getChildren(parentTaskId: string): TaskContextData[];
    static clear(): void;
}
//# sourceMappingURL=TaskContext.d.ts.map