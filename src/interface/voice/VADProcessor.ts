/**
 * VADProcessor — Voice Activity Detection (서버 사이드)
 *
 * 에너지 기반 음성 구간 감지:
 * - PCM 16kHz mono 오디오 처리
 * - 침묵 임계값 초과 시 발화 종료
 * - 최소 발화 길이 미만 발화 무시
 */

import { EventEmitter } from 'node:events';
import type { VADConfig, VADEvent, VoiceLogger } from './types.js';
import { DEFAULT_VAD_CONFIG } from './types.js';

export class VADProcessor extends EventEmitter {
  private config: VADConfig;
  private logger: VoiceLogger;
  private isSpeaking = false;
  private speechStart = 0;
  private lastSpeechTime = 0;
  private speechBuffer: Buffer[] = [];
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(logger: VoiceLogger, config?: Partial<VADConfig>) {
    super();
    this.logger = logger;
    this.config = {
      silenceThresholdMs: config?.silenceThresholdMs ?? DEFAULT_VAD_CONFIG.silenceThresholdMs,
      minSpeechMs: config?.minSpeechMs ?? DEFAULT_VAD_CONFIG.minSpeechMs,
      energyThreshold: config?.energyThreshold ?? DEFAULT_VAD_CONFIG.energyThreshold,
    };
  }

  /** PCM 16-bit 오디오 프레임 처리 */
  processFrame(pcmData: Buffer): void {
    const energy = this.calculateEnergy(pcmData);
    const now = Date.now();
    const hasSpeech = energy > this.config.energyThreshold;

    if (hasSpeech && !this.isSpeaking) {
      this.startSpeech(now, pcmData);
    } else if (hasSpeech && this.isSpeaking) {
      this.continueSpeech(now, pcmData);
    } else if (!hasSpeech && this.isSpeaking) {
      this.detectSilence(now);
      this.speechBuffer.push(pcmData);
    }
  }

  /** 세션 종료 시 정리 */
  reset(): void {
    this.isSpeaking = false;
    this.speechBuffer = [];
    this.clearSilenceTimer();
  }

  /** 현재 발화 중인지 여부 */
  get speaking(): boolean {
    return this.isSpeaking;
  }

  // ════════════════════════════════════════════════════════════
  // Private
  // ════════════════════════════════════════════════════════════

  private startSpeech(now: number, pcmData: Buffer): void {
    this.isSpeaking = true;
    this.speechStart = now;
    this.lastSpeechTime = now;
    this.speechBuffer = [pcmData];
    this.clearSilenceTimer();

    const event: VADEvent = { type: 'speech_start', timestamp: now };
    this.emit('vad', event);
    this.logger('info', 'VAD: Speech started');
  }

  private continueSpeech(now: number, pcmData: Buffer): void {
    this.lastSpeechTime = now;
    this.speechBuffer.push(pcmData);
    this.clearSilenceTimer();
  }

  private detectSilence(now: number): void {
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      this.endSpeech(now);
    }, this.config.silenceThresholdMs);
  }

  private endSpeech(now: number): void {
    const durationMs = now - this.speechStart;
    this.isSpeaking = false;

    if (durationMs < this.config.minSpeechMs) {
      this.logger('info', `VAD: Speech too short (${durationMs}ms), ignored`);
      this.speechBuffer = [];
      return;
    }

    const audioData = Buffer.concat(this.speechBuffer);
    this.speechBuffer = [];

    const event: VADEvent = {
      type: 'speech_end',
      timestamp: now,
      audioData,
      durationMs,
    };
    this.emit('vad', event);
    this.logger('info', `VAD: Speech ended (${durationMs}ms, ${audioData.length} bytes)`);
  }

  /** RMS 에너지 계산 (PCM 16-bit) */
  private calculateEnergy(pcm: Buffer): number {
    if (pcm.length < 2) return 0;
    let sum = 0;
    const sampleCount = Math.floor(pcm.length / 2);
    for (let i = 0; i < pcm.length - 1; i += 2) {
      const sample = pcm.readInt16LE(i) / 32768;
      sum += sample * sample;
    }
    return Math.sqrt(sum / sampleCount);
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }
}
