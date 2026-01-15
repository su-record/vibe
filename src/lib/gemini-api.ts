/**
 * Gemini API 호출 (Antigravity 경유)
 * Gemini 구독으로 Gemini 2.5/3 Flash/Pro 모델 사용
 */

import crypto from 'crypto';

import {
  ANTIGRAVITY_HEADERS,
  ANTIGRAVITY_DEFAULT_PROJECT_ID,
} from './gemini-constants.js';

import { getValidAccessToken } from './gemini-oauth.js';
import { sleep } from './utils.js';

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
 * Gemini API 호출 (Antigravity v1internal)
 */
export async function chat(options: ChatOptions): Promise<ChatResponse> {
  const {
    model = DEFAULT_MODEL,
    messages = [],
    maxTokens = 4096,
    temperature = 0.7,
    systemPrompt = '',
  } = options;

  // 토큰 가져오기
  const { accessToken, projectId } = await getValidAccessToken();

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
            return chat({ ...options, _retryCount: retryCount + 1 });
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
