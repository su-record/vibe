/**
 * ZAI (Z.ai / GLM) 클라이언트 — OpenAI 호환 chat completions
 *
 * 두 요금제를 지원한다:
 *   - coding  : GLM Coding Plan (별도 키). Anthropic/Codex 호환 코딩 엔드포인트.
 *   - general : 일반 pay-as-you-go v4 엔드포인트.
 */
import type { ZaiPlan, ZaiModelInfo, ZaiChatOptions, ZaiChatResponse } from './types.js';
export declare const ZAI_BASE_GENERAL = "https://api.z.ai/api/paas/v4";
export declare const ZAI_BASE_CODING = "https://api.z.ai/api/coding/paas/v4";
export declare const ZAI_BASE_CODING_ANTHROPIC = "https://api.z.ai/api/anthropic";
/** 큐레이션된 알려진 모델 (list-models 미지원/무네트워크 시 fallback) */
export declare const ZAI_MODELS: Record<string, ZaiModelInfo>;
/** flagship(최고) 모델 id — UI 개발 등 최고 품질이 필요한 작업에 사용 (coding plan) */
export declare const ZAI_TOP_MODEL = "glm-5.2";
/** coding plan 기본 모델 */
export declare const DEFAULT_CODING_MODEL = "glm-5.2";
/** 일반 API 기본 모델 (일반 요금제는 현재 5.1 이 상한) */
export declare const DEFAULT_GENERAL_MODEL = "glm-5.1";
/** 하위 호환용 기본값 */
export declare const DEFAULT_MODEL = "glm-5.2";
export declare function resolveApiKey(plan: ZaiPlan): string | null;
export declare function baseUrlFor(plan: ZaiPlan): string;
/** 코딩플랜 또는 일반 키가 하나라도 있으면 사용 가능 */
export declare function isZaiConfigured(): boolean;
/** OpenAI 호환 chat completions */
export declare function chat(opts: ZaiChatOptions): Promise<ZaiChatResponse>;
/** live: 사용 가능한 모델 조회 (OpenAI 호환 GET /models). 실패 시 큐레이션 목록. */
export declare function fetchAvailableModels(plan?: ZaiPlan): Promise<ZaiModelInfo[]>;
//# sourceMappingURL=client.d.ts.map