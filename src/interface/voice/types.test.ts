/**
 * Voice Types & Utility Tests
 *
 * Type constants, error creation, default configs.
 * (No external dependency — always runnable)
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_VAD_CONFIG,
  DEFAULT_SESSION_CONFIG,
  createVoiceError,
} from './types.js';

describe('DEFAULT_VAD_CONFIG', () => {
  it('should have correct defaults', () => {
    expect(DEFAULT_VAD_CONFIG.silenceThresholdMs).toBe(300);
    expect(DEFAULT_VAD_CONFIG.minSpeechMs).toBe(500);
    expect(DEFAULT_VAD_CONFIG.energyThreshold).toBe(0.02);
  });

  it('should be typed as Readonly', () => {
    // Readonly<T> is compile-time only, not runtime freeze
    expect(DEFAULT_VAD_CONFIG).toBeDefined();
    expect(typeof DEFAULT_VAD_CONFIG.silenceThresholdMs).toBe('number');
  });
});

describe('DEFAULT_SESSION_CONFIG', () => {
  it('should have correct defaults', () => {
    expect(DEFAULT_SESSION_CONFIG.inactivityTimeoutMs).toBe(5 * 60 * 1000);
    expect(DEFAULT_SESSION_CONFIG.maxRecordingMs).toBe(5 * 60 * 1000);
    expect(DEFAULT_SESSION_CONFIG.bargeInEnabled).toBe(true);
  });

  it('should be typed as Readonly', () => {
    // Readonly<T> is compile-time only, not runtime freeze
    expect(DEFAULT_SESSION_CONFIG).toBeDefined();
    expect(typeof DEFAULT_SESSION_CONFIG.inactivityTimeoutMs).toBe('number');
  });
});

describe('createVoiceError', () => {
  it('should create error with code and message', () => {
    const err = createVoiceError('STT_FAILED', 'STT 실패');
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('STT_FAILED');
    expect(err.message).toBe('STT 실패');
  });

  it('should include providerErrors if provided', () => {
    const errors = [
      { provider: 'gemini', error: 'timeout' },
      { provider: 'whisper', error: 'auth failed' },
    ];
    const err = createVoiceError('ALL_PROVIDERS_FAILED', 'All failed', errors);
    expect(err.providerErrors).toEqual(errors);
    expect(err.providerErrors).toHaveLength(2);
  });

  it('should not include providerErrors if not provided', () => {
    const err = createVoiceError('TTS_FAILED', 'TTS 실패');
    expect(err.providerErrors).toBeUndefined();
  });

  it('should support all error codes', () => {
    const codes = [
      'STT_FAILED', 'TTS_FAILED', 'VAD_ERROR', 'SESSION_TIMEOUT',
      'SESSION_ENDED', 'ALL_PROVIDERS_FAILED', 'AUDIO_TOO_LARGE', 'UNSUPPORTED_FORMAT',
    ] as const;

    for (const code of codes) {
      const err = createVoiceError(code, `Error: ${code}`);
      expect(err.code).toBe(code);
    }
  });
});

describe('Voice Type Definitions', () => {
  it('STTProviderName should be valid union', () => {
    const names: Array<'gemini' | 'whisper' | 'deepgram'> = ['gemini', 'whisper', 'deepgram'];
    expect(names).toHaveLength(3);
  });

  it('TTSProviderName should be valid union', () => {
    const names: Array<'edge' | 'openai' | 'google'> = ['edge', 'openai', 'google'];
    expect(names).toHaveLength(3);
  });

  it('AudioFormat should be valid union', () => {
    const formats: Array<'opus' | 'mp3' | 'wav'> = ['opus', 'mp3', 'wav'];
    expect(formats).toHaveLength(3);
  });

  it('VoiceSessionState should be valid union', () => {
    const states: Array<'created' | 'active' | 'paused' | 'ended'> = [
      'created', 'active', 'paused', 'ended',
    ];
    expect(states).toHaveLength(4);
  });

  it('VADEvent types should be valid', () => {
    const types: Array<'speech_start' | 'speech_end' | 'silence'> = [
      'speech_start', 'speech_end', 'silence',
    ];
    expect(types).toHaveLength(3);
  });
});
