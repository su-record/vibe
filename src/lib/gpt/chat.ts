/**
 * GPT 채팅 API
 */

import crypto from 'crypto';
import { CHATGPT_BASE_URL } from '../gpt-constants.js';
import { sleep } from '../utils.js';
import { getAuthInfo, getApiKeyFromConfig, getAzureConfig } from './auth.js';
import type {
  GptModelInfo,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  OpenAIResponse,
  VibeGptOptions,
  AuthInfo,
} from './types.js';

// Codex API 엔드포인트
const CODEX_RESPONSES_URL = `${CHATGPT_BASE_URL}/codex/responses`;

// GitHub에서 Codex instructions 가져오기 (캐시)
let cachedInstructions: string | null = null;
let instructionsCacheTime = 0;
const INSTRUCTIONS_CACHE_TTL = 15 * 60 * 1000; // 15분

// 사용 가능한 모델 목록
export const GPT_MODELS: Record<string, GptModelInfo> = {
  // GPT-5.2 (latest)
  'gpt-5.2': {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    description: 'Latest GPT, general purpose',
    maxTokens: 32768,
    reasoning: { effort: 'medium', summary: 'auto' },
  },
  // GPT-5.2 Codex (coding specialized)
  'gpt-5.2-codex': {
    id: 'gpt-5.2-codex',
    name: 'GPT-5.2 Codex',
    description: 'Latest Codex, coding specialized',
    maxTokens: 32768,
    reasoning: { effort: 'high', summary: 'auto' },
  },
  // GPT-5.3 Codex (function calling optimized)
  'gpt-5.3-codex': {
    id: 'gpt-5.3-codex',
    name: 'GPT-5.3 Codex',
    description: 'Function calling optimized, agent head model',
    maxTokens: 32768,
    reasoning: { effort: 'high', summary: 'auto' },
  },
};

// 기본 모델
export const DEFAULT_MODEL = 'gpt-5.2';

/**
 * GitHub에서 Codex instructions 가져오기
 */
export async function getCodexInstructions(model: string = 'gpt-5.2'): Promise<string> {
  // 캐시 확인
  if (cachedInstructions && Date.now() - instructionsCacheTime < INSTRUCTIONS_CACHE_TTL) {
    return cachedInstructions;
  }

  // 모델에 따른 prompt 파일 선택
  let promptFile = 'gpt_5_2_prompt.md';
  if (model.includes('5.1-codex-max')) {
    promptFile = 'gpt-5.1-codex-max_prompt.md';
  } else if (model.includes('5.1-codex')) {
    promptFile = 'gpt_5_codex_prompt.md';
  } else if (model.includes('5.2-codex')) {
    promptFile = 'gpt-5.2-codex_prompt.md';
  } else if (model.includes('5.1')) {
    promptFile = 'gpt_5_1_prompt.md';
  }

  // 최신 릴리스 태그 가져오기
  let tag = 'rust-v0.80.0'; // 기본값
  try {
    const releaseRes = await fetch('https://github.com/openai/codex/releases/latest', {
      redirect: 'manual',
    });
    const location = releaseRes.headers.get('location');
    if (location) {
      const match = location.match(/\/tag\/([^/]+)$/);
      if (match) tag = match[1];
    }
  } catch { /* ignore: optional operation */
    // 기본 태그 사용
  }

  const url = `https://raw.githubusercontent.com/openai/codex/${tag}/codex-rs/core/${promptFile}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch instructions: ${response.status}`);
    }
    cachedInstructions = await response.text();
    instructionsCacheTime = Date.now();
    return cachedInstructions;
  } catch { /* ignore: optional operation */
    // 캐시된 버전이 있으면 사용
    if (cachedInstructions) {
      return cachedInstructions;
    }
    // 기본 instructions 반환
    return 'You are a helpful coding assistant.';
  }
}

/**
 * SSE 스트림 파싱
 */
async function parseSSEStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const json = JSON.parse(data) as { type: string; delta?: string };
          if (json.type === 'response.output_text.delta') {
            result += json.delta || '';
          }
        } catch { /* ignore: optional operation */
          // JSON 파싱 실패 무시
        }
      }
    }
  }

  return result;
}

/**
 * OpenAI Chat Completions API 호출 (API Key 방식 + Function Calling 웹 검색)
 */
async function chatWithApiKey(apiKey: string, options: ChatOptions): Promise<ChatResponse> {
  const {
    model = DEFAULT_MODEL,
    messages = [],
    maxTokens = 4096,
    temperature = 0.7,
    systemPrompt = '',
  } = options;

  // API Key 방식은 OpenAI 모델 사용
  const apiKeyModelMap: Record<string, string> = {
    'gpt-5.2': 'gpt-5.2',
    'gpt-5.2-codex': 'gpt-5.2',
    'gpt-5.3-codex': 'gpt-5.3-codex',
    'gpt-5.1-codex': 'gpt-5.2',
    'gpt-5.1-codex-mini': 'gpt-5.2',
    'gpt-5.1-codex-max': 'gpt-5.2',
  };

  const actualModel = apiKeyModelMap[model] || 'gpt-5.2';

  // 메시지 구성
  const apiMessages: Array<{ role: string; content: string | null }> = [];
  if (systemPrompt) {
    apiMessages.push({ role: 'system', content: systemPrompt });
  }
  for (const msg of messages) {
    apiMessages.push({ role: msg.role, content: msg.content });
  }

  const retryCount = options._retryCount || 0;
  const maxRetries = 3;

  try {
    const requestBody: Record<string, unknown> = {
      model: actualModel,
      messages: apiMessages,
      max_completion_tokens: maxTokens,  // GPT-5.2 uses max_completion_tokens instead of max_tokens
      temperature,
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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

      let errorMessage = `OpenAI API error (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText) as { error?: { message?: string } };
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch { /* ignore */ }

      throw new Error(errorMessage);
    }

    const result = await response.json() as OpenAIResponse;
    const assistantMessage = result.choices[0]?.message;


    // 일반 응답 (Function Calling 없음)
    return {
      content: assistantMessage?.content || '',
      model: result.model,
      finishReason: result.choices[0]?.finish_reason || 'stop',
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
 * GPT API 호출 (Codex Backend - OAuth 방식)
 */
async function chatWithOAuth(accessToken: string, options: ChatOptions, accountId?: string): Promise<ChatResponse> {
  const {
    model = DEFAULT_MODEL,
    messages = [],
    systemPrompt = '',
  } = options;

  // 모델 정보 가져오기
  const modelInfo = GPT_MODELS[model] || GPT_MODELS[DEFAULT_MODEL];

  // Codex instructions 가져오기
  const instructions = await getCodexInstructions(modelInfo.id);

  // 메시지를 Codex 형식으로 변환
  const input = messages.map(msg => ({
    type: 'message',
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: [{ type: 'input_text', text: msg.content }],
  }));

  // 시스템 프롬프트를 instructions에 추가
  let finalInstructions = instructions;
  if (systemPrompt) {
    finalInstructions = `${instructions}\n\n<user_context>\n${systemPrompt}\n</user_context>`;
  }

  const sessionId = crypto.randomUUID();

  const requestBody: Record<string, unknown> = {
    model: modelInfo.id,
    store: false,
    stream: true,
    input,
    instructions: finalInstructions,
    reasoning: modelInfo.reasoning,
    text: { verbosity: 'medium' },
    include: ['reasoning.encrypted_content'],
    prompt_cache_key: sessionId,
  };

  // API 호출 (재시도 로직 포함)
  const retryCount = options._retryCount || 0;
  const maxRetries = 3;

  try {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'responses=experimental',
      'originator': 'codex_cli_rs',
      'session_id': sessionId,
    };
    if (accountId) {
      headers['chatgpt-account-id'] = accountId;
    }

    const response = await fetch(CODEX_RESPONSES_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();

      // 429 Rate Limit - 재시도
      if (response.status === 429 && retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000;
        await sleep(delay);
        return chatWithOAuth(accessToken, { ...options, _retryCount: retryCount + 1 }, accountId);
      }

      // 에러 파싱
      let errorMessage = `GPT API error (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText) as { error?: { message?: string }; detail?: string };
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        } else if (errorJson.detail) {
          errorMessage = errorJson.detail;
        }
      } catch { /* ignore: optional operation */
        errorMessage += `: ${errorText.substring(0, 200)}`;
      }

      throw new Error(errorMessage);
    }

    // 스트리밍 응답 파싱
    const content = await parseSSEStream(response.body!);
    const modelInfo2 = GPT_MODELS[model] || GPT_MODELS[DEFAULT_MODEL];

    return {
      content,
      model: modelInfo2.name,
      finishReason: 'stop',
    };
  } catch (error) {
    // 네트워크 에러 재시도
    if ((error as Error).name === 'TypeError' && retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 1000;
      await sleep(delay);
      return chatWithOAuth(accessToken, { ...options, _retryCount: retryCount + 1 }, accountId);
    }
    throw error;
  }
}

/**
 * Azure OpenAI Chat Completions API 호출
 */
async function chatWithAzure(authInfo: AuthInfo, options: ChatOptions): Promise<ChatResponse> {
  const {
    messages = [],
    maxTokens = 4096,
    temperature = 0.7,
    systemPrompt = '',
  } = options;

  const endpoint = authInfo.azureEndpoint!;
  const apiKey = authInfo.azureApiKey!;
  const deployment = authInfo.azureDeployment!;
  const apiVersion = authInfo.azureApiVersion || '2024-12-01-preview';

  // 메시지 구성
  const apiMessages: Array<{ role: string; content: string | null }> = [];
  if (systemPrompt) {
    apiMessages.push({ role: 'system', content: systemPrompt });
  }
  for (const msg of messages) {
    apiMessages.push({ role: msg.role, content: msg.content });
  }

  const retryCount = options._retryCount || 0;
  const maxRetries = 3;

  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  // 요청 body 구성 (모델에 따라 지원하지 않는 파라미터 제외)
  const requestBody: Record<string, unknown> = {
    messages: apiMessages,
    max_completion_tokens: maxTokens,
  };
  // temperature 1이 아닐 때만 포함 (일부 모델은 기본값만 지원)
  if (temperature !== undefined && temperature !== 1) {
    requestBody.temperature = temperature;
  }

  const headers = { 'api-key': apiKey, 'Content-Type': 'application/json' };

  try {
    let response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    // temperature 미지원 모델 → temperature 제거 후 재시도
    if (!response.ok && requestBody.temperature !== undefined) {
      const text = await response.text();
      if (text.includes("'temperature' does not support")) {
        delete requestBody.temperature;
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
        });
      }
    }

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 429 && retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000;
        await sleep(delay);
        return chatWithAzure(authInfo, { ...options, _retryCount: retryCount + 1 });
      }

      let errorMessage = `Azure OpenAI API error (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText) as { error?: { message?: string } };
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch { /* ignore */ }

      throw new Error(errorMessage);
    }

    const result = await response.json() as OpenAIResponse;
    const assistantMessage = result.choices[0]?.message;

    return {
      content: assistantMessage?.content || '',
      model: result.model || `azure:${deployment}`,
      finishReason: result.choices[0]?.finish_reason || 'stop',
    };
  } catch (error) {
    if ((error as Error).name === 'TypeError' && retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 1000;
      await sleep(delay);
      return chatWithAzure(authInfo, { ...options, _retryCount: retryCount + 1 });
    }
    throw error;
  }
}

/**
 * 인증 방식에 따라 적절한 chat 함수 호출
 */
async function callWithAuth(authInfo: AuthInfo, options: ChatOptions): Promise<ChatResponse> {
  switch (authInfo.type) {
    case 'azure':
      return chatWithAzure(authInfo, options);
    case 'apikey':
      return chatWithApiKey(authInfo.apiKey!, options);
    case 'oauth':
      return chatWithOAuth(authInfo.accessToken!, options, authInfo.accountId);
    default:
      throw new Error(`Unknown auth type: ${authInfo.type}`);
  }
}

/**
 * fallback 가능한 에러인지 확인
 */
function isFallbackError(errorMsg: string): boolean {
  return errorMsg.includes('429') ||
    errorMsg.includes('401') ||
    errorMsg.includes('403') ||
    errorMsg.toLowerCase().includes('usage limit') ||
    errorMsg.toLowerCase().includes('rate limit') ||
    errorMsg.toLowerCase().includes('quota');
}

/**
 * GPT API 호출 (고정 순서 인증 + Fallback)
 * oauth → apikey → azure 순서, 실패 시 다음 방식으로 자동 전환
 */
export async function chat(options: ChatOptions): Promise<ChatResponse> {
  const authInfo = await getAuthInfo();

  try {
    return await callWithAuth(authInfo, options);
  } catch (error) {
    const errorMsg = (error as Error).message;
    if (!isFallbackError(errorMsg)) {
      throw error;
    }

    // 현재 방식 실패 → 다른 방식으로 fallback
    const fallbacks: Array<() => AuthInfo | null> = [];

    if (authInfo.type !== 'apikey') {
      fallbacks.push(() => {
        const apiKey = getApiKeyFromConfig();
        return apiKey ? { type: 'apikey' as const, apiKey } : null;
      });
    }
    if (authInfo.type !== 'azure') {
      fallbacks.push(() => {
        const config = getAzureConfig();
        return config ? {
          type: 'azure' as const,
          azureEndpoint: config.endpoint,
          azureApiKey: config.apiKey,
          azureDeployment: config.deployment,
          azureApiVersion: config.apiVersion,
        } : null;
      });
    }

    for (const getFallback of fallbacks) {
      try {
        const fallbackAuth = getFallback();
        if (fallbackAuth) {
          return await callWithAuth(fallbackAuth, options);
        }
      } catch { continue; }
    }

    throw error;
  }
}

/**
 * 스트리밍 Chat (OAuth 또는 API Key 자동 선택)
 */
export async function* chatStream(options: ChatOptions): AsyncGenerator<StreamChunk> {
  const authInfo = await getAuthInfo();

  // API Key / Azure 방식은 스트리밍 미지원 - 일반 chat 사용
  if (authInfo.type === 'apikey' || authInfo.type === 'azure') {
    const result = await chat(options);
    yield { type: 'delta', content: result.content };
    yield { type: 'done' };
    return;
  }

  // OAuth 방식 - Codex 스트리밍
  const {
    model = DEFAULT_MODEL,
    messages = [],
    systemPrompt = '',
  } = options;

  const modelInfo = GPT_MODELS[model] || GPT_MODELS[DEFAULT_MODEL];
  const instructions = await getCodexInstructions(modelInfo.id);

  const input = messages.map(msg => ({
    type: 'message',
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: [{ type: 'input_text', text: msg.content }],
  }));

  const finalInstructions = systemPrompt
    ? `${instructions}\n\n<user_context>\n${systemPrompt}\n</user_context>`
    : instructions;

  const streamSessionId = crypto.randomUUID();

  const requestBody = {
    model: modelInfo.id,
    store: false,
    stream: true,
    input,
    instructions: finalInstructions,
    reasoning: modelInfo.reasoning,
    text: { verbosity: 'medium' },
    include: ['reasoning.encrypted_content'],
    prompt_cache_key: streamSessionId,
  };

  const streamHeaders: Record<string, string> = {
    'Authorization': `Bearer ${authInfo.accessToken}`,
    'Content-Type': 'application/json',
    'OpenAI-Beta': 'responses=experimental',
    'originator': 'codex_cli_rs',
    'session_id': streamSessionId,
  };
  if (authInfo.accountId) {
    streamHeaders['chatgpt-account-id'] = authInfo.accountId;
  }

  const response = await fetch(CODEX_RESPONSES_URL, {
    method: 'POST',
    headers: streamHeaders,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GPT API error (${response.status}): ${errorText}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          yield { type: 'done' };
          return;
        }

        try {
          const json = JSON.parse(data) as { type: string; delta?: string };
          if (json.type === 'response.output_text.delta') {
            yield { type: 'delta', content: json.delta || '' };
          }
        } catch { /* ignore: optional operation */
          // JSON 파싱 실패 무시
        }
      }
    }
  }
}

/**
 * 사용 가능한 모델 목록 반환
 */
export function getAvailableModels(): GptModelInfo[] {
  return Object.values(GPT_MODELS);
}

/**
 * 모델 정보 가져오기
 */
export function getModelInfo(modelId: string): GptModelInfo | null {
  return GPT_MODELS[modelId] || null;
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
 * 빠른 질문 (GPT-5.1 Codex Mini 사용)
 */
export async function quickAsk(prompt: string): Promise<string> {
  return ask(prompt, {
    model: 'gpt-5.1-codex-mini',
    maxTokens: 2048,
    temperature: 0.3,
  });
}
