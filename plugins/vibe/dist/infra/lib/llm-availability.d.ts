/**
 * LLM 가용성 감지 유틸
 *
 * Claude/Codex/Antigravity CLI 활성화 여부를 런타임에 판단.
 * 결과는 프로세스당 1회 캐시.
 */
export interface LlmAvailability {
    claude: boolean;
    codex: boolean;
    antigravity: boolean;
    /** Z.ai / GLM — API 키 기반(CLI 없음) */
    zai: boolean;
}
/**
 * Claude/Codex/Antigravity CLI 가용성 감지 (캐시)
 */
export declare function detectLlmAvailability(): LlmAvailability;
/** Claude CLI 활성화 여부 */
export declare function isClaudeAvailable(): boolean;
/** Codex CLI 활성화 여부 */
export declare function isCodexAvailable(): boolean;
/** Antigravity CLI 활성화 여부 */
export declare function isAntigravityAvailable(): boolean;
/** ZAI(Z.ai / GLM) 활성화 여부 */
export declare function isZaiAvailable(): boolean;
/** 캐시 초기화 (테스트용) */
export declare function resetLlmAvailabilityCache(): void;
//# sourceMappingURL=llm-availability.d.ts.map