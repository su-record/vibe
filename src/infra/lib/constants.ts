/**
 * VIBE 전역 상수 정의
 */

// 타임아웃 설정 (ms)
export const TIMEOUTS = {
  RESEARCH: 180000,      // 3분
  PYTHON_PARSE: 30000,   // 30초
  DEFAULT: 120000,       // 2분
} as const;

// 캐시 설정
export const CACHE = {
  MAX_SIZE: 5,
  TTL: 5 * 60 * 1000,           // 5분
  MAX_TOTAL_MEMORY_MB: 200,
  INSTRUCTIONS_TTL: 15 * 60 * 1000,  // 15분
} as const;

// Agent 설정
export const AGENT = {
  MAX_TURNS: 10,
  MAX_CONCURRENCY: 4,
  DEFAULT_ALLOWED_TOOLS: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'] as string[],
};

// Concurrency 설정
export const CONCURRENCY = {
  /** 모델별 동시 실행 제한 */
  MODEL_LIMITS: {
    'claude-opus-4-6': 3,
    'claude-sonnet-4-5': 5,
    'claude-haiku-3-5': 8,
    'claude-haiku-4-5-20251001': 8,
    'default': 5,
  } as Record<string, number>,
  /** 프로바이더별 동시 실행 제한 */
  PROVIDER_LIMITS: {
    'claude': 10,
    'gpt': 5,
    'gemini': 5,
    'default': 10,
  } as Record<string, number>,
  /** 기본 동시 실행 제한 */
  DEFAULT: 5,
  /** 큐 최대 크기 */
  QUEUE_MAX_SIZE: 100,
  /** 개별 태스크 타임아웃 (ms) */
  TASK_TIMEOUT: 300000, // 5분
  /** 전체 파이프라인 타임아웃 (ms) */
  PIPELINE_TIMEOUT: 900000, // 15분
  /** 태스크 실패 시 최대 재시도 횟수 */
  MAX_RETRIES: 3,
  /** 재시도 간격 (ms) — 지수 백오프 적용 */
  RETRY_BASE_DELAY: 2000, // 2초
  /** 활동 기반 타임아웃 — 무활동 감지 (ms) */
  ACTIVITY_TIMEOUT: 180_000, // 3분
  /** Stale 감지 주기 (ms) */
  STALE_CHECK_INTERVAL: 30_000, // 30초
  /** 멀티 메시지 배칭 대기 시간 (ms) — Phase 3 */
  BATCH_WAIT_MS: 2_000, // 2초
  /** 세션당 최대 인스트럭션 주입 횟수 — Phase 4 */
  MAX_INJECTION_PER_SESSION: 3,
  /** 대화 이력 조회 기간 (시간) — Phase 5 */
  CONVERSATION_HISTORY_HOURS: 24,
  /** 대화 이력 최대 문자 수 — Phase 5 */
  CONVERSATION_HISTORY_MAX_CHARS: 8_000,
  /** 대화 이력 정리 기준 (시간) — Phase 5 */
  CONVERSATION_CLEANUP_HOURS: 48,
} as const;

// sonolbot-v2 상수
export const MESSAGING = {
  /** Phase 1: ProgressReporter 메시지 편집 최소 간격 (Telegram rate limit 방지) */
  PROGRESS_MIN_INTERVAL_MS: 3_000,
  /** Phase 2: chatId당 대기 큐 최대 크기 */
  MAX_PENDING_MESSAGES: 10,
  /** Phase 2: 대기 메시지 TTL */
  PENDING_MESSAGE_TTL_MS: 300_000,
  /** Phase 2: process당 최대 injection 횟수 */
  MAX_INJECTION_PER_PROCESS: 3,
  /** Phase 2: injection content 최대 문자수 (LLM context overflow 방지) */
  MAX_INJECTION_CHARS: 4_000,
  /** Phase 2: 새 요청 확인 알림 debounce */
  ACK_DEBOUNCE_MS: 5_000,
  /** Phase 3: 무활동 감지 타임아웃 */
  ACTIVITY_TIMEOUT_MS: 600_000,
  /** Phase 3: Stale 감지 주기 */
  STALE_CHECK_INTERVAL_MS: 60_000,
  /** Phase 3: stale 후 자동 재처리 최대 횟수 (poison pill 방지) */
  MAX_STALE_RETRY: 1,
  /** Phase 3: DevSessionManager lock 대기 최대 시간 */
  LOCK_WAIT_TIMEOUT_MS: 30_000,
  /** Phase 4: 외부 채널 기본 포맷 */
  DEFAULT_EXTERNAL_FORMAT: 'text' as const,
} as const;
