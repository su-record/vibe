/**
 * Kimi Direct API 상수 (Moonshot)
 * 엔드포인트: api.moonshot.ai/v1
 */

export const KIMI_BASE_URL = 'https://api.moonshot.ai/v1';

/**
 * 모델 ID 매핑 (내부 ID → API 모델 ID)
 */
export const KIMI_MODEL_MAP: Record<string, string> = {
  'kimi-k2.5': 'kimi-k2.5',
};

export interface KimiModelMeta {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  maxTokens: number;
  type: 'chat';
}

export const KIMI_MODELS: Record<string, KimiModelMeta> = {
  'kimi-k2.5': {
    id: 'kimi-k2.5',
    name: 'Kimi K2.5',
    description: 'Kimi K2.5 — 256K context, balanced (1T MoE, Moonshot Direct)',
    contextWindow: 256000,
    maxTokens: 8192,
    type: 'chat',
  },
};

export const KIMI_DEFAULT_MODEL = 'kimi-k2.5';

/**
 * 모델별 특수 파라미터
 */
export interface KimiModelConfig {
  recommendedTemp: number;
}

export function getKimiModelConfig(model: string): KimiModelConfig {
  switch (model) {
    case 'kimi-k2.5':
      return { recommendedTemp: 0.6 };
    default:
      return { recommendedTemp: 0.7 };
  }
}
