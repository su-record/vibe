/**
 * Gemini API 모듈
 *
 * Auth: gemini-cli / codex-cli (hooks) + API Key (library)
 */

export type {
  AuthInfo,
  GeminiAuthMethod,
  GeminiModelInfo,
  AvailableModel,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  GeminiApiResponse,
  GeminiCandidate,
  ImageGenerationOptions,
  ImageGenerationResult,
  ImageAnalysisOptions,
  MultimodalContent,
  VibeGeminiOptions,
} from './types.js';

export {
  getApiKeyFromConfig,
  getAuthInfo,
} from './auth.js';

export { getGlobalConfigDir } from '../llm/auth/ConfigManager.js';

export {
  GEMINI_MODELS,
  getGeminiModels,
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
  coreGeminiOrchestrate,
  coreGeminiParseSpec,
  coreGeminiPlanExecution,
  coreGeminiAnalyze,
  coreGeminiDecideNextAction,
  coreGeminiAnalyzeUX,
} from './orchestration.js';

export { fetchAvailableModels } from './models.js';
