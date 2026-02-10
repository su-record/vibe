/**
 * MediaPreprocessor - 미디어 메시지 전처리
 * Phase 5: Voice Flow Integration
 *
 * 기능:
 * - voice → gemini_stt 자동 호출 (텍스트 변환)
 * - image → Gemini analyzeImage로 설명 생성
 * - file → 파일 메타데이터 추출
 * - 음성 파일 20MB 크기 제한
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { ExternalMessage, FileAttachment } from '../../interface/types.js';

const MAX_VOICE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB
const FILE_TTL_MS = 24 * 60 * 60 * 1000; // 24시간
const MAX_QUOTA_BYTES = 500 * 1024 * 1024; // 500MB
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10분

export interface PreprocessResult {
  success: boolean;
  transcribedText?: string;
  error?: string;
}

export interface MediaPreprocessorConfig {
  showConfirmation?: boolean; // 음성 인식 결과 확인 메시지 표시 여부
}

/** 파일 다운로더 (Telegram downloadFile 등) */
export type FileDownloader = (fileId: string) => Promise<Buffer>;

export type SendFn = (chatId: string, text: string) => Promise<void>;

export class MediaPreprocessor {
  private config: MediaPreprocessorConfig;
  private fileDownloader?: FileDownloader;

  constructor(config?: MediaPreprocessorConfig, fileDownloader?: FileDownloader) {
    this.config = { showConfirmation: true, ...config };
    this.fileDownloader = fileDownloader;
  }

  /** 파일 다운로더 설정 (런타임에 TelegramBot.downloadFile 등 주입) */
  setFileDownloader(downloader: FileDownloader): void {
    this.fileDownloader = downloader;
  }

  async preprocess(
    message: ExternalMessage,
    sendFn: SendFn,
  ): Promise<PreprocessResult> {
    // Phase 2: FileAttachment[] based processing
    if (message.files?.length || message.location) {
      return this.handleFileAttachments(message, sendFn);
    }

    // Legacy: metadata-based processing (backward compat)
    switch (message.type) {
      case 'voice':
        return this.handleVoice(message, sendFn);
      case 'file':
        return this.handleFile(message);
      default:
        return { success: true };
    }
  }

  /** Phase 2: Process all FileAttachments + location */
  private async handleFileAttachments(
    message: ExternalMessage,
    sendFn: SendFn,
  ): Promise<PreprocessResult> {
    const descriptions: string[] = [];

    if (message.files) {
      for (const file of message.files) {
        const desc = await this.processAttachment(file, message, sendFn);
        if (desc) descriptions.push(desc);
      }
    }

    if (message.location) {
      const { latitude, longitude } = message.location;
      const mapUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
      descriptions.push(`[위치: ${latitude}, ${longitude}] ${mapUrl}`);
    }

    if (descriptions.length > 0) {
      return { success: true, transcribedText: descriptions.join('\n\n') };
    }
    return { success: true };
  }

  /** Route a single FileAttachment to its handler */
  private async processAttachment(
    file: FileAttachment,
    message: ExternalMessage,
    sendFn: SendFn,
  ): Promise<string | null> {
    switch (file.type) {
      case 'voice':
      case 'audio':
        return this.processVoiceFile(file, message, sendFn);
      case 'photo':
        return this.processPhotoFile(file);
      case 'document':
        return this.processDocumentFile(file);
      case 'video':
        return this.processVideoFile(file);
      default:
        return null;
    }
  }

  /** STT from local voice/audio file */
  private async processVoiceFile(
    file: FileAttachment,
    message: ExternalMessage,
    sendFn: SendFn,
  ): Promise<string | null> {
    if (!fs.existsSync(file.path)) return null;
    try {
      const { transcribeAudio } = await import('../../infra/lib/gemini/capabilities.js');
      const result = await transcribeAudio(file.path, { language: 'Korean' });
      const text = result.transcription?.trim();
      if (!text) return null;
      if (this.config.showConfirmation) {
        await sendFn(message.chatId, `음성 인식: "${text}"`);
      }
      return text;
    } catch {
      return `[음성 파일: ${file.name}]`;
    }
  }

  /** Vision analysis from local photo file */
  private async processPhotoFile(file: FileAttachment): Promise<string | null> {
    if (!fs.existsSync(file.path)) return `[이미지: ${file.name}]`;
    try {
      const { analyzeImage } = await import('../../infra/lib/gemini/capabilities.js');
      const description = await analyzeImage(file.path, '이 이미지를 한국어로 자세히 설명해주세요.');
      return `[이미지 설명]\n${description}`;
    } catch {
      return `[이미지: ${file.name}]`;
    }
  }

  /** Extract text from document or return metadata description */
  private async processDocumentFile(file: FileAttachment): Promise<string | null> {
    if (!fs.existsSync(file.path)) {
      return `[파일: ${file.name}]`;
    }
    const ext = path.extname(file.name).toLowerCase();
    if (['.txt', '.csv', '.json', '.md', '.log'].includes(ext)) {
      return this.extractTextFile(file);
    }
    const sizeKB = file.size ? Math.round(file.size / 1024) : 0;
    return `[파일: ${file.name}, 크기: ${sizeKB}KB, 형식: ${file.mimeType || ext}]`;
  }

  /** Read text-based files directly */
  private extractTextFile(file: FileAttachment): string {
    try {
      const content = fs.readFileSync(file.path, 'utf-8');
      const MAX_CHARS = 4000;
      const trimmed = content.length > MAX_CHARS
        ? content.slice(0, MAX_CHARS) + '\n...(잘림)'
        : content;
      return `[${file.name} 내용]\n${trimmed}`;
    } catch {
      return `[파일: ${file.name} (읽기 실패)]`;
    }
  }

  /** Video metadata description (frame extraction deferred) */
  private async processVideoFile(file: FileAttachment): Promise<string | null> {
    const sizeKB = file.size ? Math.round(file.size / 1024) : 0;
    const dur = file.duration ? `, 길이: ${file.duration}초` : '';
    return `[동영상: ${file.name}, 크기: ${sizeKB}KB${dur}]`;
  }

  private async handleVoice(
    message: ExternalMessage,
    sendFn: SendFn,
  ): Promise<PreprocessResult> {
    const fileId = message.metadata?.telegramFileId as string | undefined;
    if (!fileId) {
      return { success: false, error: '음성 파일 정보가 없습니다.' };
    }

    // Check file size
    const fileSize = message.metadata?.fileSize as number | undefined;
    if (fileSize && fileSize > MAX_VOICE_SIZE_BYTES) {
      return { success: false, error: '음성 파일이 너무 큽니다 (최대 20MB)' };
    }

    try {
      // 파일 다운로드 → 임시 저장 → STT
      const audioBuffer = await this.downloadVoiceFile(fileId);
      if (!audioBuffer) {
        return { success: false, error: '음성 파일 다운로드에 실패했습니다.' };
      }

      const mimeType = (message.metadata?.voiceMimeType as string) || 'audio/ogg';
      const ext = mimeType.includes('ogg') ? '.ogg' : '.mp3';
      const tmpDir = path.join(os.tmpdir(), 'vibe-stt');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      const tmpFile = path.join(tmpDir, `voice-${Date.now()}${ext}`);
      fs.writeFileSync(tmpFile, audioBuffer);

      try {
        const { transcribeAudio } = await import('../../infra/lib/gemini/capabilities.js');
        const result = await transcribeAudio(tmpFile, { language: 'Korean' });
        const text = result.transcription?.trim();

        if (!text) {
          return { success: false, error: '음성을 인식하지 못했습니다. 다시 시도해주세요.' };
        }

        if (this.config.showConfirmation) {
          await sendFn(message.chatId, `음성 인식: "${text}"`);
        }

        return { success: true, transcribedText: text };
      } finally {
        try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
      }
    } catch {
      return { success: false, error: '음성을 인식하지 못했습니다. 다시 시도해주세요.' };
    }
  }

  /** 파일 다운로드 (downloader가 없으면 null) */
  private async downloadVoiceFile(fileId: string): Promise<Buffer | null> {
    if (!this.fileDownloader) {
      return null;
    }
    return this.fileDownloader(fileId);
  }

  private async handleFile(message: ExternalMessage): Promise<PreprocessResult> {
    const fileName = message.content || 'unknown';
    const mimeType = (message.metadata?.fileMimeType as string) || '';

    // Image files → analyze
    if (mimeType.startsWith('image/')) {
      return this.handleImage(message, fileName, mimeType);
    }

    // Other files → metadata description
    const description = `파일 분석 요청: ${fileName} (${mimeType})`;
    return { success: true, transcribedText: description };
  }

  private async handleImage(
    message: ExternalMessage,
    fileName: string,
    mimeType: string,
  ): Promise<PreprocessResult> {
    const fileId = message.metadata?.telegramFileId as string | undefined;
    if (!fileId) {
      return { success: true, transcribedText: `이미지 분석 요청: ${fileName}` };
    }

    try {
      const { analyzeImage } = await import('../../infra/lib/gemini/capabilities.js');
      const description = await analyzeImage(fileId, '이 이미지를 한국어로 자세히 설명해주세요.');
      return { success: true, transcribedText: `[이미지 설명]\n${description}` };
    } catch {
      return { success: true, transcribedText: `이미지 분석 요청: ${fileName} (${mimeType})` };
    }
  }

  // ========================================================================
  // File Retention (Phase 2-5)
  // ========================================================================

  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /** Start periodic file cleanup (call from daemon init) */
  startFileCleanup(): void {
    this.runFileCleanup(); // 1회 즉시 실행
    this.cleanupTimer = setInterval(() => this.runFileCleanup(), CLEANUP_INTERVAL_MS);
  }

  /** Stop periodic file cleanup */
  stopFileCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /** Clean up old files (TTL 24h) and enforce 500MB quota */
  private runFileCleanup(): void {
    const baseDir = path.join(os.homedir(), '.vibe', 'files');
    if (!fs.existsSync(baseDir)) return;

    try {
      const entries = this.collectFileEntries(baseDir);
      const now = Date.now();

      // Phase 1: Delete TTL-expired files
      for (const entry of entries) {
        if (now - entry.mtimeMs > FILE_TTL_MS) {
          try { fs.rmSync(entry.dir, { recursive: true, force: true }); } catch { /* ignore */ }
        }
      }

      // Phase 2: Enforce quota (delete oldest first)
      const remaining = this.collectFileEntries(baseDir);
      let totalSize = remaining.reduce((sum, e) => sum + e.size, 0);
      const sorted = remaining.sort((a, b) => a.mtimeMs - b.mtimeMs);

      for (const entry of sorted) {
        if (totalSize <= MAX_QUOTA_BYTES) break;
        try {
          fs.rmSync(entry.dir, { recursive: true, force: true });
          totalSize -= entry.size;
        } catch { /* ignore */ }
      }
    } catch { /* ignore cleanup errors */ }
  }

  /** Collect msg_* directories with size and mtime */
  private collectFileEntries(baseDir: string): Array<{ dir: string; size: number; mtimeMs: number }> {
    const results: Array<{ dir: string; size: number; mtimeMs: number }> = [];
    try {
      this.walkMsgDirs(baseDir, results);
    } catch { /* ignore */ }
    return results;
  }

  /** Recursively find msg_* directories */
  private walkMsgDirs(
    dir: string,
    results: Array<{ dir: string; size: number; mtimeMs: number }>,
  ): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.name.startsWith('msg_')) {
        const stat = fs.statSync(fullPath);
        const size = this.dirSize(fullPath);
        results.push({ dir: fullPath, size, mtimeMs: stat.mtimeMs });
      } else {
        this.walkMsgDirs(fullPath, results);
      }
    }
  }

  /** Calculate total size of a directory */
  private dirSize(dir: string): number {
    let total = 0;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile()) {
          total += fs.statSync(fullPath).size;
        }
      }
    } catch { /* ignore */ }
    return total;
  }
}
