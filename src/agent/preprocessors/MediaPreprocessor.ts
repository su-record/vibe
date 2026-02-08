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

import type { ExternalMessage } from '../../interface/types.js';

const MAX_VOICE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export interface PreprocessResult {
  success: boolean;
  transcribedText?: string;
  error?: string;
}

export interface MediaPreprocessorConfig {
  showConfirmation?: boolean; // 음성 인식 결과 확인 메시지 표시 여부
}

export type SendFn = (chatId: string, text: string) => Promise<void>;

export class MediaPreprocessor {
  private config: MediaPreprocessorConfig;

  constructor(config?: MediaPreprocessorConfig) {
    this.config = { showConfirmation: true, ...config };
  }

  async preprocess(
    message: ExternalMessage,
    sendFn: SendFn,
  ): Promise<PreprocessResult> {
    switch (message.type) {
      case 'voice':
        return this.handleVoice(message, sendFn);
      case 'file':
        return this.handleFile(message);
      default:
        return { success: true };
    }
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
      const { transcribeAudio } = await import('../../lib/gemini/capabilities.js');
      const result = await transcribeAudio(fileId, { language: 'Korean' });
      const text = result.transcription?.trim();

      if (!text) {
        return { success: false, error: '음성을 인식하지 못했습니다. 다시 시도해주세요.' };
      }

      // Send confirmation
      if (this.config.showConfirmation) {
        await sendFn(message.chatId, `🎙️ 음성 인식: "${text}"`);
      }

      return { success: true, transcribedText: text };
    } catch {
      return { success: false, error: '음성을 인식하지 못했습니다. 다시 시도해주세요.' };
    }
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
      const { analyzeImage } = await import('../../lib/gemini/capabilities.js');
      const description = await analyzeImage(fileId, '이 이미지를 한국어로 자세히 설명해주세요.');
      return { success: true, transcribedText: `[이미지 설명]\n${description}` };
    } catch {
      return { success: true, transcribedText: `이미지 분석 요청: ${fileName} (${mimeType})` };
    }
  }
}
