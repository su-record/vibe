/**
 * AI CLI 감지 유틸리티
 *
 * Claude Code, Codex CLI, Antigravity CLI 설치 여부를 자동 감지하여
 * 설치된 CLI에만 설정을 적용
 */
export interface AiCliStatus {
    installed: boolean;
    configDir: string;
    pluginDir?: string;
    /** 현재 인증 세션이 감지되는지 (파일/Keychain 기반, API 호출 없음). installed=false면 undefined. */
    authenticated?: boolean;
}
/**
 * Claude Code 설치 여부 감지
 * - PATH에서 `claude` 실행 파일 존재 여부
 * - `~/.claude/` 디렉토리 존재 여부
 * 둘 중 하나만 true면 installed: true
 */
export declare function detectClaudeCli(): AiCliStatus;
/**
 * Codex CLI 설치 여부 감지
 * - PATH에서 `codex` 실행 파일 존재 여부
 * - `~/.codex/` 디렉토리 존재 여부
 * 둘 중 하나만 true면 installed: true
 */
export declare function detectCodexCli(): AiCliStatus;
/**
 * Antigravity CLI 설치 여부 감지
 * - PATH에서 `agy` 실행 파일 존재 여부
 * - `~/.gemini/antigravity-cli/` 또는 `~/.antigravity/` 디렉토리 존재 여부
 * 둘 중 하나만 true면 installed: true
 */
export declare function detectAntigravityCli(): AiCliStatus;
//# sourceMappingURL=cli-detector.d.ts.map