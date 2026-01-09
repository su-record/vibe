/**
 * Gemini API 호출 (Antigravity 경유)
 * Gemini 구독으로 Gemini 2.5/3 Flash/Pro 모델 사용
 */

const crypto = require('crypto');

const {
  ANTIGRAVITY_ENDPOINTS,
  ANTIGRAVITY_HEADERS,
  ANTIGRAVITY_DEFAULT_PROJECT_ID,
} = require('./gemini-constants');

const { getValidAccessToken } = require('./gemini-oauth');

// Antigravity API 버전
const ANTIGRAVITY_API_VERSION = 'v1internal';

// 사용 가능한 모델 목록 (Antigravity 지원 모델)
const GEMINI_MODELS = {
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
const DEFAULT_MODEL = 'gemini-3-flash';

/**
 * 엔드포인트 URL 목록 (fallback 순서)
 * production 먼저 시도, sandbox는 백업
 */
const ENDPOINT_FALLBACKS = [
  'https://cloudcode-pa.googleapis.com',
  'https://daily-cloudcode-pa.sandbox.googleapis.com',
];

/**
 * 요청 ID 생성
 */
function generateRequestId() {
  return `agent-${crypto.randomUUID()}`;
}

/**
 * 세션 ID 생성
 */
function generateSessionId() {
  return `session-${crypto.randomUUID()}`;
}

/**
 * Antigravity 요청 본문 래핑
 */
function wrapRequestBody(body, projectId, modelId) {
  return {
    project: projectId,
    model: modelId,
    userAgent: 'antigravity',
    requestId: generateRequestId(),
    request: body,
  };
}

/**
 * Gemini API 호출 (Antigravity v1internal)
 * @param {Object} options 옵션
 * @param {string} options.model 모델 ID
 * @param {Array} options.messages 메시지 배열
 * @param {number} options.maxTokens 최대 토큰 수
 * @param {number} options.temperature 온도 (0-1)
 * @returns {Promise<Object>} 응답
 */
async function chat(options) {
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
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  // 내부 요청 본문
  const innerRequest = {
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

  // 엔드포인트 fallback 시도
  let lastError = null;
  for (const endpoint of ENDPOINT_FALLBACKS) {
    const url = `${endpoint}/${ANTIGRAVITY_API_VERSION}:generateContent`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...ANTIGRAVITY_HEADERS,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        // 404는 다음 엔드포인트 시도, 그 외는 즉시 에러
        if (response.status === 404) {
          lastError = new Error(`API not found: ${errorText}`);
          continue;
        }
        throw new Error(`Gemini API 오류 (${response.status}): ${errorText}`);
      }

      const result = await response.json();

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
      lastError = error;
      // 네트워크 에러면 다음 엔드포인트 시도
      if (error.name === 'TypeError' || error.message.includes('not found')) {
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
async function* chatStream(options) {
  // 스트리밍은 향후 필요시 구현
  const result = await chat(options);
  yield result;
}

/**
 * 사용 가능한 모델 목록 반환
 */
function getAvailableModels() {
  return Object.entries(GEMINI_MODELS).map(([key, value]) => ({
    id: key,
    ...value,
  }));
}

/**
 * 모델 정보 가져오기
 */
function getModelInfo(modelId) {
  return GEMINI_MODELS[modelId] || null;
}

/**
 * 간단한 질문-응답
 * @param {string} prompt 프롬프트
 * @param {Object} options 추가 옵션
 * @returns {Promise<string>} 응답 텍스트
 */
async function ask(prompt, options = {}) {
  const result = await chat({
    ...options,
    messages: [{ role: 'user', content: prompt }],
  });
  return result.content;
}

/**
 * 코드 탐색용 빠른 질문 (Gemini 3 Flash 사용)
 * @param {string} prompt 프롬프트
 * @returns {Promise<string>} 응답 텍스트
 */
async function quickAsk(prompt) {
  return ask(prompt, {
    model: 'gemini-3-flash',
    maxTokens: 2048,
    temperature: 0.3,
  });
}

/**
 * UI/UX 분석용 (Gemini 3 Pro 사용)
 * @param {string} prompt 프롬프트
 * @returns {Promise<string>} 응답 텍스트
 */
async function analyzeUI(prompt) {
  return ask(prompt, {
    model: 'gemini-3-pro',
    maxTokens: 4096,
    temperature: 0.5,
    systemPrompt: 'You are a UI/UX expert. Analyze the given design or component and provide detailed feedback.',
  });
}

module.exports = {
  chat,
  chatStream,
  ask,
  quickAsk,
  analyzeUI,
  getAvailableModels,
  getModelInfo,
  GEMINI_MODELS,
  DEFAULT_MODEL,
};
