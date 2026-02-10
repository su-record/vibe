/**
 * TTS Multi-Provider — 텍스트 → 음성 변환
 *
 * Provider 체인: Edge TTS (무료) → OpenAI TTS → Google Cloud TTS
 * 긴 텍스트 자동 청킹, 스트리밍 지원.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import type {
  ITTSProvider,
  TTSResult,
  TTSProviderName,
  TTSProviderConfig,
  TTSSynthesizeOptions,
  AudioFormat,
  VoiceLogger,
} from './types.js';
import { createVoiceError } from './types.js';

const DEFAULT_TTS_TIMEOUT = 8_000;

/** node-edge-tts dynamic import shape */
interface EdgeTTSInstance {
  synthesize(text: string, voice: string, opts?: { rate?: string }): Promise<void>;
  toBuffer(): Buffer;
}
const TTS_TEMP_DIR = path.join(os.tmpdir(), 'vibe-tts');

// ============================================================================
// Edge TTS Provider (무료, API 키 불필요)
// ============================================================================

export class EdgeTTSProvider implements ITTSProvider {
  readonly name: TTSProviderName = 'edge';
  private timeoutMs: number;
  private voice: string;

  constructor(config: TTSProviderConfig) {
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TTS_TIMEOUT;
    this.voice = config.voice ?? 'ko-KR-SunHiNeural';
  }

  isAvailable(): boolean {
    return true;
  }

  async synthesize(text: string, options?: TTSSynthesizeOptions): Promise<TTSResult> {
    const start = Date.now();
    const voice = options?.voice ?? this.voice;
    const format = options?.format ?? 'mp3';
    const outPath = getTempPath(format);

    try {
      const edgeTts = await (import('node-edge-tts' as string) as Promise<{ default: new () => EdgeTTSInstance }>);
      const tts = new edgeTts.default();
      await tts.synthesize(text, voice, { rate: formatRate(options?.speed) });
      const audioBuffer: Buffer = tts.toBuffer();
      fs.writeFileSync(outPath, audioBuffer);

      return {
        audioPath: outPath,
        format,
        providerUsed: 'edge',
        durationMs: Date.now() - start,
        sizeBytes: audioBuffer.length,
      };
    } catch (err) {
      throw new Error(`Edge TTS failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

// ============================================================================
// OpenAI TTS Provider
// ============================================================================

export class OpenAITTSProvider implements ITTSProvider {
  readonly name: TTSProviderName = 'openai';
  private apiKey: string;
  private timeoutMs: number;

  constructor(config: TTSProviderConfig) {
    this.apiKey = config.apiKey ?? process.env.OPENAI_API_KEY ?? '';
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TTS_TIMEOUT;
  }

  isAvailable(): boolean {
    return this.apiKey.length > 0;
  }

  async synthesize(text: string, options?: TTSSynthesizeOptions): Promise<TTSResult> {
    const start = Date.now();
    const format = options?.format ?? 'mp3';
    const outPath = getTempPath(format);
    const responseFormat = format === 'opus' ? 'opus' : format === 'wav' ? 'wav' : 'mp3';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: options?.voice ?? 'nova',
          response_format: responseFormat,
          speed: options?.speed ?? 1.0,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`OpenAI TTS HTTP ${res.status}: ${await res.text()}`);
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(outPath, buffer);

      return {
        audioPath: outPath,
        format,
        providerUsed: 'openai',
        durationMs: Date.now() - start,
        sizeBytes: buffer.length,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

// ============================================================================
// Google Cloud TTS Provider
// ============================================================================

export class GoogleTTSProvider implements ITTSProvider {
  readonly name: TTSProviderName = 'google';
  private apiKey: string;
  private timeoutMs: number;

  constructor(config: TTSProviderConfig) {
    this.apiKey = config.apiKey ?? process.env.GOOGLE_TTS_API_KEY ?? '';
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TTS_TIMEOUT;
  }

  isAvailable(): boolean {
    return this.apiKey.length > 0;
  }

  async synthesize(text: string, options?: TTSSynthesizeOptions): Promise<TTSResult> {
    const start = Date.now();
    const format = options?.format ?? 'mp3';
    const outPath = getTempPath(format);
    const audioEncoding = format === 'opus' ? 'OGG_OPUS' : format === 'wav' ? 'LINEAR16' : 'MP3';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text },
            voice: {
              languageCode: options?.language ?? 'ko-KR',
              name: options?.voice ?? 'ko-KR-Neural2-A',
            },
            audioConfig: {
              audioEncoding,
              speakingRate: options?.speed ?? 1.0,
            },
          }),
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Google TTS HTTP ${res.status}: ${await res.text()}`);
      }

      const data = (await res.json()) as { audioContent: string };
      const buffer = Buffer.from(data.audioContent, 'base64');
      fs.writeFileSync(outPath, buffer);

      return {
        audioPath: outPath,
        format,
        providerUsed: 'google',
        durationMs: Date.now() - start,
        sizeBytes: buffer.length,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

// ============================================================================
// TTS Provider Chain (with fallback + text chunking)
// ============================================================================

export class TTSProviderChain {
  private providers: ITTSProvider[];
  private logger: VoiceLogger;

  constructor(configs: TTSProviderConfig[], logger: VoiceLogger) {
    this.logger = logger;
    this.providers = configs
      .filter(c => c.enabled)
      .map(c => this.createProvider(c));
  }

  async synthesize(text: string, options?: TTSSynthesizeOptions): Promise<TTSResult> {
    const errors: Array<{ provider: string; error: string }> = [];

    for (const provider of this.providers) {
      if (!provider.isAvailable()) continue;

      try {
        const result = await provider.synthesize(text, options);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push({ provider: provider.name, error: msg });
        this.logger('warn', `TTS ${provider.name} failed: ${msg}`);
      }
    }

    throw createVoiceError('ALL_PROVIDERS_FAILED',
      '모든 TTS 프로바이더가 실패했습니다. 텍스트 응답으로 대체합니다.',
      errors);
  }

  getAvailableProviders(): TTSProviderName[] {
    return this.providers.filter(p => p.isAvailable()).map(p => p.name);
  }

  private createProvider(config: TTSProviderConfig): ITTSProvider {
    switch (config.name) {
      case 'edge': return new EdgeTTSProvider(config);
      case 'openai': return new OpenAITTSProvider(config);
      case 'google': return new GoogleTTSProvider(config);
    }
  }
}

// ============================================================================
// Text Chunking (문장 단위 분할)
// ============================================================================

/** 긴 텍스트를 문장 단위로 분할 (TTS 최대 길이 제한) */
export function chunkText(text: string, maxChars: number = 4096): string[] {
  if (text.length <= maxChars) return [text];

  const sentences = text.split(/(?<=[.!?。！？\n])\s*/);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (current.length + sentence.length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += (current ? ' ' : '') + sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks;
}

// ============================================================================
// Utils
// ============================================================================

function getTempPath(format: AudioFormat): string {
  if (!fs.existsSync(TTS_TEMP_DIR)) {
    fs.mkdirSync(TTS_TEMP_DIR, { recursive: true });
  }
  return path.join(TTS_TEMP_DIR, `tts-${crypto.randomBytes(8).toString('hex')}.${format}`);
}

function formatRate(speed?: number): string {
  if (!speed || speed === 1.0) return '+0%';
  const pct = Math.round((speed - 1) * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}

/** 기본 TTS 설정 생성 */
export function getDefaultTTSConfigs(): TTSProviderConfig[] {
  return [
    { name: 'edge', enabled: true, timeoutMs: DEFAULT_TTS_TIMEOUT, voice: 'ko-KR-SunHiNeural' },
    { name: 'openai', enabled: true, timeoutMs: DEFAULT_TTS_TIMEOUT },
    { name: 'google', enabled: true, timeoutMs: DEFAULT_TTS_TIMEOUT },
  ];
}
