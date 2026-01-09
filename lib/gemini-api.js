/**
 * Gemini API 호출 (Antigravity 경유)
 * Gemini 구독으로 Gemini 3 Flash/Pro 모델 사용
 */

const {
  ANTIGRAVITY_ENDPOINTS,
  ANTIGRAVITY_HEADERS,
  ANTIGRAVITY_DEFAULT_PROJECT_ID,
} = require('./gemini-constants');

const { getValidAccessToken } = require('./gemini-oauth');

// 사용 가능한 모델 목록
const GEMINI_MODELS = {
  // Gemini 3 Flash (빠름, 저비용) - 탐색/검색에 적합
  'gemini-3-flash': {
    id: 'gemini-3.0-flash',
    name: 'Gemini 3 Flash',
    description: '빠른 응답, 탐색/검색에 최적화',
    maxTokens: 8192,
    endpoint: 'daily', // daily sandbox가 더 안정적
  },
  // Gemini 3 Pro (정확도) - 복잡한 작업에 적합
  'gemini-3-pro': {
    id: 'gemini-3.0-pro',
    name: 'Gemini 3 Pro',
    description: '높은 정확도, 복잡한 작업에 최적화',
    maxTokens: 8192,
    endpoint: 'daily',
  },
  // 이전 버전 호환
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash-preview-05-20',
    name: 'Gemini 2.5 Flash',
    description: '이전 버전 Flash 모델',
    maxTokens: 8192,
    endpoint: 'prod',
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro-preview-05-06',
    name: 'Gemini 2.5 Pro',
    description: '이전 버전 Pro 모델',
    maxTokens: 8192,
    endpoint: 'prod',
  },
};

// 기본 모델
const DEFAULT_MODEL = 'gemini-3-flash';

/**
 * 엔드포인트 URL 가져오기
 * @param {string} endpointType 'daily', 'autopush', 'prod'
 * @returns {string} 엔드포인트 URL
 */
function getEndpointUrl(endpointType = 'daily') {
  const endpointMap = {
    'daily': ANTIGRAVITY_ENDPOINTS[0],
    'autopush': ANTIGRAVITY_ENDPOINTS[1],
    'prod': ANTIGRAVITY_ENDPOINTS[2],
  };
  return endpointMap[endpointType] || ANTIGRAVITY_ENDPOINTS[0];
}

/**
 * Gemini API 호출
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
  const endpoint = getEndpointUrl(modelInfo.endpoint);

  // 메시지를 Gemini 형식으로 변환
  const contents = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  // 요청 본문
  const requestBody = {
    contents,
    generationConfig: {
      maxOutputTokens: Math.min(maxTokens, modelInfo.maxTokens),
      temperature,
    },
  };

  // 시스템 프롬프트가 있으면 추가
  if (systemPrompt) {
    requestBody.systemInstruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  // API 호출
  const url = `${endpoint}/v1/projects/${projectId || ANTIGRAVITY_DEFAULT_PROJECT_ID}/locations/us-central1/publishers/google/models/${modelInfo.id}:generateContent`;

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
    throw new Error(`Gemini API 오류 (${response.status}): ${errorText}`);
  }

  const result = await response.json();

  // 응답 파싱
  if (!result.candidates || result.candidates.length === 0) {
    throw new Error('Gemini API 응답이 비어있습니다.');
  }

  const candidate = result.candidates[0];
  const content = candidate.content?.parts?.[0]?.text || '';

  return {
    content,
    model: modelInfo.name,
    finishReason: candidate.finishReason,
    usage: result.usageMetadata,
  };
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
