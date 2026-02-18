/**
 * Gemini / Antigravity API 모듈
 *
 * Endpoint: Production 우선 (Pro 계정 429 방지)
 * Auth: Antigravity OAuth → Gemini CLI → API Key
 * API: generateContent + completeCode + fetchAvailableModels + SSE Streaming
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
  CompleteCodeOptions,
  CompleteCodeResponse,
  ImageGenerationOptions,
  ImageGenerationResult,
  ImageAnalysisOptions,
  AudioMimeType,
  AudioTranscriptionOptions,
  AudioTranscriptionResult,
  MultimodalContent,
  VibeGeminiOptions,
  V1InternalRequest,
} from './types.js';

export {
  getApiKeyFromConfig,
  getAuthInfo,
  markAuthSuccess,
  markAuthFailure,
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
  transcribeAudio,
} from './capabilities.js';

export {
  coreGeminiOrchestrate,
  coreGeminiParseSpec,
  coreGeminiPlanExecution,
  coreGeminiAnalyze,
  coreGeminiDecideNextAction,
  coreGeminiAnalyzeUX,
} from './orchestration.js';

export { completeCode } from './completion.js';

export { fetchAvailableModels } from './models.js';
