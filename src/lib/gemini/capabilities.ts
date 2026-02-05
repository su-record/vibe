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
  AudioTranscriptionOptions,
  AudioTranscriptionResult,
  AudioMimeType,
  GeminiApiResponse,
  GeminiAuthMethod,
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

// 이미지 생성 모델 매핑
const IMAGE_MODELS = {
  'nano-banana': 'gemini-2.5-flash-image',
  'nano-banana-pro': 'gemini-3-pro-image-preview',
} as const;

/**
 * Gemini Image Generation (API Key only - Google AI Studio)
 * default: gemini-2.5-flash-image (Nano Banana)
 * option: gemini-3-pro-image-preview (Nano Banana Pro)
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

  const imageModel = IMAGE_MODELS[options.model || 'nano-banana'];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent?key=${apiKey}`;

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

  if ((authInfo.type === 'oauth' || authInfo.type === 'gemini-cli') && authInfo.accessToken) {
    try {
      return await analyzeImageWithOAuth(authInfo.accessToken, authInfo.projectId, contents, { model, maxTokens, temperature, systemPrompt }, authInfo.type);
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
  const modelInfo = GEMINI_MODELS[options.model] || GEMINI_MODELS[DEFAULT_MODEL];
  const actualModel = modelInfo.id;

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
  options: { model: string; maxTokens: number; temperature: number; systemPrompt?: string },
  authType: GeminiAuthMethod = 'oauth'
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
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };
      if (authType === 'oauth') {
        Object.assign(headers, ANTIGRAVITY_HEADERS);
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
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

// ============================================
// Audio Transcription
// ============================================

function getAudioMimeType(filePath: string): AudioMimeType {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, AudioMimeType> = {
    '.wav': 'audio/wav',
    '.mp3': 'audio/mp3',
    '.mpeg': 'audio/mpeg',
    '.aiff': 'audio/aiff',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac',
    '.webm': 'audio/webm',
  };
  return mimeMap[ext] || 'audio/wav';
}

/**
 * Gemini Audio Transcription (음성 인식)
 * 오디오 파일을 텍스트로 변환 (gemini-3-flash 기본)
 */
export async function transcribeAudio(
  audioPath: string,
  options: AudioTranscriptionOptions = {}
): Promise<AudioTranscriptionResult> {
  const {
    model = 'gemini-3-flash',
    maxTokens = 4096,
    temperature = 0.1,
    language,
    systemPrompt,
  } = options;

  const absolutePath = path.resolve(audioPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Audio file not found: ${absolutePath}`);
  }

  const audioData = fs.readFileSync(absolutePath);
  const base64Data = audioData.toString('base64');
  const mimeType = getAudioMimeType(absolutePath);

  // WAV 파일 기준 대략적 재생 시간 계산 (16kHz, 16-bit, mono)
  const stats = fs.statSync(absolutePath);
  const WAV_HEADER_SIZE = 44;
  const BYTES_PER_SECOND = 16000 * 2 * 1;
  const estimatedDuration = Math.max(0, (stats.size - WAV_HEADER_SIZE) / BYTES_PER_SECOND);

  let transcriptionPrompt = 'Transcribe this audio accurately. Output ONLY the transcribed text, nothing else. No explanations, no formatting, no quotation marks.';
  if (language) {
    transcriptionPrompt += ` The audio is in ${language}. Transcribe in the original language.`;
  }

  const contents: MultimodalContent[] = [{
    role: 'user' as const,
    parts: [
      { inlineData: { mimeType, data: base64Data } },
      { text: transcriptionPrompt },
    ],
  }];

  const authInfo = await getAuthInfo();
  const apiKey = getApiKeyFromConfig();

  const callOptions = {
    model,
    maxTokens,
    temperature,
    systemPrompt: systemPrompt || 'You are a precise audio transcription system. Output only the exact words spoken. No commentary.',
  };

  let transcription: string;

  if (authInfo.type === 'apikey' && authInfo.apiKey) {
    transcription = await analyzeImageWithApiKey(authInfo.apiKey, contents, callOptions);
  } else if ((authInfo.type === 'oauth' || authInfo.type === 'gemini-cli') && authInfo.accessToken) {
    try {
      transcription = await analyzeImageWithOAuth(
        authInfo.accessToken,
        authInfo.projectId,
        contents,
        callOptions,
        authInfo.type
      );
    } catch (error) {
      const errorMsg = (error as Error).message;
      if (apiKey && (errorMsg.includes('429') || errorMsg.includes('401') || errorMsg.includes('403'))) {
        transcription = await analyzeImageWithApiKey(apiKey, contents, callOptions);
      } else {
        throw error;
      }
    }
  } else {
    throw new Error('Gemini credentials not found. Run "vibe gemini auth" or "vibe gemini key <key>".');
  }

  return {
    transcription: transcription.trim(),
    model,
    duration: Math.round(estimatedDuration * 10) / 10,
  };
}
