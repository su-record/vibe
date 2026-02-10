/**
 * STT Multi-Provider — 음성 → 텍스트 변환
 *
 * Provider 체인: Gemini → Whisper → Deepgram
 * 자동 fallback: 실패 시 다음 프로바이더.
 * Circuit Breaker: 연속 실패 3회 → 10초 대기.
 */

import type {
  ISTTProvider,
  STTResult,
  STTProviderName,
  STTProviderConfig,
  VoiceLogger,
} from './types.js';
import { createVoiceError } from './types.js';

const DEFAULT_STT_TIMEOUT = 10_000;

// ============================================================================
// Gemini STT Provider
// ============================================================================

export class GeminiSTTProvider implements ISTTProvider {
  readonly name: STTProviderName = 'gemini';
  private apiKey: string;
  private timeoutMs: number;

  constructor(config: STTProviderConfig) {
    this.apiKey = config.apiKey ?? process.env.GEMINI_API_KEY ?? '';
    this.timeoutMs = config.timeoutMs ?? DEFAULT_STT_TIMEOUT;
  }

  isAvailable(): boolean {
    return this.apiKey.length > 0;
  }

  async transcribe(audio: Buffer, mime: string, language?: string): Promise<STTResult> {
    const start = Date.now();
    const model = 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: `Transcribe the following audio to text. Language: ${language ?? 'Korean'}. Return only the transcribed text.` },
              { inlineData: { mimeType: mime, data: audio.toString('base64') } },
            ],
          }],
          generationConfig: { temperature: 0.1 },
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Gemini STT HTTP ${res.status}: ${await res.text()}`);
      }

      const data = (await res.json()) as GeminiResponse;
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      return {
        text: text.trim(),
        providerUsed: 'gemini',
        durationMs: Date.now() - start,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

interface GeminiResponse {
  candidates?: Array<{
    content: { parts: Array<{ text?: string }> };
  }>;
}

// ============================================================================
// OpenAI Whisper STT Provider
// ============================================================================

export class WhisperSTTProvider implements ISTTProvider {
  readonly name: STTProviderName = 'whisper';
  private apiKey: string;
  private timeoutMs: number;

  constructor(config: STTProviderConfig) {
    this.apiKey = config.apiKey ?? process.env.OPENAI_API_KEY ?? '';
    this.timeoutMs = config.timeoutMs ?? DEFAULT_STT_TIMEOUT;
  }

  isAvailable(): boolean {
    return this.apiKey.length > 0;
  }

  async transcribe(audio: Buffer, mime: string, language?: string): Promise<STTResult> {
    const start = Date.now();
    const ext = mimeToExt(mime);
    const arrayBuf = audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength) as ArrayBuffer;
    const blob = new Blob([arrayBuf], { type: mime });

    const formData = new FormData();
    formData.append('file', blob, `audio.${ext}`);
    formData.append('model', 'whisper-1');
    if (language) formData.append('language', language === 'Korean' ? 'ko' : language);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Whisper HTTP ${res.status}: ${await res.text()}`);
      }

      const data = (await res.json()) as { text: string };
      return {
        text: data.text.trim(),
        providerUsed: 'whisper',
        durationMs: Date.now() - start,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

// ============================================================================
// Deepgram STT Provider
// ============================================================================

export class DeepgramSTTProvider implements ISTTProvider {
  readonly name: STTProviderName = 'deepgram';
  private apiKey: string;
  private timeoutMs: number;

  constructor(config: STTProviderConfig) {
    this.apiKey = config.apiKey ?? process.env.DEEPGRAM_API_KEY ?? '';
    this.timeoutMs = config.timeoutMs ?? DEFAULT_STT_TIMEOUT;
  }

  isAvailable(): boolean {
    return this.apiKey.length > 0;
  }

  async transcribe(audio: Buffer, mime: string, language?: string): Promise<STTResult> {
    const start = Date.now();
    const lang = language === 'Korean' ? 'ko' : (language ?? 'ko');
    const url = `https://api.deepgram.com/v1/listen?model=nova-3&language=${lang}&smart_format=true`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Token ${this.apiKey}`,
          'Content-Type': mime,
        },
        body: audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength) as ArrayBuffer,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Deepgram HTTP ${res.status}: ${await res.text()}`);
      }

      const data = (await res.json()) as DeepgramResponse;
      const text = data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';

      return {
        text: text.trim(),
        providerUsed: 'deepgram',
        durationMs: Date.now() - start,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

interface DeepgramResponse {
  results?: {
    channels?: Array<{
      alternatives?: Array<{ transcript?: string; confidence?: number }>;
    }>;
  };
}

// ============================================================================
// STT Provider Chain (with fallback)
// ============================================================================

export class STTProviderChain {
  private providers: ISTTProvider[];
  private logger: VoiceLogger;
  private failures = new Map<string, number>();
  private circuitOpenUntil = new Map<string, number>();

  constructor(configs: STTProviderConfig[], logger: VoiceLogger) {
    this.logger = logger;
    this.providers = configs
      .filter(c => c.enabled)
      .map(c => this.createProvider(c));
  }

  async transcribe(audio: Buffer, mime: string, language?: string): Promise<STTResult> {
    const errors: Array<{ provider: string; error: string }> = [];

    for (const provider of this.providers) {
      if (!provider.isAvailable()) continue;
      if (this.isCircuitOpen(provider.name)) continue;

      try {
        const result = await provider.transcribe(audio, mime, language);
        this.resetFailures(provider.name);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ provider: provider.name, error: msg });
        this.recordFailure(provider.name);
        this.logger('warn', `STT ${provider.name} failed: ${msg}`);
      }
    }

    throw createVoiceError('ALL_PROVIDERS_FAILED',
      '모든 STT 프로바이더가 실패했습니다. 텍스트 입력을 사용해주세요.',
      errors);
  }

  getAvailableProviders(): STTProviderName[] {
    return this.providers
      .filter(p => p.isAvailable() && !this.isCircuitOpen(p.name))
      .map(p => p.name);
  }

  private createProvider(config: STTProviderConfig): ISTTProvider {
    switch (config.name) {
      case 'gemini': return new GeminiSTTProvider(config);
      case 'whisper': return new WhisperSTTProvider(config);
      case 'deepgram': return new DeepgramSTTProvider(config);
    }
  }

  private recordFailure(name: string): void {
    const count = (this.failures.get(name) ?? 0) + 1;
    this.failures.set(name, count);
    if (count >= 3) {
      this.circuitOpenUntil.set(name, Date.now() + 10_000);
      this.failures.set(name, 0);
      this.logger('warn', `STT ${name} circuit breaker open for 10s`);
    }
  }

  private resetFailures(name: string): void {
    this.failures.delete(name);
    this.circuitOpenUntil.delete(name);
  }

  private isCircuitOpen(name: string): boolean {
    const until = this.circuitOpenUntil.get(name);
    if (!until) return false;
    if (Date.now() >= until) {
      this.circuitOpenUntil.delete(name);
      return false;
    }
    return true;
  }
}

// ============================================================================
// Utils
// ============================================================================

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/mp3': 'mp3',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
    'audio/flac': 'flac',
    'audio/aac': 'aac',
    'audio/x-m4a': 'm4a',
  };
  return map[mime] ?? 'wav';
}

/** 기본 STT 설정 생성 */
export function getDefaultSTTConfigs(): STTProviderConfig[] {
  return [
    { name: 'gemini', enabled: true, timeoutMs: DEFAULT_STT_TIMEOUT },
    { name: 'whisper', enabled: true, timeoutMs: DEFAULT_STT_TIMEOUT },
    { name: 'deepgram', enabled: true, timeoutMs: DEFAULT_STT_TIMEOUT },
  ];
}
