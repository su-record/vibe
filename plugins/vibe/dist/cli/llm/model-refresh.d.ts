/**
 * 모델 최신화 — claude / openai(api+oauth) / gemini / zai 의 현재 사용 가능한 모델을
 * provider API 로 라이브 조회하고(실패 시 큐레이션 목록), 추천 모델을
 * ~/.vibe/config.json models(런타임 SSOT)에 반영한다.
 */
import type { ModelOverrides } from '../types.js';
export type ProviderId = 'claude' | 'openai' | 'gemini' | 'zai';
export type FetchSource = 'live' | 'curated' | 'no-key';
export interface ProviderModels {
    provider: ProviderId;
    label: string;
    models: string[];
    recommended: string;
    source: FetchSource;
    /** OpenAI: API 키 없이 oauth(Codex)만 있는 경우 */
    oauthOnly?: boolean;
    /** refresh 시 갱신할 config.json models 키 (없으면 갱신하지 않음) */
    overrideKeys: Array<keyof ModelOverrides>;
}
/** 모든 provider 의 현재 모델 조회 */
export declare function fetchAllProviders(): Promise<ProviderModels[]>;
export interface RefreshChange {
    key: keyof ModelOverrides;
    from: string | undefined;
    to: string;
}
/** 추천 모델을 config.json models(SSOT)에 반영. 변경 목록 반환. */
export declare function applyToConfig(providers: ProviderModels[]): RefreshChange[];
//# sourceMappingURL=model-refresh.d.ts.map