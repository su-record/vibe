/**
 * Gemini / Antigravity 확장 기능
 *
 * - 웹 검색, UI 분석, 이미지 생성, 이미지 분석, 오디오 전사
 * - Endpoint: Production 우선 (Pro 계정 429 방지)
 */

import path from 'path';
import fs from 'fs';

import { getAuthInfo, getApiKeyFromConfig } from './auth.js';
import { ask, getGeminiModels, DEFAULT_MODEL } from './chat.js';
import {
  ENDPOINT_FALLBACKS,
  API_VERSION,
  ANTIGRAVITY_HEADERS,
} from './constants.js';
import type {
  ImageGenerationOptions,
  ImageGenerationResult,
  ImageAnalysisOptions,
  AudioTranscriptionOptions,
  AudioTranscriptionResult,
  AudioMimeType,
  GeminiApiResponse,
  MultimodalContent,
  V1InternalRequest,
} from './types.js';

// =============================================
// v1internal 요청 래핑
// =============================================

function wrapRequest(
  body: unknown,
  projectId: string,
  modelId: string,
): V1InternalRequest {
  return {
    project: projectId,
    model: modelId,
    request: body,
  };
}

// =============================================
// 웹 검색
// =============================================

/**
 * 웹서치로 최신 정보 검색 (Gemini Pro + Google Search)
 */
export async function webSearch(prompt: string): Promise<string> {
  return ask(prompt, {
    model: 'gemini-pro',
    maxTokens: 4096,
    temperature: 0.3,
    webSearch: true,
    systemPrompt: 'Search the web for the latest information and provide accurate answers. Always include today\'s date and time context when relevant.',
  });
}

/**
 * 빠른 웹서치 (Gemini Flash + Google Search)
 */
export async function quickWebSearch(prompt: string): Promise<string> {
  return ask(prompt, {
    model: 'gemini-flash',
    maxTokens: 2048,
    temperature: 0.3,
    webSearch: true,
  });
}

// =============================================
// UI 분석
// =============================================

/**
 * UI/UX 분석용 (Gemini Pro)
 */
export async function analyzeUI(prompt: string): Promise<string> {
  return ask(prompt, {
    model: 'gemini-pro',
    maxTokens: 4096,
    temperature: 0.5,
    systemPrompt: 'You are a UI/UX expert. Analyze the given design or component and provide detailed feedback.',
  });
}

// =============================================
// 이미지 생성
// =============================================

const IMAGE_MODELS = {
  'nano-banana': 'gemini-2.5-flash-image',
  'nano-banana-pro': 'gemini-3-pro-image-preview',
} as const;

/**
 * Gemini Image Generation (API Key only)
 */
export async function generateImage(
  prompt: string,
  options: ImageGenerationOptions = {},
): Promise<ImageGenerationResult> {
  const apiKey = getApiKeyFromConfig();
  if (!apiKey) {
    throw new Error('Gemini API key required for image generation. Run "vibe gemini key <key>".');
  }

  const size = options.size || '1024x1024';
  const [width, height] = size.split('x').map(Number);
  const aspectRatio = width && height ? `${width}:${height}` : '1:1';

  const imageModel = IMAGE_MODELS[options.model || 'nano-banana'];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [{
      parts: [{
        text: `Generate an image: ${prompt}\n\nRequirements:\n- High quality, detailed image\n- Aspect ratio: ${aspectRatio}\n- Professional and polished look`,
      }],
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
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
      if (errorJson.error?.message) errorMessage = errorJson.error.message;
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

// =============================================
// 이미지 분석 (Multimodal)
// =============================================

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

async function analyzeImageWithApiKey(
  apiKey: string,
  contents: MultimodalContent[],
  options: { model: string; maxTokens: number; temperature: number; systemPrompt?: string },
): Promise<string> {
  const modelInfo = getGeminiModels()[options.model] || getGeminiModels()[DEFAULT_MODEL];
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
): Promise<string> {
  const modelInfo = getGeminiModels()[options.model] || getGeminiModels()[DEFAULT_MODEL];
  const effectiveModelId = modelInfo.oauthId || modelInfo.id;

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

  const requestBody = wrapRequest(innerRequest, projectId || '', effectiveModelId);

  let lastError: Error | null = null;

  for (const endpoint of ENDPOINT_FALLBACKS) {
    const url = `${endpoint}/${API_VERSION}:generateContent`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...ANTIGRAVITY_HEADERS,
    };

    try {
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
      const msg = (error as Error).message || '';
      if ((error as Error).name === 'TypeError' || msg.includes('not found')) {
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('All endpoints failed');
}

/**
 * Gemini 이미지 분석 (Multimodal)
 */
export async function analyzeImage(
  imagePath: string,
  prompt: string,
  options: ImageAnalysisOptions = {},
): Promise<string> {
  const {
    model = 'gemini-flash',
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
  const callOptions = { model, maxTokens, temperature, systemPrompt };

  if (authInfo.type === 'apikey' && authInfo.apiKey) {
    return analyzeImageWithApiKey(authInfo.apiKey, contents, callOptions);
  }

  if (authInfo.accessToken) {
    try {
      return await analyzeImageWithOAuth(authInfo.accessToken, authInfo.projectId, contents, callOptions);
    } catch (error) {
      const errorMsg = (error as Error).message;
      if (apiKey && (errorMsg.includes('429') || errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('404'))) {
        return analyzeImageWithApiKey(apiKey, contents, callOptions);
      }
      throw error;
    }
  }

  throw new Error('Gemini credentials not found.');
}

// =============================================
// 오디오 전사 (STT)
// =============================================

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
 * Gemini 오디오 전사 (STT)
 */
export async function transcribeAudio(
  audioPath: string,
  options: AudioTranscriptionOptions = {},
): Promise<AudioTranscriptionResult> {
  const {
    model = 'gemini-flash',
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

  const stats = fs.statSync(absolutePath);
  const WAV_HEADER_SIZE = 44;
  const BYTES_PER_SECOND = 16000 * 2 * 1;
  const estimatedDuration = Math.max(0, (stats.size - WAV_HEADER_SIZE) / BYTES_PER_SECOND);

  let transcriptionPrompt = 'Transcribe this audio accurately. Output ONLY the transcribed text, nothing else.';
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
    systemPrompt: systemPrompt || 'You are a precise audio transcription system. Output only the exact words spoken.',
  };

  let transcription: string;

  if (authInfo.type === 'apikey' && authInfo.apiKey) {
    transcription = await analyzeImageWithApiKey(authInfo.apiKey, contents, callOptions);
  } else if (authInfo.accessToken) {
    try {
      transcription = await analyzeImageWithOAuth(
        authInfo.accessToken, authInfo.projectId, contents, callOptions,
      );
    } catch (error) {
      const errorMsg = (error as Error).message;
      if (apiKey && (errorMsg.includes('429') || errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('404'))) {
        transcription = await analyzeImageWithApiKey(apiKey, contents, callOptions);
      } else {
        throw error;
      }
    }
  } else {
    throw new Error('Gemini credentials not found.');
  }

  return {
    transcription: transcription.trim(),
    model,
    duration: Math.round(estimatedDuration * 10) / 10,
  };
}
