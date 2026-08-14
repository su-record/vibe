interface CodexHookCommand {
    type: 'command';
    command: string;
}
interface CodexHookEntry {
    hooks: CodexHookCommand[];
}
export interface CodexHooksConfig {
    hooks: {
        SessionStart: CodexHookEntry[];
        UserPromptSubmit: CodexHookEntry[];
        PreToolUse: CodexHookEntry[];
        PostToolUse: CodexHookEntry[];
        Stop: CodexHookEntry[];
        /** CC 의 context_window_* Notification 등가물 — Codex 에는 임계치 알림이 없다 */
        PreCompact: CodexHookEntry[];
        PostCompact: CodexHookEntry[];
    };
}
export declare function buildCodexHooksConfig(coreDir?: string): CodexHooksConfig;
export declare function installProjectCodexHooks(projectRoot: string, coreDir?: string): void;
export {};
//# sourceMappingURL=CodexHooks.d.ts.map