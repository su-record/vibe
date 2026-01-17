/**
 * Gemini API 호출
 * - OAuth: Gemini 구독으로 3 Flash/Pro 모델 사용
 * - API Key: Google AI Studio API 직접 호출
 */

import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import os from 'os';

import {
  ANTIGRAVITY_HEADERS,
  ANTIGRAVITY_DEFAULT_PROJECT_ID,
} from './gemini-constants.js';

import { getValidAccessToken } from './gemini-oauth.js';
import { sleep, warnLog } from './utils.js';

// 인증 정보 타입
interface AuthInfo {
  type: 'oauth' | 'apikey';
  accessToken?: string;
  apiKey?: string;
  email?: string;
  projectId?: string;
}

// 전역 설정 디렉토리 경로
function getGlobalConfigDir(): string {
  return process.platform === 'win32'
    ? path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'vibe')
    : path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'vibe');
}

// API Key 가져오기 (전역 저장소)
function getApiKeyFromConfig(): string | null {
  try {
    const globalKeyPath = path.join(getGlobalConfigDir(), 'gemini-apikey.json');
    if (fs.existsSync(globalKeyPath)) {
      const data = JSON.parse(fs.readFileSync(globalKeyPath, 'utf-8'));
      if (data.apiKey) {
        return data.apiKey;
      }
    }
  } catch (e) {
    warnLog('Gemini API 키 읽기 실패', e);
  }
  return null;
}

// OAuth 토큰 없을 때 config에서 email 제거
function removeEmailFromConfigIfNoToken(): void {
  try {
    const configPath = path.join(process.cwd(), '.claude', 'vibe', 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.models?.gemini?.email) {
        delete config.models.gemini.email;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      }
    }
  } catch (e) {
    warnLog('Failed to remove email from Gemini config', e);
  }
}

// 인증 방식 확인 (OAuth 우선, API Key 대체)
async function getAuthInfo(): Promise<AuthInfo> {
  // 1. OAuth 토큰 확인 (우선)
  try {
    const { accessToken, email, projectId } = await getValidAccessToken();
    return { type: 'oauth', accessToken, email, projectId };
  } catch {
    // OAuth 실패 시 config에서 email 제거 (보안)
    removeEmailFromConfigIfNoToken();
  }

  // 2. API Key 확인
  const apiKey = getApiKeyFromConfig();
  if (apiKey) {
    return { type: 'apikey', apiKey };
  }

  throw new Error('Gemini 인증 정보가 없습니다. vibe auth gemini (OAuth) 또는 vibe auth gemini --key <key> (API Key)로 설정하세요.');
}

// Types
interface GeminiModelInfo {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
}

interface ChatOptions {
  model?: string;
  messages?: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  webSearch?: boolean;
  _retryCount?: number;
}

interface ChatResponse {
  content: string;
  model: string;
  finishReason?: string;
  usage?: unknown;
}

interface GeminiApiResponse {
  response?: {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    usageMetadata?: unknown;
  };
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: unknown;
}

// Antigravity API 버전
const ANTIGRAVITY_API_VERSION = 'v1internal';

// 사용 가능한 모델 목록 (Antigravity 지원 모델)
export const GEMINI_MODELS: Record<string, GeminiModelInfo> = {
  // Gemini 3 Pro High (최신, 정확)
  'gemini-3-pro-high': {
    id: 'gemini-3-pro-high',
    name: 'Gemini 3 Pro (High)',
    description: '최신 Pro, 최고 정확도',
    maxTokens: 8192,
  },
  // Gemini 3 Pro Low (최신, 빠름)
  'gemini-3-pro': {
    id: 'gemini-3-pro-low',
    name: 'Gemini 3 Pro (Low)',
    description: '최신 Pro, 빠른 응답',
    maxTokens: 8192,
  },
  // Gemini 3 Flash (최신, 가장 빠름)
  'gemini-3-flash': {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash',
    description: '최신 Flash, 가장 빠름',
    maxTokens: 8192,
  },
  // Claude Sonnet (Antigravity 경유)
  'claude-sonnet': {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5 (Antigravity)',
    description: 'Claude Sonnet via Gemini 구독',
    maxTokens: 8192,
  },
  // Claude Sonnet Thinking (Antigravity 경유)
  'claude-sonnet-thinking': {
    id: 'claude-sonnet-4-5-thinking',
    name: 'Claude Sonnet 4.5 Thinking (Antigravity)',
    description: 'Claude Sonnet Thinking via Gemini 구독',
    maxTokens: 8192,
  },
  // Claude Opus Thinking (Antigravity 경유)
  'claude-opus': {
    id: 'claude-opus-4-5-thinking',
    name: 'Claude Opus 4.5 Thinking (Antigravity)',
    description: 'Claude Opus via Gemini 구독',
    maxTokens: 8192,
  },
};

// 기본 모델 (gemini-3-flash가 빠름)
export const DEFAULT_MODEL = 'gemini-3-flash';

/**
 * 엔드포인트 URL 목록 (fallback 순서)
 * daily sandbox 먼저 시도 (Rate Limit 더 여유로움)
 */
const ENDPOINT_FALLBACKS = [
  'https://daily-cloudcode-pa.sandbox.googleapis.com',
  'https://cloudcode-pa.googleapis.com',
];

/**
 * 요청 ID 생성
 */
function generateRequestId(): string {
  return `agent-${crypto.randomUUID()}`;
}

/**
 * Antigravity 요청 본문 래핑
 * requestType: "agent" 필드가 핵심! (opencode-antigravity-auth 참고)
 */
function wrapRequestBody(body: unknown, projectId: string, modelId: string): Record<string, unknown> {
  return {
    project: projectId,
    model: modelId,
    request: body,
    requestType: 'agent',  // 이 필드가 없으면 429 발생!
    userAgent: 'antigravity',
    requestId: generateRequestId(),
  };
}

/**
 * Google AI Studio API 호출 (API Key 방식)
 */
async function chatWithApiKey(apiKey: string, options: ChatOptions): Promise<ChatResponse> {
  const {
    model = DEFAULT_MODEL,
    messages = [],
    maxTokens = 4096,
    temperature = 0.7,
    systemPrompt = '',
  } = options;

  // API Key 방식은 Google AI Studio 모델 사용
  // Antigravity 전용 모델(claude-*)은 API Key로 사용 불가
  const apiKeyModelMap: Record<string, string> = {
    'gemini-3-pro-high': 'gemini-1.5-pro',
    'gemini-3-pro': 'gemini-1.5-pro',
    'gemini-3-flash': 'gemini-1.5-flash',
    'claude-sonnet': 'gemini-1.5-pro', // Claude 모델은 Gemini Pro로 대체
    'claude-sonnet-thinking': 'gemini-1.5-pro',
    'claude-opus': 'gemini-1.5-pro',
  };

  const actualModel = apiKeyModelMap[model] || 'gemini-1.5-flash';

  // 메시지를 Gemini 형식으로 변환
  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  // 요청 본문
  const requestBody: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature,
    },
  };

  // 시스템 프롬프트 추가
  if (systemPrompt) {
    requestBody.systemInstruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  const retryCount = options._retryCount || 0;
  const maxRetries = 3;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();

      // 429 Rate Limit - 재시도
      if (response.status === 429 && retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000;
        await sleep(delay);
        return chatWithApiKey(apiKey, { ...options, _retryCount: retryCount + 1 });
      }

      let errorMessage = `Google AI API 오류 (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText) as { error?: { message?: string } };
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch { /* ignore */ }

      throw new Error(errorMessage);
    }

    const result = await response.json() as GeminiApiResponse;

    if (!result.candidates || result.candidates.length === 0) {
      throw new Error('Gemini API 응답이 비어있습니다.');
    }

    const candidate = result.candidates[0];
    const content = candidate.content?.parts?.[0]?.text || '';

    return {
      content,
      model: actualModel,
      finishReason: candidate.finishReason,
      usage: result.usageMetadata,
    };
  } catch (error) {
    if ((error as Error).name === 'TypeError' && retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 1000;
      await sleep(delay);
      return chatWithApiKey(apiKey, { ...options, _retryCount: retryCount + 1 });
    }
    throw error;
  }
}

/**
 * Gemini API 호출 (Antigravity v1internal - OAuth 방식)
 */
async function chatWithOAuth(accessToken: string, projectId: string | undefined, options: ChatOptions): Promise<ChatResponse> {
  const {
    model = DEFAULT_MODEL,
    messages = [],
    maxTokens = 4096,
    temperature = 0.7,
    systemPrompt = '',
    webSearch = false,
  } = options;

  // 모델 정보 가져오기
  const modelInfo = GEMINI_MODELS[model] || GEMINI_MODELS[DEFAULT_MODEL];

  // 메시지를 Gemini 형식으로 변환
  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  // 내부 요청 본문
  const innerRequest: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: Math.min(maxTokens, modelInfo.maxTokens),
      temperature,
    },
  };

  // 시스템 프롬프트가 있으면 추가 (Antigravity 스펙: parts 배열 형식)
  if (systemPrompt) {
    innerRequest.systemInstruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  // Google Search grounding 활성화
  if (webSearch) {
    innerRequest.tools = [
      {
        googleSearch: {},
      },
    ];
  }

  // Antigravity 형식으로 래핑
  const requestBody = wrapRequestBody(
    innerRequest,
    projectId || ANTIGRAVITY_DEFAULT_PROJECT_ID,
    modelInfo.id
  );

  // Claude 모델인지 확인 (thinking 모델용 헤더 필요)
  const isClaudeModel = modelInfo.id.startsWith('claude-');
  const isThinkingModel = modelInfo.id.includes('thinking');

  // 엔드포인트 fallback 시도
  let lastError: Error | null = null;
  for (const endpoint of ENDPOINT_FALLBACKS) {
    const url = `${endpoint}/${ANTIGRAVITY_API_VERSION}:generateContent`;

    // 헤더 구성 (Claude thinking 모델은 추가 헤더 필요)
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...ANTIGRAVITY_HEADERS,
    };

    // Claude thinking 모델용 특수 헤더
    if (isClaudeModel && isThinkingModel) {
      headers['anthropic-beta'] = 'interleaved-thinking-2025-05-14';
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        // 404는 다음 엔드포인트 시도
        if (response.status === 404) {
          lastError = new Error(`API not found: ${errorText}`);
          continue;
        }
        // 429 Rate Limit - 재시도 (최대 3회, 지수 백오프)
        if (response.status === 429) {
          const retryCount = options._retryCount || 0;
          if (retryCount < 3) {
            const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
            await sleep(delay);
            return chatWithOAuth(accessToken, projectId, { ...options, _retryCount: retryCount + 1 });
          }
        }
        throw new Error(`Gemini API 오류 (${response.status}): ${errorText}`);
      }

      const result = await response.json() as GeminiApiResponse;

      // Antigravity 응답 파싱 (response.candidates 형식)
      const responseData = result.response || result;
      if (!responseData.candidates || responseData.candidates.length === 0) {
        throw new Error('Gemini API 응답이 비어있습니다.');
      }

      const candidate = responseData.candidates[0];
      const content = candidate.content?.parts?.[0]?.text || '';

      return {
        content,
        model: modelInfo.name,
        finishReason: candidate.finishReason,
        usage: responseData.usageMetadata,
      };
    } catch (error) {
      lastError = error as Error;
      // 네트워크 에러면 다음 엔드포인트 시도
      if ((error as Error).name === 'TypeError' || (error as Error).message.includes('not found')) {
        continue;
      }
      throw error;
    }
  }

  // 모든 엔드포인트 실패
  throw lastError || new Error('모든 Antigravity 엔드포인트 실패');
}

/**
 * Gemini API 호출 (OAuth 또는 API Key 자동 선택 + Fallback)
 */
export async function chat(options: ChatOptions): Promise<ChatResponse> {
  const authInfo = await getAuthInfo();
  const apiKey = getApiKeyFromConfig();

  // API Key 방식
  if (authInfo.type === 'apikey' && authInfo.apiKey) {
    return chatWithApiKey(authInfo.apiKey, options);
  }

  // OAuth 방식 (API Key fallback 지원)
  if (authInfo.type === 'oauth' && authInfo.accessToken) {
    try {
      return await chatWithOAuth(authInfo.accessToken, authInfo.projectId, options);
    } catch (error) {
      // Rate Limit(429) 또는 인증 오류(401/403) 시 API Key로 fallback
      const errorMsg = (error as Error).message;
      if (apiKey && (errorMsg.includes('429') || errorMsg.includes('401') || errorMsg.includes('403'))) {
        console.log('⚠️ OAuth 한도 초과/오류 → API Key로 전환');
        return chatWithApiKey(apiKey, options);
      }
      throw error;
    }
  }

  throw new Error('Gemini 인증 정보가 없습니다.');
}

/**
 * 스트리밍 Chat (향후 구현)
 */
export async function* chatStream(options: ChatOptions): AsyncGenerator<ChatResponse> {
  // 스트리밍은 향후 필요시 구현
  const result = await chat(options);
  yield result;
}

/**
 * 사용 가능한 모델 목록 반환
 */
export function getAvailableModels(): GeminiModelInfo[] {
  return Object.values(GEMINI_MODELS);
}

/**
 * 모델 정보 가져오기
 */
export function getModelInfo(modelId: string): GeminiModelInfo | null {
  return GEMINI_MODELS[modelId] || null;
}

/**
 * 간단한 질문-응답
 */
export async function ask(prompt: string, options: Omit<ChatOptions, 'messages'> = {}): Promise<string> {
  const result = await chat({
    ...options,
    messages: [{ role: 'user', content: prompt }],
  });
  return result.content;
}

/**
 * 코드 탐색용 빠른 질문 (Gemini 3 Flash 사용)
 */
export async function quickAsk(prompt: string): Promise<string> {
  return ask(prompt, {
    model: 'gemini-3-flash',
    maxTokens: 2048,
    temperature: 0.3,
  });
}

/**
 * 웹서치로 최신 정보 검색 (Gemini 3 Pro + Google Search)
 */
export async function webSearch(prompt: string): Promise<string> {
  return ask(prompt, {
    model: 'gemini-3-pro',
    maxTokens: 4096,
    temperature: 0.3,
    webSearch: true,
    systemPrompt: 'Search the web for the latest information and provide accurate answers. Always include today\'s date and time context when relevant.',
  });
}

/**
 * 빠른 웹서치 (Gemini 3 Flash + Google Search)
 */
export async function quickWebSearch(prompt: string): Promise<string> {
  return ask(prompt, {
    model: 'gemini-3-flash',
    maxTokens: 2048,
    temperature: 0.3,
    webSearch: true,
  });
}

/**
 * UI/UX 분석용 (Gemini 3 Pro 사용)
 */
export async function analyzeUI(prompt: string): Promise<string> {
  return ask(prompt, {
    model: 'gemini-3-pro',
    maxTokens: 4096,
    temperature: 0.5,
    systemPrompt: 'You are a UI/UX expert. Analyze the given design or component and provide detailed feedback.',
  });
}

// ============================================
// Vibe Gemini Orchestration Functions
// 검색 없이 빠르고 결정론적인 응답
// ============================================

/**
 * Vibe Gemini 오케스트레이션 옵션
 */
interface VibeGeminiOptions {
  maxTokens?: number;
  jsonMode?: boolean;
}

/**
 * Vibe Gemini 오케스트레이션 (검색 없음, JSON 모드)
 * - 검색 제외로 빠른 응답
 * - temperature=0 으로 결정론적 결과
 * - JSON 출력 강제 가능
 */
export async function vibeGeminiOrchestrate(
  prompt: string,
  systemPrompt: string,
  options: VibeGeminiOptions = {}
): Promise<string> {
  const { maxTokens = 4096, jsonMode = true } = options;

  const result = await chat({
    model: 'gemini-3-pro-high',
    messages: [{ role: 'user', content: prompt }],
    maxTokens,
    temperature: 0,
    webSearch: false, // 검색 제외
    systemPrompt: jsonMode
      ? `${systemPrompt}\n\nIMPORTANT: You must respond with valid JSON only. No markdown, no explanation, just pure JSON.`
      : systemPrompt,
  });
  return result.content;
}

/**
 * Vibe Spec 파싱 (Vibe Spec → 실행 계획)
 */
export async function vibeGeminiParseSpec(spec: string): Promise<string> {
  return vibeGeminiOrchestrate(spec, `You are a Vibe Spec parser. Parse the given specification and output a structured execution plan.
Output format: { "phases": [...], "files": [...], "dependencies": [...] }`);
}

/**
 * Vibe 실행 계획 수립 (Task → Steps)
 */
export async function vibeGeminiPlanExecution(task: string, context: string): Promise<string> {
  return vibeGeminiOrchestrate(
    `Task: ${task}\n\nContext:\n${context}`,
    `You are a Vibe execution planner. Given a task and context, create a step-by-step execution plan.
Output format: { "steps": [{ "id": 1, "action": "...", "target": "...", "expected": "..." }], "estimatedComplexity": "low|medium|high" }`
  );
}

/**
 * Vibe 코드 분석 (빠른 구조 분석)
 */
export async function vibeGeminiAnalyze(code: string, question: string): Promise<string> {
  return vibeGeminiOrchestrate(
    `Code:\n\`\`\`\n${code}\n\`\`\`\n\nQuestion: ${question}`,
    `You are a code analyzer. Answer the question about the given code concisely.
Output format: { "answer": "...", "confidence": 0.0-1.0, "relatedSymbols": [...] }`
  );
}

/**
 * Vibe 다음 액션 결정 (상태 기반)
 */
export async function vibeGeminiDecideNextAction(
  currentState: string,
  availableActions: string[],
  goal: string
): Promise<string> {
  return vibeGeminiOrchestrate(
    `Current State:\n${currentState}\n\nAvailable Actions:\n${availableActions.join('\n')}\n\nGoal: ${goal}`,
    `You are an action decider. Based on the current state and goal, select the best next action.
Output format: { "selectedAction": "...", "reason": "...", "parameters": {} }`
  );
}

/**
 * Vibe UI/UX 분석 (검색 없이 내부 지식으로)
 */
export async function vibeGeminiAnalyzeUX(description: string): Promise<string> {
  return vibeGeminiOrchestrate(
    description,
    `You are a UI/UX expert. Analyze the given design description and provide structured feedback.
Output format: { "issues": [...], "suggestions": [...], "accessibility": { "score": 0-100, "concerns": [...] } }`,
    { jsonMode: true }
  );
}
