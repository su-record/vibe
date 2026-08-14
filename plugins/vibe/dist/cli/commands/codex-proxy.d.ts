/**
 * vibe codex 서브커맨드 핸들러
 * Claude Code + OpenAI/Antigravity 호환 모델을 LLM으로 사용
 */
export declare function codexLaunch(model: string | undefined, claudeArgs: string[]): void;
export declare function codexShell(modelArg: string | undefined): void;
export declare function codexStatus(): void;
export declare function codexSetup(): Promise<void>;
export declare function codexHelp(): void;
//# sourceMappingURL=codex-proxy.d.ts.map