/**
 * gemini_stt Tool - 음성 → 텍스트 변환
 * Phase 3: Function Calling Tool Definitions
 *
 * Gemini transcribeAudio() 활용
 */

import { z } from 'zod';
import type { ToolRegistrationInput } from '../ToolRegistry.js';

export const geminiSttSchema = z.object({
  audioFileId: z.string().describe('Telegram audio file ID'),
});

async function handleGeminiStt(args: Record<string, unknown>): Promise<string> {
  const { audioFileId } = args as z.infer<typeof geminiSttSchema>;

  try {
    const { transcribeAudio } = await import('../../lib/gemini/capabilities.js');
    const result = await transcribeAudio(audioFileId, { language: 'Korean' });
    return result.transcription || '(transcription empty)';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `STT failed: ${msg}`;
  }
}

export const geminiSttTool: ToolRegistrationInput = {
  name: 'gemini_stt',
  description: 'Transcribe voice audio to text using Gemini STT',
  schema: geminiSttSchema,
  handler: handleGeminiStt,
  scope: 'execute',
};
