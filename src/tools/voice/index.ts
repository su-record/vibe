/**
 * Voice MCP Tools — STT/TTS/Session 도구
 *
 * - core_voice_status: 음성 세션 상태
 * - core_tts_speak: 텍스트 → 음성 변환
 * - core_stt_transcribe: 오디오 → 텍스트 변환
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ToolResult, ToolDefinition } from '../../core/types/tool.js';
import { STTProviderChain, getDefaultSTTConfigs } from '../../interface/voice/STTProvider.js';
import { TTSProviderChain, getDefaultTTSConfigs } from '../../interface/voice/TTSProvider.js';
import { VoiceSessionManager } from '../../interface/voice/VoiceSession.js';
import type { VoiceLogger } from '../../interface/voice/types.js';

// ============================================================================
// Singleton
// ============================================================================

let sttChain: STTProviderChain | null = null;
let ttsChain: TTSProviderChain | null = null;
let sessionManager: VoiceSessionManager | null = null;

function getLogger(): VoiceLogger {
  return (level, message) => {
    if (level === 'error') {
      console.error(`[voice] ${message}`);
    }
  };
}

function ensureSTT(): STTProviderChain {
  if (!sttChain) {
    sttChain = new STTProviderChain(getDefaultSTTConfigs(), getLogger());
  }
  return sttChain;
}

function ensureTTS(): TTSProviderChain {
  if (!ttsChain) {
    ttsChain = new TTSProviderChain(getDefaultTTSConfigs(), getLogger());
  }
  return ttsChain;
}

function ensureSessionManager(): VoiceSessionManager {
  if (!sessionManager) {
    sessionManager = new VoiceSessionManager(getLogger());
  }
  return sessionManager;
}

function successResult(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function errorResult(err: unknown): ToolResult {
  const msg = err instanceof Error ? err.message : String(err);
  return { content: [{ type: 'text', text: JSON.stringify({ error: msg }, null, 2) }] };
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const voiceStatusDefinition: ToolDefinition = {
  name: 'core_voice_status',
  description: 'voice status|audio status - Check voice pipeline status and active sessions',
  inputSchema: { type: 'object', properties: {} },
  annotations: {
    title: 'Voice Status',
    audience: ['user', 'assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export const ttsSpeakDefinition: ToolDefinition = {
  name: 'core_tts_speak',
  description: 'speak text|text to speech|tts - Convert text to speech audio file',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to convert to speech' },
      voice: { type: 'string', description: 'Voice name (optional)' },
      format: { type: 'string', enum: ['mp3', 'opus', 'wav'], description: 'Audio format (default: mp3)' },
    },
    required: ['text'],
  },
  annotations: {
    title: 'TTS Speak',
    audience: ['assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
};

export const sttTranscribeDefinition: ToolDefinition = {
  name: 'core_stt_transcribe',
  description: 'transcribe audio|speech to text|stt - Transcribe audio file to text',
  inputSchema: {
    type: 'object',
    properties: {
      audioPath: { type: 'string', description: 'Path to audio file' },
      language: { type: 'string', description: 'Language (default: Korean)' },
    },
    required: ['audioPath'],
  },
  annotations: {
    title: 'STT Transcribe',
    audience: ['assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};

// ============================================================================
// Tool Handlers
// ============================================================================

export async function voiceStatus(): Promise<ToolResult> {
  try {
    const stt = ensureSTT();
    const tts = ensureTTS();
    const mgr = ensureSessionManager();

    return successResult({
      stt: {
        providers: stt.getAvailableProviders(),
      },
      tts: {
        providers: tts.getAvailableProviders(),
      },
      sessions: mgr.getActiveSessions(),
    });
  } catch (err) {
    return errorResult(err);
  }
}

export async function ttsSpeak(
  args: { text: string; voice?: string; format?: string },
): Promise<ToolResult> {
  try {
    const tts = ensureTTS();
    const validFormats = ['mp3', 'opus', 'wav'] as const;
    const format = validFormats.includes(args.format as typeof validFormats[number])
      ? (args.format as typeof validFormats[number])
      : 'mp3';

    const result = await tts.synthesize(args.text, {
      voice: args.voice,
      format,
    });

    return successResult({
      success: true,
      audioPath: result.audioPath,
      format: result.format,
      provider: result.providerUsed,
      durationMs: result.durationMs,
      sizeBytes: result.sizeBytes,
    });
  } catch (err) {
    return errorResult(err);
  }
}

export async function sttTranscribe(
  args: { audioPath: string; language?: string },
): Promise<ToolResult> {
  try {
    const resolvedPath = path.resolve(args.audioPath);
    // 경로 순회 방어: 프로젝트 루트 또는 홈 디렉토리 하위만 허용
    const cwd = process.cwd();
    const home = process.env.HOME ?? process.env.USERPROFILE ?? cwd;
    if (!resolvedPath.startsWith(cwd) && !resolvedPath.startsWith(home)) {
      return errorResult({ message: '허용되지 않은 경로입니다. 프로젝트 또는 홈 디렉토리 내 파일만 접근할 수 있습니다.' });
    }

    if (!fs.existsSync(resolvedPath)) {
      return errorResult({ message: `Audio file not found: ${resolvedPath}` });
    }

    const audio = fs.readFileSync(resolvedPath);
    const mime = detectMime(resolvedPath);
    const stt = ensureSTT();
    const result = await stt.transcribe(audio, mime, args.language ?? 'Korean');

    return successResult({
      text: result.text,
      provider: result.providerUsed,
      durationMs: result.durationMs,
    });
  } catch (err) {
    return errorResult(err);
  }
}

/** 서비스 종료 */
export function shutdownVoiceService(): void {
  sessionManager?.endAll();
  sttChain = null;
  ttsChain = null;
  sessionManager = null;
}

// ============================================================================
// Utils
// ============================================================================

function detectMime(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const mimeMap: Record<string, string> = {
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    opus: 'audio/opus',
    webm: 'audio/webm',
    flac: 'audio/flac',
    m4a: 'audio/x-m4a',
    aac: 'audio/aac',
  };
  return mimeMap[ext] ?? 'audio/wav';
}
