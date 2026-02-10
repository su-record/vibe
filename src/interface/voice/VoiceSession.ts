/**
 * VoiceSession — 음성 대화 세션 관리
 *
 * 세션 생명주기: created → active → paused → ended
 * Barge-in: TTS 재생 중 사용자 발화 시 중단.
 * 타임아웃: 비활성 5분 → 자동 종료.
 */

import * as crypto from 'node:crypto';
import type {
  VoiceSessionState,
  VoiceSessionConfig,
  VoiceSessionInfo,
  VoiceLogger,
  STTResult,
  TTSResult,
  VADEvent,
} from './types.js';
import { DEFAULT_SESSION_CONFIG, createVoiceError } from './types.js';
import type { STTProviderChain } from './STTProvider.js';
import type { TTSProviderChain } from './TTSProvider.js';
import { VADProcessor } from './VADProcessor.js';

/** 세션에서 발생하는 이벤트 */
export interface VoiceSessionEvents {
  transcript: (result: STTResult) => void;
  ttsStart: () => void;
  ttsComplete: (result: TTSResult) => void;
  bargeIn: () => void;
  ended: (reason: string) => void;
}

export class VoiceSession {
  readonly sessionId: string;
  private state: VoiceSessionState = 'created';
  private userId: string;
  private channel: string;
  private config: VoiceSessionConfig;
  private logger: VoiceLogger;
  private stt: STTProviderChain;
  private tts: TTSProviderChain;
  private vad: VADProcessor;
  private createdAt: string;
  private lastActivityAt: string;
  private utteranceCount = 0;
  private inactivityTimer: ReturnType<typeof setTimeout> | null = null;
  private isTTSPlaying = false;
  private listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  constructor(
    userId: string,
    channel: string,
    stt: STTProviderChain,
    tts: TTSProviderChain,
    logger: VoiceLogger,
    config?: Partial<VoiceSessionConfig>,
  ) {
    this.sessionId = crypto.randomUUID();
    this.userId = userId;
    this.channel = channel;
    this.stt = stt;
    this.tts = tts;
    this.logger = logger;
    this.createdAt = new Date().toISOString();
    this.lastActivityAt = this.createdAt;
    this.config = {
      inactivityTimeoutMs: config?.inactivityTimeoutMs ?? DEFAULT_SESSION_CONFIG.inactivityTimeoutMs,
      maxRecordingMs: config?.maxRecordingMs ?? DEFAULT_SESSION_CONFIG.maxRecordingMs,
      bargeInEnabled: config?.bargeInEnabled ?? DEFAULT_SESSION_CONFIG.bargeInEnabled,
    };

    this.vad = new VADProcessor(logger);
    this.vad.on('vad', (event) => this.handleVADEvent(event));
  }

  /** 세션 시작 */
  start(): void {
    if (this.state !== 'created') return;
    this.state = 'active';
    this.resetInactivityTimer();
    this.logger('info', `Voice session started: ${this.sessionId}`);
  }

  /** 세션 일시정지 */
  pause(): void {
    if (this.state !== 'active') return;
    this.state = 'paused';
    this.clearInactivityTimer();
  }

  /** 세션 재개 */
  resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'active';
    this.resetInactivityTimer();
  }

  /** 세션 종료 */
  end(reason: string = 'user_ended'): void {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.clearInactivityTimer();
    this.vad.reset();
    this.emit('ended', reason);
    this.logger('info', `Voice session ended: ${reason}`);
  }

  /** 오디오 프레임 수신 (PCM 16-bit) */
  processAudioFrame(pcmData: Buffer): void {
    if (this.state !== 'active') return;
    this.touchActivity();

    // Barge-in: TTS 재생 중 사용자 발화 감지
    if (this.isTTSPlaying && this.config.bargeInEnabled) {
      this.isTTSPlaying = false;
      this.emit('bargeIn');
      this.logger('info', 'Barge-in: TTS interrupted');
    }

    this.vad.processFrame(pcmData);
  }

  /** 오디오 버퍼에서 STT 수행 */
  async transcribeAudio(audio: Buffer, mime: string): Promise<STTResult> {
    if (this.state !== 'active') {
      throw createVoiceError('SESSION_ENDED', '음성 세션이 종료되었습니다.');
    }
    this.touchActivity();
    this.utteranceCount++;

    const result = await this.stt.transcribe(audio, mime);
    this.emit('transcript', result);
    return result;
  }

  /** 텍스트 → TTS 음성 생성 */
  async speak(text: string): Promise<TTSResult | null> {
    if (this.state !== 'active') return null;
    this.touchActivity();

    this.isTTSPlaying = true;
    this.emit('ttsStart');

    try {
      const result = await this.tts.synthesize(text);
      this.isTTSPlaying = false;
      this.emit('ttsComplete', result);
      return result;
    } catch (err) {
      this.isTTSPlaying = false;
      this.logger('warn', `TTS failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  /** 세션 정보 */
  getInfo(): VoiceSessionInfo {
    return {
      sessionId: this.sessionId,
      state: this.state,
      userId: this.userId,
      channel: this.channel,
      createdAt: this.createdAt,
      lastActivityAt: this.lastActivityAt,
      utteranceCount: this.utteranceCount,
    };
  }

  /** 현재 상태 */
  getState(): VoiceSessionState {
    return this.state;
  }

  /** 이벤트 리스너 등록 */
  on<K extends keyof VoiceSessionEvents>(event: K, listener: VoiceSessionEvents[K]): void {
    const list = this.listeners.get(event) ?? [];
    list.push(listener as (...args: unknown[]) => void);
    this.listeners.set(event, list);
  }

  /** 이벤트 리스너 해제 */
  off<K extends keyof VoiceSessionEvents>(event: K, listener: VoiceSessionEvents[K]): void {
    const list = this.listeners.get(event);
    if (!list) return;
    const idx = list.indexOf(listener as (...args: unknown[]) => void);
    if (idx !== -1) list.splice(idx, 1);
  }

  // ════════════════════════════════════════════════════════════
  // Private
  // ════════════════════════════════════════════════════════════

  private emit(event: string, ...args: unknown[]): void {
    const list = this.listeners.get(event);
    if (list) {
      for (const fn of list) fn(...args);
    }
  }

  private handleVADEvent(event: VADEvent): void {
    if (event.type === 'speech_end' && event.audioData && this.state === 'active') {
      this.transcribeAudio(event.audioData, 'audio/wav').catch(err => {
        this.logger('error', `Auto-transcribe failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    }
  }

  private touchActivity(): void {
    this.lastActivityAt = new Date().toISOString();
    this.resetInactivityTimer();
  }

  private resetInactivityTimer(): void {
    this.clearInactivityTimer();
    this.inactivityTimer = setTimeout(() => {
      this.end('inactivity_timeout');
    }, this.config.inactivityTimeoutMs);
    if (this.inactivityTimer.unref) {
      this.inactivityTimer.unref();
    }
  }

  private clearInactivityTimer(): void {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
  }
}

// ============================================================================
// Session Manager (동시 세션 제한)
// ============================================================================

export class VoiceSessionManager {
  private sessions = new Map<string, VoiceSession>();
  private userSessions = new Map<string, string>();
  private logger: VoiceLogger;

  constructor(logger: VoiceLogger) {
    this.logger = logger;
  }

  /** 새 세션 생성 (사용자당 1개 제한) */
  createSession(
    userId: string,
    channel: string,
    stt: STTProviderChain,
    tts: TTSProviderChain,
    config?: Partial<VoiceSessionConfig>,
  ): VoiceSession {
    const existing = this.userSessions.get(userId);
    if (existing) {
      const session = this.sessions.get(existing);
      if (session && session.getState() !== 'ended') {
        session.end('new_session_started');
      }
      this.cleanup(existing);
    }

    const session = new VoiceSession(userId, channel, stt, tts, this.logger, config);
    this.sessions.set(session.sessionId, session);
    this.userSessions.set(userId, session.sessionId);

    session.on('ended', () => {
      this.cleanup(session.sessionId);
    });

    return session;
  }

  getSession(sessionId: string): VoiceSession | undefined {
    return this.sessions.get(sessionId);
  }

  getUserSession(userId: string): VoiceSession | undefined {
    const id = this.userSessions.get(userId);
    return id ? this.sessions.get(id) : undefined;
  }

  getActiveSessions(): VoiceSessionInfo[] {
    return Array.from(this.sessions.values())
      .filter(s => s.getState() !== 'ended')
      .map(s => s.getInfo());
  }

  endAll(): void {
    for (const session of this.sessions.values()) {
      if (session.getState() !== 'ended') {
        session.end('shutdown');
      }
    }
    this.sessions.clear();
    this.userSessions.clear();
  }

  private cleanup(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      for (const [userId, sid] of this.userSessions) {
        if (sid === sessionId) {
          this.userSessions.delete(userId);
          break;
        }
      }
      this.sessions.delete(sessionId);
    }
  }
}
