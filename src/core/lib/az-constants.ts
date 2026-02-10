/**
 * Azure Foundry API 상수
 * 엔드포인트: fallingo-ai-foundry.services.ai.azure.com
 *
 * 모델 구성:
 * - Kimi K2.5 (Moonshot): 범용 (1T MoE, 256K context)
 * - text-embedding-3-large: 임베딩 (Azure OpenAI)
 */

export const AZ_BASE_URL = 'https://fallingo-ai-foundry.services.ai.azure.com/openai/v1';

/**
 * Azure OpenAI 임베딩 엔드포인트 (별도 호스트)
 */
export const AZ_EMBEDDING_BASE_URL = 'https://fallingo-ai-foundry.cognitiveservices.azure.com';
export const AZ_EMBEDDING_API_VERSION = '2024-02-01';
export const AZ_EMBEDDING_MODEL = 'text-embedding-3-large';

/**
 * 모델 ID 매핑 (내부 ID → API 모델/배포 ID)
 */
export const AZ_MODEL_MAP: Record<string, string> = {
  'kimi-k2.5': 'Kimi-K2.5',
};

export interface AzModelMeta {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  maxTokens: number;
  type: 'chat' | 'embedding';
}

export const AZ_MODELS: Record<string, AzModelMeta> = {
  'kimi-k2.5': {
    id: 'kimi-k2.5',
    name: 'Kimi K2.5',
    description: 'Kimi K2.5 — 256K context, balanced (1T MoE, Azure Foundry)',
    contextWindow: 256000,
    maxTokens: 8192,
    type: 'chat',
  },
  'text-embedding-3-large': {
    id: 'text-embedding-3-large',
    name: 'Text Embedding 3 Large',
    description: 'Azure OpenAI text-embedding-3-large',
    contextWindow: 8191,
    maxTokens: 0,
    type: 'embedding',
  },
};

export const AZ_DEFAULT_MODEL = 'kimi-k2.5';

/**
 * 모델별 특수 파라미터
 */
export interface ModelConfig {
  recommendedTemp: number;
  extraParams?: Record<string, unknown>;
}

export function getModelConfig(model: string): ModelConfig {
  switch (model) {
    case 'kimi-k2.5':
      return { recommendedTemp: 0.6 };
    default:
      return { recommendedTemp: 0.7 };
  }
}

/**
 * 태스크 유형별 추천 모델
 * 현재 Azure Foundry에 Kimi K2.5만 배포 → 모든 태스크 Kimi K2.5
 */
export type AzTaskType = 'reasoning' | 'architecture' | 'code-review' | 'code-analysis' | 'code-gen' | 'debugging' | 'general';

export const AZ_TASK_MODEL: Record<AzTaskType, string> = {
  'reasoning': 'kimi-k2.5',      // 추론 → Kimi K2.5
  'architecture': 'kimi-k2.5',   // 아키텍처 → Kimi K2.5
  'code-review': 'kimi-k2.5',    // 코드 리뷰 → Kimi K2.5
  'code-analysis': 'kimi-k2.5',  // 코드 분석 → Kimi K2.5
  'code-gen': 'kimi-k2.5',       // 코드 생성 → Kimi K2.5
  'debugging': 'kimi-k2.5',      // 디버깅 → Kimi K2.5
  'general': 'kimi-k2.5',        // 범용 → Kimi K2.5
};

