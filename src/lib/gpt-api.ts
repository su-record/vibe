/**
 * GPT API 호출
 * - OAuth: ChatGPT 구독으로 GPT 모델 사용
 * - API Key: OpenAI API 직접 호출
 */

import path from 'path';
import fs from 'fs';
import { getValidAccessToken } from './gpt-oauth.js';
import { CHATGPT_BASE_URL } from './gpt-constants.js';
import { sleep, warnLog } from './utils.js';


// 인증 정보 타입
interface AuthInfo {
  type: 'oauth' | 'apikey';
  accessToken?: string;
  apiKey?: string;
  email?: string;
}

// config에서 API Key 가져오기
function getApiKeyFromConfig(): string | null {
  try {
    const configPath = path.join(process.cwd(), '.claude', 'vibe', 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.models?.gpt?.apiKey) {
        return config.models.gpt.apiKey;
      }
    }
  } catch (e) {
    warnLog('Failed to read GPT API key from config', e);
  }
  return null;
}

// OAuth 토큰 없을 때 config에서 email 제거
function removeEmailFromConfigIfNoToken(): void {
  try {
    const configPath = path.join(process.cwd(), '.claude', 'vibe', 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.models?.gpt?.email) {
        delete config.models.gpt.email;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      }
    }
  } catch (e) {
    warnLog('Failed to remove email from GPT config', e);
  }
}

// 인증 방식 확인 (OAuth 우선, API Key 대체)
async function getAuthInfo(): Promise<AuthInfo> {
  // 1. OAuth 토큰 확인 (우선)
  try {
    const { accessToken, email } = await getValidAccessToken();
    return { type: 'oauth', accessToken, email };
  } catch {
    // OAuth 실패 시 config에서 email 제거 (보안)
    removeEmailFromConfigIfNoToken();
  }

  // 2. API Key 확인
  const apiKey = getApiKeyFromConfig();
  if (apiKey) {
    return { type: 'apikey', apiKey };
  }

  throw new Error('GPT 인증 정보가 없습니다. vibe auth gpt (OAuth) 또는 vibe auth gpt --key <key> (API Key)로 설정하세요.');
}

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
  webSearch?: boolean;
  userLocation?: { country: string };
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

// OpenAI API 응답 타입
interface OpenAIMessage {
  role: string;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

interface OpenAIResponse {
  choices: Array<{
    message: OpenAIMessage;
    finish_reason: string;
  }>;
  model: string;
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
    webSearch = false,
  } = options;

  // API Key 방식은 표준 OpenAI 모델 사용 (gpt-4o, gpt-4-turbo 등)
  // Codex 모델은 OAuth 전용이므로 대체 모델 매핑
  const apiKeyModelMap: Record<string, string> = {
    'gpt-5.2': 'gpt-4o',
    'gpt-5.2-codex': 'gpt-4o',
    'gpt-5.1-codex': 'gpt-4-turbo',
    'gpt-5.1-codex-mini': 'gpt-4o-mini',
    'gpt-5.1-codex-max': 'gpt-4o',
  };

  const actualModel = apiKeyModelMap[model] || 'gpt-4o';

  // 메시지 구성
  const apiMessages: Array<{ role: string; content: string | null; tool_call_id?: string; name?: string }> = [];
  if (systemPrompt) {
    apiMessages.push({ role: 'system', content: systemPrompt });
  }
  for (const msg of messages) {
    apiMessages.push({ role: msg.role, content: msg.content });
  }

  const retryCount = options._retryCount || 0;
  const maxRetries = 3;

  // 웹 검색이 활성화되면 도구 추가
  const tools = webSearch ? [{ type: 'web_search' as const }] : undefined;

  try {
    // 1차 API 호출
    const requestBody: Record<string, unknown> = {
      model: actualModel,
      messages: apiMessages,
      max_tokens: maxTokens,
      temperature,
    };

    if (tools) {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    }

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

      let errorMessage = `OpenAI API 오류 (${response.status})`;
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
async function chatWithOAuth(accessToken: string, options: ChatOptions): Promise<ChatResponse> {
  const {
    model = DEFAULT_MODEL,
    messages = [],
    systemPrompt = '',
    webSearch = false,
  } = options;

  // 모델 정보 가져오기
  const modelInfo = GPT_MODELS[model] || GPT_MODELS[DEFAULT_MODEL];

  // Codex instructions 가져오기
  const instructions = await getCodexInstructions(modelInfo.id);

  // 웹 검색은 Codex API의 web_search 도구로 처리

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

  // 요청 본문 (web_search 도구 활성화)
  const requestBody: Record<string, unknown> = {
    model: modelInfo.id,
    store: false,
    stream: true,
    input,
    instructions: finalInstructions,
    reasoning: modelInfo.reasoning,
    text: { verbosity: 'medium' },
    include: ['reasoning.encrypted_content'],
  };

  // 참고: Codex API는 web_search 도구를 지원하지 않음
  // 웹 검색이 필요하면 API Key 방식 사용 권장

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
        return chatWithOAuth(accessToken, { ...options, _retryCount: retryCount + 1 });
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
      return chatWithOAuth(accessToken, { ...options, _retryCount: retryCount + 1 });
    }
    throw error;
  }
}

/**
 * GPT API 호출 (OAuth 또는 API Key 자동 선택 + Fallback)
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
      // 웹 검색 요청인데 OAuth 방식이면 web_search_preview 에러 가능
      // → API Key로 우선 시도
      if (options.webSearch && apiKey) {
        return chatWithApiKey(apiKey, options);
      }
      return await chatWithOAuth(authInfo.accessToken, options);
    } catch (error) {
      // Rate Limit(429), 인증 오류(401/403), 또는 Unsupported tool 오류 시 API Key로 fallback
      const errorMsg = (error as Error).message;
      const shouldFallback = errorMsg.includes('429') ||
                            errorMsg.includes('401') ||
                            errorMsg.includes('403') ||
                            errorMsg.includes('Unsupported tool') ||
                            errorMsg.includes('web_search');
      if (apiKey && shouldFallback) {
        console.log('⚠️ OAuth 오류 → API Key로 전환');
        return chatWithApiKey(apiKey, options);
      }
      throw error;
    }
  }

  throw new Error('GPT 인증 정보가 없습니다.');
}

/**
 * 스트리밍 Chat (OAuth 또는 API Key 자동 선택)
 */
export async function* chatStream(options: ChatOptions): AsyncGenerator<StreamChunk> {
  const authInfo = await getAuthInfo();

  // API Key 방식은 스트리밍 미지원 - 일반 chat 사용
  if (authInfo.type === 'apikey') {
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
      'Authorization': `Bearer ${authInfo.accessToken}`,
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

/**
 * 웹서치로 최신 정보 검색 (GPT-5.2 + Web Search)
 */
export async function webSearch(prompt: string, country?: string): Promise<string> {
  return ask(prompt, {
    model: 'gpt-5.2',
    maxTokens: 4096,
    temperature: 0.3,
    webSearch: true,
    userLocation: country ? { country } : undefined,
    systemPrompt: 'Search the web for the latest information and provide accurate answers with source citations.',
  });
}

/**
 * 빠른 웹서치 (GPT-5.2 + Web Search)
 */
export async function quickWebSearch(prompt: string): Promise<string> {
  return ask(prompt, {
    model: 'gpt-5.2',
    maxTokens: 2048,
    temperature: 0.3,
    webSearch: true,
    userLocation: { country: 'KR' },
  });
}

// ============================================
// Vibe GPT Orchestration Functions
// 검색 없이 빠르고 결정론적인 응답
// ============================================

/**
 * Vibe GPT 오케스트레이션 옵션
 */
interface VibeGptOptions {
  maxTokens?: number;
  jsonMode?: boolean;
}

/**
 * Vibe GPT 오케스트레이션 (검색 없음, JSON 모드)
 * - 검색 제외로 빠른 응답
 * - temperature=0 으로 결정론적 결과
 * - JSON 출력 강제 가능
 */
export async function vibeGptOrchestrate(
  prompt: string,
  systemPrompt: string,
  options: VibeGptOptions = {}
): Promise<string> {
  const { maxTokens = 4096, jsonMode = true } = options;

  const result = await chat({
    model: 'gpt-5.2-codex',
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
export async function vibeGptParseSpec(spec: string): Promise<string> {
  return vibeGptOrchestrate(spec, `You are a Vibe Spec parser. Parse the given specification and output a structured execution plan.
Output format: { "phases": [...], "files": [...], "dependencies": [...] }`);
}

/**
 * Vibe 실행 계획 수립 (Task → Steps)
 */
export async function vibeGptPlanExecution(task: string, context: string): Promise<string> {
  return vibeGptOrchestrate(
    `Task: ${task}\n\nContext:\n${context}`,
    `You are a Vibe execution planner. Given a task and context, create a step-by-step execution plan.
Output format: { "steps": [{ "id": 1, "action": "...", "target": "...", "expected": "..." }], "estimatedComplexity": "low|medium|high" }`
  );
}

/**
 * Vibe 코드 분석 (빠른 구조 분석)
 */
export async function vibeGptAnalyze(code: string, question: string): Promise<string> {
  return vibeGptOrchestrate(
    `Code:\n\`\`\`\n${code}\n\`\`\`\n\nQuestion: ${question}`,
    `You are a code analyzer. Answer the question about the given code concisely.
Output format: { "answer": "...", "confidence": 0.0-1.0, "relatedSymbols": [...] }`
  );
}

/**
 * Vibe 다음 액션 결정 (상태 기반)
 */
export async function vibeGptDecideNextAction(
  currentState: string,
  availableActions: string[],
  goal: string
): Promise<string> {
  return vibeGptOrchestrate(
    `Current State:\n${currentState}\n\nAvailable Actions:\n${availableActions.join('\n')}\n\nGoal: ${goal}`,
    `You are an action decider. Based on the current state and goal, select the best next action.
Output format: { "selectedAction": "...", "reason": "...", "parameters": {} }`
  );
}
