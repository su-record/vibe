/**
 * Gemini 확장 기능
 * - 웹 검색, UI 분석, 이미지 생성, 이미지 분석
 */

import path from 'path';
import fs from 'fs';

import {
  ANTIGRAVITY_HEADERS,
  ANTIGRAVITY_DEFAULT_PROJECT_ID,
} from '../gemini-constants.js';

import { getAuthInfo, getApiKeyFromConfig } from './auth.js';
import { chat, ask, GEMINI_MODELS, DEFAULT_MODEL } from './chat.js';
import type {
  ImageGenerationOptions,
  ImageGenerationResult,
  ImageAnalysisOptions,
  GeminiApiResponse,
  MultimodalContent,
} from './types.js';

// Antigravity API 버전
const ANTIGRAVITY_API_VERSION = 'v1internal';

/**
 * 엔드포인트 URL 목록 (fallback 순서)
 */
const ENDPOINT_FALLBACKS = [
  'https://daily-cloudcode-pa.sandbox.googleapis.com',
  'https://cloudcode-pa.googleapis.com',
];

/**
 * Antigravity 요청 본문 래핑
 */
function wrapRequestBody(body: unknown, projectId: string, modelId: string): Record<string, unknown> {
  return {
    project: projectId,
    model: modelId,
    request: body,
    requestType: 'agent',
    userAgent: 'antigravity',
    requestId: `agent-${crypto.randomUUID()}`,
  };
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
// Image Generation (Nano Banana)
// ============================================

/**
 * Gemini Image Generation (Nano Banana - gemini-2.5-flash-image)
 * API Key only (direct Google AI Studio API call for image generation)
 */
export async function generateImage(
  prompt: string,
  options: ImageGenerationOptions = {}
): Promise<ImageGenerationResult> {
  const apiKey = getApiKeyFromConfig();
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Run "vibe gemini key <key>" to configure.');
  }

  const size = options.size || '1024x1024';
  const [width, height] = size.split('x').map(Number);
  const aspectRatio = width && height ? `${width}:${height}` : '1:1';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [{
      parts: [{
        text: `Generate an image: ${prompt}

Requirements:
- High quality, detailed image
- Aspect ratio: ${aspectRatio}
- Professional and polished look`
      }]
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Gemini Image API error (${response.status})`;
    try {
      const errorJson = JSON.parse(errorText) as { error?: { message?: string } };
      if (errorJson.error?.message) {
        errorMessage = errorJson.error.message;
      }
    } catch { /* ignore */ }
    throw new Error(errorMessage);
  }

  const result = await response.json() as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          inlineData?: { mimeType: string; data: string };
        }>;
      };
    }>;
  };

  const parts = result.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.mimeType?.startsWith('image/')) {
      return {
        data: Buffer.from(part.inlineData.data, 'base64'),
        mimeType: part.inlineData.mimeType,
      };
    }
  }

  throw new Error('No image in Gemini response');
}

// ============================================
// Image Analysis (Multimodal)
// ============================================

function getImageMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
  };
  return mimeMap[ext] || 'image/png';
}

/**
 * Gemini Image Analysis (이미지 분석 - gemini-3-flash)
 */
export async function analyzeImage(
  imagePath: string,
  prompt: string,
  options: ImageAnalysisOptions = {}
): Promise<string> {
  const {
    model = 'gemini-3-flash',
    maxTokens = 4096,
    temperature = 0.3,
    systemPrompt,
  } = options;

  const absolutePath = path.resolve(imagePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Image file not found: ${absolutePath}`);
  }

  const imageData = fs.readFileSync(absolutePath);
  const base64Data = imageData.toString('base64');
  const mimeType = getImageMimeType(absolutePath);

  const contents: MultimodalContent[] = [{
    role: 'user' as const,
    parts: [
      { inlineData: { mimeType, data: base64Data } },
      { text: prompt },
    ],
  }];

  const authInfo = await getAuthInfo();
  const apiKey = getApiKeyFromConfig();

  if (authInfo.type === 'apikey' && authInfo.apiKey) {
    return analyzeImageWithApiKey(authInfo.apiKey, contents, { model, maxTokens, temperature, systemPrompt });
  }

  if (authInfo.type === 'oauth' && authInfo.accessToken) {
    try {
      return await analyzeImageWithOAuth(authInfo.accessToken, authInfo.projectId, contents, { model, maxTokens, temperature, systemPrompt });
    } catch (error) {
      const errorMsg = (error as Error).message;
      if (apiKey && (errorMsg.includes('429') || errorMsg.includes('401') || errorMsg.includes('403'))) {
        return analyzeImageWithApiKey(apiKey, contents, { model, maxTokens, temperature, systemPrompt });
      }
      throw error;
    }
  }

  throw new Error('Gemini credentials not found. Run "vibe gemini auth" or "vibe gemini key <key>".');
}

async function analyzeImageWithApiKey(
  apiKey: string,
  contents: MultimodalContent[],
  options: { model: string; maxTokens: number; temperature: number; systemPrompt?: string }
): Promise<string> {
  const apiKeyModelMap: Record<string, string> = {
    'gemini-3-pro': 'gemini-3-pro-preview',
    'gemini-3-flash': 'gemini-3-flash-preview',
  };
  const actualModel = apiKeyModelMap[options.model] || 'gemini-3-flash-preview';

  const requestBody: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: options.maxTokens,
      temperature: options.temperature,
    },
  };

  if (options.systemPrompt) {
    requestBody.systemInstruction = { parts: [{ text: options.systemPrompt }] };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const result = await response.json() as GeminiApiResponse;
  if (!result.candidates || result.candidates.length === 0) {
    throw new Error('Gemini API response is empty.');
  }

  return result.candidates[0].content?.parts?.[0]?.text || '';
}

async function analyzeImageWithOAuth(
  accessToken: string,
  projectId: string | undefined,
  contents: MultimodalContent[],
  options: { model: string; maxTokens: number; temperature: number; systemPrompt?: string }
): Promise<string> {
  const modelInfo = GEMINI_MODELS[options.model] || GEMINI_MODELS[DEFAULT_MODEL];

  const innerRequest: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: Math.min(options.maxTokens, modelInfo.maxTokens),
      temperature: options.temperature,
    },
  };

  if (options.systemPrompt) {
    innerRequest.systemInstruction = { parts: [{ text: options.systemPrompt }] };
  }

  const requestBody = wrapRequestBody(
    innerRequest,
    projectId || ANTIGRAVITY_DEFAULT_PROJECT_ID,
    modelInfo.id
  );

  let lastError: Error | null = null;
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
        if (response.status === 404) {
          lastError = new Error(`API not found: ${errorText}`);
          continue;
        }
        throw new Error(`Gemini API error (${response.status}): ${errorText}`);
      }

      const result = await response.json() as GeminiApiResponse;
      const responseData = result.response || result;
      if (!responseData.candidates || responseData.candidates.length === 0) {
        throw new Error('Gemini API response is empty.');
      }

      return responseData.candidates[0].content?.parts?.[0]?.text || '';
    } catch (error) {
      lastError = error as Error;
      if ((error as Error).name === 'TypeError' || (error as Error).message.includes('not found')) {
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('All Antigravity endpoints failed');
}
