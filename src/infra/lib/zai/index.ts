/**
 * ZAI (Z.ai / GLM) 모듈
 *
 * Auth: API Key 전용 — 두 종류
 *   - codingApiKey : GLM Coding Plan (UI/코드 담당)
 *   - apiKey       : 일반 pay-as-you-go
 */

export type {
  ZaiPlan,
  ZaiModelInfo,
  ZaiChatMessage,
  ZaiChatOptions,
  ZaiChatResponse,
  VibeZaiOptions,
} from './types.js';

export {
  ZAI_MODELS,
  ZAI_TOP_MODEL,
  ZAI_BASE_GENERAL,
  ZAI_BASE_CODING,
  DEFAULT_MODEL,
  chat,
  fetchAvailableModels,
  resolveApiKey,
  baseUrlFor,
  isZaiConfigured,
} from './client.js';

export {
  coreZaiOrchestrate,
  coreZaiUiImplement,
} from './orchestration.js';
