/**
 * VIBE 전역 상수 정의
 */

// 모델 상수
export const CLAUDE_MODELS = {
  SONNET: 'claude-sonnet-4-5',
  OPUS: 'claude-opus-4',
  HAIKU: 'claude-haiku-3-5',
  HAIKU_LATEST: 'claude-haiku-4-5-20251001',
} as const;

// 기본 모델 설정
export const DEFAULT_MODELS = {
  RESEARCH: CLAUDE_MODELS.HAIKU_LATEST,  // 리서치는 빠른 모델
  REVIEW: CLAUDE_MODELS.HAIKU,           // 리뷰는 빠른 모델
  BACKGROUND: CLAUDE_MODELS.SONNET,      // 백그라운드는 중간 모델
} as const;

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
