/**
 * VIBE 전역 상수 정의
 */
export declare const TIMEOUTS: {
    readonly RESEARCH: 180000;
    readonly PYTHON_PARSE: 30000;
    readonly DEFAULT: 120000;
};
export declare const CACHE: {
    readonly MAX_SIZE: 5;
    readonly TTL: number;
    readonly MAX_TOTAL_MEMORY_MB: 200;
    readonly INSTRUCTIONS_TTL: number;
};
export declare const AGENT: {
    MAX_TURNS: number;
    MAX_CONCURRENCY: number;
    DEFAULT_ALLOWED_TOOLS: string[];
};
export declare const CONCURRENCY: {
    /** 모델별 동시 실행 제한 — 키는 orchestrator/types.ts ClaudeModel 과 동일해야 한다 */
    readonly MODEL_LIMITS: Record<string, number>;
    /** 프로바이더별 동시 실행 제한 */
    readonly PROVIDER_LIMITS: Record<string, number>;
    /** 기본 동시 실행 제한 */
    readonly DEFAULT: 5;
    /** 큐 최대 크기 */
    readonly QUEUE_MAX_SIZE: 100;
    /** 개별 태스크 타임아웃 (ms) */
    readonly TASK_TIMEOUT: 300000;
    /** 전체 파이프라인 타임아웃 (ms) */
    readonly PIPELINE_TIMEOUT: 900000;
    /** 태스크 실패 시 최대 재시도 횟수 */
    readonly MAX_RETRIES: 3;
    /** 재시도 간격 (ms) — 지수 백오프 적용 */
    readonly RETRY_BASE_DELAY: 2000;
    /** 활동 기반 타임아웃 — 무활동 감지 (ms) */
    readonly ACTIVITY_TIMEOUT: 180000;
    /** Stale 감지 주기 (ms) */
    readonly STALE_CHECK_INTERVAL: 30000;
    /** 멀티 메시지 배칭 대기 시간 (ms) — Phase 3 */
    readonly BATCH_WAIT_MS: 2000;
    /** 세션당 최대 인스트럭션 주입 횟수 — Phase 4 */
    readonly MAX_INJECTION_PER_SESSION: 3;
    /** 대화 이력 조회 기간 (시간) — Phase 5 */
    readonly CONVERSATION_HISTORY_HOURS: 24;
    /** 대화 이력 최대 문자 수 — Phase 5 */
    readonly CONVERSATION_HISTORY_MAX_CHARS: 8000;
    /** 대화 이력 정리 기준 (시간) — Phase 5 */
    readonly CONVERSATION_CLEANUP_HOURS: 48;
};
export declare const TOKENS: {
    readonly PER_CHAR_ESTIMATE: 0.25;
    readonly DEFAULT_BUDGET: 128000;
    readonly DEFAULT_TARGET: 4000;
};
export declare const MESSAGING: {
    /** Phase 1: ProgressReporter 메시지 편집 최소 간격 (Telegram rate limit 방지) */
    readonly PROGRESS_MIN_INTERVAL_MS: 3000;
    /** Phase 2: chatId당 대기 큐 최대 크기 */
    readonly MAX_PENDING_MESSAGES: 10;
    /** Phase 2: 대기 메시지 TTL */
    readonly PENDING_MESSAGE_TTL_MS: 300000;
    /** Phase 2: process당 최대 injection 횟수 */
    readonly MAX_INJECTION_PER_PROCESS: 3;
    /** Phase 2: injection content 최대 문자수 (LLM context overflow 방지) */
    readonly MAX_INJECTION_CHARS: 4000;
    /** Phase 2: 새 요청 확인 알림 debounce */
    readonly ACK_DEBOUNCE_MS: 5000;
    /** Phase 3: 무활동 감지 타임아웃 */
    readonly ACTIVITY_TIMEOUT_MS: 600000;
    /** Phase 3: Stale 감지 주기 */
    readonly STALE_CHECK_INTERVAL_MS: 60000;
    /** Phase 3: stale 후 자동 재처리 최대 횟수 (poison pill 방지) */
    readonly MAX_STALE_RETRY: 1;
    /** Phase 3: DevSessionManager lock 대기 최대 시간 */
    readonly LOCK_WAIT_TIMEOUT_MS: 30000;
    /** Phase 4: 외부 채널 기본 포맷 */
    readonly DEFAULT_EXTERNAL_FORMAT: "text";
};
//# sourceMappingURL=constants.d.ts.map