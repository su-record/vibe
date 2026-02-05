/**
 * Gemini API 모듈
 *
 * v0.0.4: gemini-api.ts에서 관심사별 분리
 * - types: 타입 정의
 * - auth: 인증 관리
 * - chat: 채팅 API + 모델 레지스트리
 * - capabilities: 웹 검색, UI 분석, 이미지 생성/분석
 * - orchestration: Core 오케스트레이션 함수
 */

export type {
  AuthInfo,
  GeminiModelInfo,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  GeminiApiResponse,
  ImageGenerationOptions,
  ImageGenerationResult,
  ImageAnalysisOptions,
  AudioMimeType,
  AudioTranscriptionOptions,
  AudioTranscriptionResult,
  MultimodalContent,
  VibeGeminiOptions,
} from './types.js';

export {
  getGlobalConfigDir,
  getApiKeyFromConfig,
  removeEmailFromConfigIfNoToken,
  getAuthInfo,
} from './auth.js';

export {
  GEMINI_MODELS,
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
