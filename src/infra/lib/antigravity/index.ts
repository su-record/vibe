/**
 * Antigravity API 모듈
 *
 * Auth: Antigravity CLI / Codex CLI (hooks) + API Key (library)
 */

export type {
  AuthInfo,
  AntigravityAuthMethod,
  AntigravityModelInfo,
  AvailableModel,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  AntigravityApiResponse,
  AntigravityCandidate,
  ImageGenerationOptions,
  ImageGenerationResult,
  ImageAnalysisOptions,
  MultimodalContent,
  VibeAntigravityOptions,
} from './types.js';

export {
  getApiKeyFromConfig,
  getAuthInfo,
} from './auth.js';

export { getGlobalConfigDir } from '../llm/auth/ConfigManager.js';

export {
  ANTIGRAVITY_MODELS,
  getAntigravityModels,
  DEFAULT_MODEL,
  chat,
  chatStream,
  getAvailableModels,
  getModelInfo,
  ask,
  quickAsk,
} from './chat.js';

export {
  webSearch,
  quickWebSearch,
  analyzeUI,
  generateImage,
  analyzeImage,
} from './capabilities.js';

export {
  coreAntigravityOrchestrate,
  coreAntigravityParseSpec,
  coreAntigravityPlanExecution,
  coreAntigravityAnalyze,
  coreAntigravityDecideNextAction,
  coreAntigravityAnalyzeUX,
} from './orchestration.js';

export { fetchAvailableModels } from './models.js';
