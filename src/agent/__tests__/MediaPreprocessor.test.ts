/**
 * MediaPreprocessor & Voice Flow 테스트
 * Phase 5: Scenarios 1, 3, 4, 5, 6
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MediaPreprocessor, type SendFn } from '../preprocessors/MediaPreprocessor.js';
import type { ExternalMessage } from '../../interface/types.js';
import type { Mock } from 'vitest';

// Mock Gemini capabilities
vi.mock('../../lib/gemini/capabilities.js', () => ({
  transcribeAudio: vi.fn(),
  analyzeImage: vi.fn(),
}));

import { transcribeAudio, analyzeImage } from '../../core/lib/gemini/capabilities.js';
const mockTranscribe = vi.mocked(transcribeAudio);
const mockAnalyzeImage = vi.mocked(analyzeImage);

function createMessage(overrides: Partial<ExternalMessage>): ExternalMessage {
  return {
    id: 'msg-1',
    channel: 'telegram',
    chatId: 'chat-1',
    userId: 'user-1',
    content: '',
    type: 'text',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('MediaPreprocessor', () => {
  let preprocessor: MediaPreprocessor;
  let sendFn: Mock<SendFn>;

  beforeEach(() => {
    vi.clearAllMocks();
    preprocessor = new MediaPreprocessor({ showConfirmation: true });
    sendFn = vi.fn<SendFn>().mockResolvedValue(undefined);
  });

  // Scenario 1: 음성 → 텍스트 자동 변환
  describe('Scenario 1: Voice auto-transcription', () => {
    it('should transcribe voice message to text', async () => {
      mockTranscribe.mockResolvedValue({
        transcription: '오늘 날씨 알려줘',
        model: 'gemini-3-flash',
      });

      const message = createMessage({
        type: 'voice',
        metadata: { telegramFileId: 'file-123' },
      });

      const result = await preprocessor.preprocess(message, sendFn);

      expect(result.success).toBe(true);
      expect(result.transcribedText).toBe('오늘 날씨 알려줘');
    });
  });

  // Scenario 3: 음성 인식 결과 확인
  describe('Scenario 3: Voice confirmation message', () => {
    it('should send confirmation when enabled', async () => {
      mockTranscribe.mockResolvedValue({
        transcription: '테스트 메시지',
        model: 'gemini-3-flash',
      });

      const message = createMessage({
        type: 'voice',
        metadata: { telegramFileId: 'file-123' },
      });

      await preprocessor.preprocess(message, sendFn);

      expect(sendFn).toHaveBeenCalledWith(
        'chat-1',
        expect.stringContaining('음성 인식: "테스트 메시지"'),
      );
    });

    it('should skip confirmation when disabled', async () => {
      const quietPreprocessor = new MediaPreprocessor({ showConfirmation: false });
      mockTranscribe.mockResolvedValue({
        transcription: '테스트',
        model: 'gemini-3-flash',
      });

      const message = createMessage({
        type: 'voice',
        metadata: { telegramFileId: 'file-123' },
      });

      await quietPreprocessor.preprocess(message, sendFn);
      expect(sendFn).not.toHaveBeenCalled();
    });
  });

  // Scenario 4: STT 실패 처리
  describe('Scenario 4: STT failure', () => {
    it('should return error on STT failure', async () => {
      mockTranscribe.mockRejectedValue(new Error('API error'));

      const message = createMessage({
        type: 'voice',
        metadata: { telegramFileId: 'file-123' },
      });

      const result = await preprocessor.preprocess(message, sendFn);

      expect(result.success).toBe(false);
      expect(result.error).toContain('인식하지 못했습니다');
    });

    it('should return error on empty transcription', async () => {
      mockTranscribe.mockResolvedValue({
        transcription: '',
        model: 'gemini-3-flash',
      });

      const message = createMessage({
        type: 'voice',
        metadata: { telegramFileId: 'file-123' },
      });

      const result = await preprocessor.preprocess(message, sendFn);
      expect(result.success).toBe(false);
    });

    it('should return error when no file ID', async () => {
      const message = createMessage({ type: 'voice' });
      const result = await preprocessor.preprocess(message, sendFn);
      expect(result.success).toBe(false);
    });
  });

  // Scenario 5: 이미지 메시지 처리
  describe('Scenario 5: Image processing', () => {
    it('should analyze image and return description', async () => {
      mockAnalyzeImage.mockResolvedValue('사진에는 고양이가 있습니다.');

      const message = createMessage({
        type: 'file',
        content: 'photo.jpg',
        metadata: { telegramFileId: 'img-123', fileMimeType: 'image/jpeg' },
      });

      const result = await preprocessor.preprocess(message, sendFn);

      expect(result.success).toBe(true);
      expect(result.transcribedText).toContain('이미지 설명');
      expect(result.transcribedText).toContain('고양이');
    });
  });

  // Scenario 6: 음성 파일 크기 제한
  describe('Scenario 6: Voice file size limit', () => {
    it('should reject files over 20MB', async () => {
      const message = createMessage({
        type: 'voice',
        metadata: {
          telegramFileId: 'file-123',
          fileSize: 25 * 1024 * 1024, // 25MB
        },
      });

      const result = await preprocessor.preprocess(message, sendFn);

      expect(result.success).toBe(false);
      expect(result.error).toContain('너무 큽니다');
    });

    it('should accept files under 20MB', async () => {
      mockTranscribe.mockResolvedValue({
        transcription: 'OK',
        model: 'gemini-3-flash',
      });

      const message = createMessage({
        type: 'voice',
        metadata: {
          telegramFileId: 'file-123',
          fileSize: 10 * 1024 * 1024, // 10MB
        },
      });

      const result = await preprocessor.preprocess(message, sendFn);
      expect(result.success).toBe(true);
    });
  });

  describe('Non-media messages', () => {
    it('should pass through text messages', async () => {
      const message = createMessage({ type: 'text', content: 'hello' });
      const result = await preprocessor.preprocess(message, sendFn);
      expect(result.success).toBe(true);
      expect(result.transcribedText).toBeUndefined();
    });
  });
});
