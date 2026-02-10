/**
 * VoiceSession & VoiceSessionManager Tests
 *
 * Session lifecycle, barge-in, inactivity timeout.
 * Uses mocked STT/TTS provider chains.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VoiceSession, VoiceSessionManager } from './VoiceSession.js';
import type { STTProviderChain } from './STTProvider.js';
import type { TTSProviderChain } from './TTSProvider.js';
import type { VoiceLogger, STTResult, TTSResult } from './types.js';

function createLogger(): VoiceLogger {
  return vi.fn();
}

function createMockSTT(): STTProviderChain {
  return {
    transcribe: vi.fn().mockResolvedValue({
      text: '안녕하세요',
      providerUsed: 'gemini',
      durationMs: 100,
    } satisfies STTResult),
    getAvailableProviders: vi.fn().mockReturnValue(['gemini']),
  } as unknown as STTProviderChain;
}

function createMockTTS(): TTSProviderChain {
  return {
    synthesize: vi.fn().mockResolvedValue({
      audioPath: '/tmp/tts-test.mp3',
      format: 'mp3',
      providerUsed: 'edge',
      durationMs: 200,
      sizeBytes: 1024,
    } satisfies TTSResult),
    getAvailableProviders: vi.fn().mockReturnValue(['edge']),
  } as unknown as TTSProviderChain;
}

describe('VoiceSession', () => {
  let session: VoiceSession;
  let logger: VoiceLogger;
  let stt: STTProviderChain;
  let tts: TTSProviderChain;

  beforeEach(() => {
    vi.useFakeTimers();
    logger = createLogger();
    stt = createMockSTT();
    tts = createMockTTS();
    session = new VoiceSession('user-1', 'web', stt, tts, logger);
  });

  afterEach(() => {
    session.end('test_cleanup');
    vi.useRealTimers();
  });

  describe('lifecycle', () => {
    it('should start in created state', () => {
      expect(session.getState()).toBe('created');
    });

    it('should transition to active on start', () => {
      session.start();
      expect(session.getState()).toBe('active');
    });

    it('should transition to paused', () => {
      session.start();
      session.pause();
      expect(session.getState()).toBe('paused');
    });

    it('should resume from paused', () => {
      session.start();
      session.pause();
      session.resume();
      expect(session.getState()).toBe('active');
    });

    it('should transition to ended', () => {
      session.start();
      session.end('test');
      expect(session.getState()).toBe('ended');
    });

    it('should not start if already active', () => {
      session.start();
      session.start(); // no-op
      expect(session.getState()).toBe('active');
    });

    it('should not pause if not active', () => {
      session.pause(); // no-op (in created state)
      expect(session.getState()).toBe('created');
    });

    it('should not resume if not paused', () => {
      session.start();
      session.resume(); // no-op (already active)
      expect(session.getState()).toBe('active');
    });

    it('should not end twice', () => {
      session.start();
      const endedEvents: string[] = [];
      session.on('ended', (reason) => endedEvents.push(reason as string));

      session.end('first');
      session.end('second');

      expect(endedEvents).toHaveLength(1);
      expect(endedEvents[0]).toBe('first');
    });
  });

  describe('session info', () => {
    it('should return correct info', () => {
      session.start();
      const info = session.getInfo();

      expect(info.sessionId).toBeDefined();
      expect(info.state).toBe('active');
      expect(info.userId).toBe('user-1');
      expect(info.channel).toBe('web');
      expect(info.createdAt).toBeDefined();
      expect(info.lastActivityAt).toBeDefined();
      expect(info.utteranceCount).toBe(0);
    });

    it('should have valid UUID sessionId', () => {
      const info = session.getInfo();
      expect(info.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });
  });

  describe('transcription', () => {
    it('should transcribe audio', async () => {
      session.start();
      const result = await session.transcribeAudio(Buffer.alloc(100), 'audio/wav');

      expect(result.text).toBe('안녕하세요');
      expect(result.providerUsed).toBe('gemini');
      expect(session.getInfo().utteranceCount).toBe(1);
    });

    it('should emit transcript event', async () => {
      session.start();
      const transcripts: STTResult[] = [];
      session.on('transcript', (r) => transcripts.push(r));

      await session.transcribeAudio(Buffer.alloc(100), 'audio/wav');

      expect(transcripts).toHaveLength(1);
    });

    it('should reject transcription if session ended', async () => {
      session.start();
      session.end('test');

      await expect(
        session.transcribeAudio(Buffer.alloc(100), 'audio/wav'),
      ).rejects.toThrow('음성 세션이 종료되었습니다.');
    });
  });

  describe('TTS', () => {
    it('should speak text', async () => {
      session.start();
      const result = await session.speak('테스트 음성');

      expect(result).not.toBeNull();
      expect(result!.providerUsed).toBe('edge');
    });

    it('should emit ttsStart and ttsComplete events', async () => {
      session.start();
      const starts: number[] = [];
      const completes: TTSResult[] = [];

      session.on('ttsStart', () => starts.push(Date.now()));
      session.on('ttsComplete', (r) => completes.push(r));

      await session.speak('테스트');

      expect(starts).toHaveLength(1);
      expect(completes).toHaveLength(1);
    });

    it('should return null if session not active', async () => {
      const result = await session.speak('테스트');
      expect(result).toBeNull();
    });

    it('should handle TTS failure gracefully', async () => {
      session.start();
      (tts.synthesize as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('TTS error'));

      const result = await session.speak('테스트');
      expect(result).toBeNull();
    });
  });

  describe('audio frame processing', () => {
    it('should not process frames if not active', () => {
      session.processAudioFrame(Buffer.alloc(640));
      // No error thrown
    });

    it('should process frames when active', () => {
      session.start();
      session.processAudioFrame(Buffer.alloc(640));
      // No error thrown
    });
  });

  describe('inactivity timeout', () => {
    it('should end session after inactivity', () => {
      const shortSession = new VoiceSession(
        'user-2', 'web', stt, tts, logger,
        { inactivityTimeoutMs: 1000 },
      );
      shortSession.start();

      const endedReasons: string[] = [];
      shortSession.on('ended', (r) => endedReasons.push(r as string));

      vi.advanceTimersByTime(1100);

      expect(shortSession.getState()).toBe('ended');
      expect(endedReasons).toContain('inactivity_timeout');
    });

    it('should reset timer on activity', () => {
      const shortSession = new VoiceSession(
        'user-3', 'web', stt, tts, logger,
        { inactivityTimeoutMs: 1000 },
      );
      shortSession.start();

      vi.advanceTimersByTime(800);
      shortSession.processAudioFrame(Buffer.alloc(640)); // reset timer

      vi.advanceTimersByTime(800);
      expect(shortSession.getState()).toBe('active'); // still active

      vi.advanceTimersByTime(300);
      expect(shortSession.getState()).toBe('ended'); // now timed out

      shortSession.end('test_cleanup');
    });
  });
});

describe('VoiceSessionManager', () => {
  let manager: VoiceSessionManager;
  let logger: VoiceLogger;
  let stt: STTProviderChain;
  let tts: TTSProviderChain;

  beforeEach(() => {
    vi.useFakeTimers();
    logger = createLogger();
    stt = createMockSTT();
    tts = createMockTTS();
    manager = new VoiceSessionManager(logger);
  });

  afterEach(() => {
    manager.endAll();
    vi.useRealTimers();
  });

  it('should create a new session', () => {
    const session = manager.createSession('user-1', 'web', stt, tts);
    expect(session).toBeDefined();
    expect(session.getState()).toBe('created');
  });

  it('should get session by ID', () => {
    const session = manager.createSession('user-1', 'web', stt, tts);
    const found = manager.getSession(session.sessionId);
    expect(found).toBe(session);
  });

  it('should get session by userId', () => {
    const session = manager.createSession('user-1', 'web', stt, tts);
    const found = manager.getUserSession('user-1');
    expect(found).toBe(session);
  });

  it('should return undefined for unknown session', () => {
    expect(manager.getSession('nonexistent')).toBeUndefined();
    expect(manager.getUserSession('unknown-user')).toBeUndefined();
  });

  it('should enforce single session per user', () => {
    const session1 = manager.createSession('user-1', 'web', stt, tts);
    session1.start();

    const session2 = manager.createSession('user-1', 'web', stt, tts);

    expect(session1.getState()).toBe('ended');
    expect(session2).toBeDefined();
    expect(session2.getState()).toBe('created');
  });

  it('should list active sessions', () => {
    const s1 = manager.createSession('user-1', 'web', stt, tts);
    s1.start();
    const s2 = manager.createSession('user-2', 'telegram', stt, tts);
    s2.start();

    const active = manager.getActiveSessions();
    expect(active).toHaveLength(2);
  });

  it('should end all sessions', () => {
    const s1 = manager.createSession('user-1', 'web', stt, tts);
    s1.start();
    const s2 = manager.createSession('user-2', 'telegram', stt, tts);
    s2.start();

    manager.endAll();

    expect(s1.getState()).toBe('ended');
    expect(s2.getState()).toBe('ended');
    expect(manager.getActiveSessions()).toHaveLength(0);
  });
});
