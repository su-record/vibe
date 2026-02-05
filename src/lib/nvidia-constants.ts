/**
 * NVIDIA NIM API 상수
 * 무료 GPU 가속 엔드포인트: integrate.api.nvidia.com
 *
 * 모델 구성:
 * - Kimi K2 계열 (Moonshot): 범용, 추론, 코딩
 * - DeepSeek V3.2: 범용 LLM (685B)
 * - Qwen3-Coder: 코드 생성 (480B MoE)
 * - Devstral 2: 코드 리뷰 (123B, 256K context)
 * - NV-EmbedQA: 임베딩 (26개 언어)
 */

export const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

/**
 * NVIDIA NIM 모델 ID 매핑 (내부 ID → API 모델 ID)
 */
export const NVIDIA_MODEL_MAP: Record<string, string> = {
  // Kimi K2 계열 (Moonshot)
  'kimi-k2.5': 'moonshotai/kimi-k2.5',
  'kimi-k2-thinking': 'moonshotai/kimi-k2-thinking',
  'kimi-k2-instruct': 'moonshotai/kimi-k2-instruct',
  // DeepSeek
  'deepseek-v3.2': 'deepseek-ai/deepseek-v3.2',
  // Qwen
  'qwen3-coder': 'qwen/qwen3-coder-480b-a35b-instruct',
  // Mistral
  'devstral-2': 'mistralai/devstral-2-123b-instruct-2512',
  // Embedding
  'nv-embed': 'nvidia/llama-3.2-nv-embedqa-1b-v2',
};

export interface NvidiaModelMeta {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  maxTokens: number;
  type: 'chat' | 'embedding';
}

export const NVIDIA_MODELS: Record<string, NvidiaModelMeta> = {
  'kimi-k2.5': {
    id: 'kimi-k2.5',
    name: 'Kimi K2.5',
    description: 'Kimi K2.5 — 256K context, balanced',
    contextWindow: 256000,
    maxTokens: 8192,
    type: 'chat',
  },
  'kimi-k2-thinking': {
    id: 'kimi-k2-thinking',
    name: 'Kimi K2 Thinking',
    description: 'Kimi K2 Thinking — deep reasoning (1T MoE)',
    contextWindow: 256000,
    maxTokens: 8192,
    type: 'chat',
  },
  'kimi-k2-instruct': {
    id: 'kimi-k2-instruct',
    name: 'Kimi K2 Instruct',
    description: 'Kimi K2 Instruct — agent/coding (32B active, 1T MoE)',
    contextWindow: 128000,
    maxTokens: 8192,
    type: 'chat',
  },
  'deepseek-v3.2': {
    id: 'deepseek-v3.2',
    name: 'DeepSeek V3.2',
    description: 'DeepSeek V3.2 — 685B, reasoning + coding',
    contextWindow: 128000,
    maxTokens: 4096,
    type: 'chat',
  },
  'qwen3-coder': {
    id: 'qwen3-coder',
    name: 'Qwen3 Coder 480B',
    description: 'Qwen3 Coder — 480B MoE, 262K context, agentic coding',
    contextWindow: 262144,
    maxTokens: 4096,
    type: 'chat',
  },
  'devstral-2': {
    id: 'devstral-2',
    name: 'Devstral 2 123B',
    description: 'Devstral 2 — 123B, 256K context, SWE-Bench 72.2%',
    contextWindow: 256000,
    maxTokens: 8192,
    type: 'chat',
  },
  'nv-embed': {
    id: 'nv-embed',
    name: 'NV-EmbedQA 1B',
    description: 'NV-EmbedQA — embedding, 26 languages, 8K tokens',
    contextWindow: 8192,
    maxTokens: 0,
    type: 'embedding',
  },
};

export const NVIDIA_DEFAULT_MODEL = 'kimi-k2.5';

/**
 * Thinking 모델 여부 판별
 */
export function isThinkingModel(model: string): boolean {
  return model === 'kimi-k2-thinking';
}

/**
 * 모델별 특수 파라미터
 */
export interface ModelConfig {
  recommendedTemp: number;
  thinking?: boolean;
  extraParams?: Record<string, unknown>;
}

export function getModelConfig(model: string): ModelConfig {
  switch (model) {
    case 'kimi-k2-thinking':
      return { recommendedTemp: 1.0, thinking: true };
    case 'kimi-k2.5':
      return { recommendedTemp: 0.6, thinking: false, extraParams: { chat_template_kwargs: { thinking: false } } };
    case 'kimi-k2-instruct':
      return { recommendedTemp: 0.7 };
    case 'deepseek-v3.2':
      return { recommendedTemp: 1.0 };
    case 'devstral-2':
      return { recommendedTemp: 0.15 };
    case 'qwen3-coder':
      return { recommendedTemp: 0.3 };
    default:
      return { recommendedTemp: 0.7 };
  }
}

/**
 * 태스크 유형별 추천 모델
 */
export type NvidiaTaskType = 'reasoning' | 'architecture' | 'code-review' | 'code-analysis' | 'code-gen' | 'debugging' | 'general';

export const NVIDIA_TASK_MODEL: Record<NvidiaTaskType, string> = {
  'reasoning': 'kimi-k2-thinking',
  'architecture': 'kimi-k2-thinking',
  'code-review': 'devstral-2',
  'code-analysis': 'kimi-k2-instruct',
  'code-gen': 'qwen3-coder',
  'debugging': 'deepseek-v3.2',
  'general': 'kimi-k2.5',
};

// ==============================
// 하위 호환 re-export (kimi → nvidia)
// ==============================
/** @deprecated Use NVIDIA_MODELS */
export const KIMI_MODELS = NVIDIA_MODELS;
/** @deprecated Use NVIDIA_DEFAULT_MODEL */
export const KIMI_DEFAULT_MODEL = NVIDIA_DEFAULT_MODEL;
/** @deprecated Use NVIDIA_TASK_MODEL */
export const KIMI_TASK_MODEL = NVIDIA_TASK_MODEL;
/** @deprecated Use NvidiaTaskType */
export type KimiTaskType = NvidiaTaskType;
