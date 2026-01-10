/**
 * GPT API 호출 (ChatGPT Codex Backend)
 * ChatGPT Plus/Pro 구독으로 GPT-5.2 Codex 모델 사용
 */

import { getValidAccessToken } from './gpt-oauth.js';
import { CHATGPT_BASE_URL } from './gpt-constants.js';

// Types
interface GptModelInfo {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
  reasoning: { effort: string; summary: string };
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
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
  finishReason: string;
}

interface StreamChunk {
  type: 'delta' | 'done';
  content?: string;
}

// Codex API 엔드포인트
const CODEX_RESPONSES_URL = `${CHATGPT_BASE_URL}/codex/responses`;

// GitHub에서 Codex instructions 가져오기 (캐시)
let cachedInstructions: string | null = null;
let instructionsCacheTime = 0;
const INSTRUCTIONS_CACHE_TTL = 15 * 60 * 1000; // 15분

// 사용 가능한 모델 목록
export const GPT_MODELS: Record<string, GptModelInfo> = {
  // GPT-5.2 (최신)
  'gpt-5.2': {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    description: '최신 GPT, 범용',
    maxTokens: 32768,
    reasoning: { effort: 'medium', summary: 'auto' },
  },
  // GPT-5.2 Codex (코딩 특화)
  'gpt-5.2-codex': {
    id: 'gpt-5.2-codex',
    name: 'GPT-5.2 Codex',
    description: '최신 Codex, 코딩 특화',
    maxTokens: 32768,
    reasoning: { effort: 'high', summary: 'auto' },
  },
  // GPT-5.1 Codex
  'gpt-5.1-codex': {
    id: 'gpt-5.1-codex',
    name: 'GPT-5.1 Codex',
    description: '안정적인 Codex',
    maxTokens: 32768,
    reasoning: { effort: 'medium', summary: 'auto' },
  },
  // GPT-5.1 Codex Mini (빠름)
  'gpt-5.1-codex-mini': {
    id: 'gpt-5.1-codex-mini',
    name: 'GPT-5.1 Codex Mini',
    description: '빠른 Codex',
    maxTokens: 16384,
    reasoning: { effort: 'medium', summary: 'auto' },
  },
  // GPT-5.1 Codex Max (고성능)
  'gpt-5.1-codex-max': {
    id: 'gpt-5.1-codex-max',
    name: 'GPT-5.1 Codex Max',
    description: '최고 성능 Codex',
    maxTokens: 32768,
    reasoning: { effort: 'xhigh', summary: 'auto' },
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
  } catch {
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
  } catch {
    // 캐시된 버전이 있으면 사용
    if (cachedInstructions) {
      return cachedInstructions;
    }
    // 기본 instructions 반환
    return 'You are a helpful coding assistant.';
  }
}

/**
 * 지연 함수
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
        } catch {
          // JSON 파싱 실패 무시
        }
      }
    }
  }

  return result;
}

/**
 * GPT API 호출 (Codex Backend)
 */
export async function chat(options: ChatOptions): Promise<ChatResponse> {
  const {
    model = DEFAULT_MODEL,
    messages = [],
    systemPrompt = '',
  } = options;

  // 토큰 가져오기
  const { accessToken } = await getValidAccessToken();

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

  // 시스템 프롬프트가 있으면 instructions에 추가
  const finalInstructions = systemPrompt
    ? `${instructions}\n\n<user_context>\n${systemPrompt}\n</user_context>`
    : instructions;

  // 요청 본문
  const requestBody = {
    model: modelInfo.id,
    store: false,
    stream: true,
    input,
    instructions: finalInstructions,
    reasoning: modelInfo.reasoning,
    text: { verbosity: 'medium' },
    include: ['reasoning.encrypted_content'],
  };

  // API 호출 (재시도 로직 포함)
  const retryCount = options._retryCount || 0;
  const maxRetries = 3;

  try {
    const response = await fetch(CODEX_RESPONSES_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'responses=experimental',
        'originator': 'codex_cli_rs',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();

      // 429 Rate Limit - 재시도
      if (response.status === 429 && retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000;
        await sleep(delay);
        return chat({ ...options, _retryCount: retryCount + 1 });
      }

      // 에러 파싱
      let errorMessage = `GPT API 오류 (${response.status})`;
      try {
        const errorJson = JSON.parse(errorText) as { error?: { message?: string }; detail?: string };
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        } else if (errorJson.detail) {
          errorMessage = errorJson.detail;
        }
      } catch {
        errorMessage += `: ${errorText.substring(0, 200)}`;
      }

      throw new Error(errorMessage);
    }

    // 스트리밍 응답 파싱
    const content = await parseSSEStream(response.body!);

    return {
      content,
      model: modelInfo.name,
      finishReason: 'stop',
    };
  } catch (error) {
    // 네트워크 에러 재시도
    if ((error as Error).name === 'TypeError' && retryCount < maxRetries) {
      const delay = Math.pow(2, retryCount) * 1000;
      await sleep(delay);
      return chat({ ...options, _retryCount: retryCount + 1 });
    }
    throw error;
  }
}

/**
 * 스트리밍 Chat
 */
export async function* chatStream(options: ChatOptions): AsyncGenerator<StreamChunk> {
  const {
    model = DEFAULT_MODEL,
    messages = [],
    systemPrompt = '',
  } = options;

  const { accessToken } = await getValidAccessToken();
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

  const requestBody = {
    model: modelInfo.id,
    store: false,
    stream: true,
    input,
    instructions: finalInstructions,
    reasoning: modelInfo.reasoning,
    text: { verbosity: 'medium' },
    include: ['reasoning.encrypted_content'],
  };

  const response = await fetch(CODEX_RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'responses=experimental',
      'originator': 'codex_cli_rs',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GPT API 오류 (${response.status}): ${errorText}`);
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
        } catch {
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

/**
 * 아키텍처/디버깅 분석 (GPT-5.2 사용)
 */
export async function analyzeArchitecture(prompt: string): Promise<string> {
  return ask(prompt, {
    model: 'gpt-5.2',
    maxTokens: 8192,
    temperature: 0.5,
    systemPrompt: 'You are a senior software architect. Analyze the given code or architecture and provide detailed insights, potential issues, and recommendations.',
  });
}

/**
 * 코드 디버깅 (GPT-5.2 Codex 사용)
 */
export async function debugCode(prompt: string): Promise<string> {
  return ask(prompt, {
    model: 'gpt-5.2-codex',
    maxTokens: 4096,
    temperature: 0.3,
    systemPrompt: 'You are an expert debugger. Analyze the given code, identify bugs, and provide fixes with clear explanations.',
  });
}
