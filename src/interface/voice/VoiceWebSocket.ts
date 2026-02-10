/**
 * VoiceWebSocket — WebSocket 음성 스트리밍 프로토콜
 *
 * 클라이언트 → 서버: binary PCM 오디오 + JSON 제어
 * 서버 → 클라이언트: JSON 상태 + binary TTS 오디오
 * Protocol: sessionId + seq (단조 증가) + timestamp 헤더
 */

import type { ClientMessage, ServerMessage, VoiceLogger } from './types.js';
import type { VoiceSessionManager } from './VoiceSession.js';

/** Minimal WebSocket interface (avoids 'ws' dependency at type level) */
interface WSLike {
  on(event: 'message', listener: (data: Buffer | string) => void): void;
  on(event: 'close', listener: () => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
  send(data: string | Buffer): void;
  close(): void;
}

const MAX_AUDIO_FRAME_SIZE = 16 * 1024; // 16KB

export class VoiceWebSocketHandler {
  private logger: VoiceLogger;
  private sessionManager: VoiceSessionManager;
  private connections = new Map<string, WSLike>();
  private seqCounters = new Map<string, number>();

  constructor(sessionManager: VoiceSessionManager, logger: VoiceLogger) {
    this.sessionManager = sessionManager;
    this.logger = logger;
  }

  /** WebSocket 연결 핸들링 */
  handleConnection(ws: WSLike, userId: string): void {
    this.connections.set(userId, ws);
    this.seqCounters.set(userId, 0);

    ws.on('message', (data: Buffer | string) => {
      try {
        this.handleMessage(ws, userId, data);
      } catch (err) {
        this.sendError(ws, 'PROTOCOL_ERROR',
          `메시지 처리 실패: ${err instanceof Error ? err.message : String(err)}`);
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(userId);
    });

    ws.on('error', (err: Error) => {
      this.logger('error', `WebSocket error for ${userId}: ${err.message}`);
      this.handleDisconnect(userId);
    });
  }

  /** 클라이언트 메시지 처리 */
  private handleMessage(ws: WSLike, userId: string, data: Buffer | string): void {
    // Binary frame = 오디오 데이터
    if (Buffer.isBuffer(data)) {
      this.handleAudioFrame(userId, data);
      return;
    }

    // JSON frame = 제어 메시지
    let msg: ClientMessage;
    try {
      const parsed: unknown = JSON.parse(String(data));
      if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
        this.sendError(ws, 'PROTOCOL_ERROR', '유효하지 않은 메시지 형식입니다.');
        return;
      }
      msg = parsed as ClientMessage;
    } catch {
      this.sendError(ws, 'PROTOCOL_ERROR', 'JSON 파싱에 실패했습니다.');
      return;
    }
    switch (msg.type) {
      case 'audio_start':
        this.handleAudioStart(ws, userId, msg);
        break;
      case 'audio_end':
        this.handleAudioEnd(ws, userId);
        break;
      case 'ping':
        this.sendJSON(ws, { type: 'pong', timestamp: msg.timestamp });
        break;
    }
  }

  private handleAudioStart(
    ws: WSLike,
    userId: string,
    msg: ClientMessage & { type: 'audio_start' },
  ): void {
    this.logger('info', `Audio start: user=${userId}, rate=${msg.sampleRate}`);
    // 세션 확인/생성은 외부에서 처리
  }

  private handleAudioFrame(userId: string, data: Buffer): void {
    if (data.length > MAX_AUDIO_FRAME_SIZE) {
      const ws = this.connections.get(userId);
      if (ws) {
        this.sendError(ws, 'FRAME_TOO_LARGE', `오디오 프레임 크기 초과: ${data.length} > ${MAX_AUDIO_FRAME_SIZE}`);
      }
      return;
    }

    const session = this.sessionManager.getUserSession(userId);
    if (session) {
      session.processAudioFrame(data);
    }
  }

  private handleAudioEnd(ws: WSLike, userId: string): void {
    this.logger('info', `Audio end: user=${userId}`);
    // VAD가 자동으로 speech_end를 발생시킴
  }

  private handleDisconnect(userId: string): void {
    this.connections.delete(userId);
    this.seqCounters.delete(userId);
    const session = this.sessionManager.getUserSession(userId);
    if (session) {
      session.end('disconnected');
    }
    this.logger('info', `WebSocket disconnected: ${userId}`);
  }

  /** 서버 → 클라이언트: 전사 결과 */
  sendTranscript(userId: string, text: string, sessionId: string): void {
    const ws = this.connections.get(userId);
    if (!ws) return;
    const seq = this.nextSeq(userId);
    this.sendJSON(ws, { type: 'transcript', text, sessionId, seq });
  }

  /** 서버 → 클라이언트: TTS 시작 */
  sendResponseStart(userId: string, sessionId: string): void {
    const ws = this.connections.get(userId);
    if (!ws) return;
    const seq = this.nextSeq(userId);
    this.sendJSON(ws, { type: 'response_start', sessionId, seq });
  }

  /** 서버 → 클라이언트: TTS 텍스트 */
  sendResponseText(userId: string, text: string, sessionId: string): void {
    const ws = this.connections.get(userId);
    if (!ws) return;
    const seq = this.nextSeq(userId);
    this.sendJSON(ws, { type: 'response_text', text, sessionId, seq });
  }

  /** 서버 → 클라이언트: TTS 오디오 (binary) */
  sendAudioChunk(userId: string, audioData: Buffer): void {
    const ws = this.connections.get(userId);
    if (!ws) return;
    ws.send(audioData);
  }

  /** 서버 → 클라이언트: TTS 종료 */
  sendResponseEnd(userId: string, sessionId: string): void {
    const ws = this.connections.get(userId);
    if (!ws) return;
    const seq = this.nextSeq(userId);
    this.sendJSON(ws, { type: 'response_end', sessionId, seq });
  }

  /** 연결 상태 확인 */
  isConnected(userId: string): boolean {
    return this.connections.has(userId);
  }

  /** 모든 연결 종료 */
  closeAll(): void {
    for (const [userId, ws] of this.connections) {
      ws.close();
    }
    this.connections.clear();
    this.seqCounters.clear();
  }

  // ════════════════════════════════════════════════════════════

  private sendJSON(ws: WSLike, msg: ServerMessage): void {
    ws.send(JSON.stringify(msg));
  }

  private sendError(ws: WSLike, code: string, message: string): void {
    this.sendJSON(ws, { type: 'error', code, message });
  }

  private nextSeq(userId: string): number {
    const seq = (this.seqCounters.get(userId) ?? 0) + 1;
    this.seqCounters.set(userId, seq);
    return seq;
  }
}
