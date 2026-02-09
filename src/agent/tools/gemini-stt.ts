/**
 * gemini_stt Tool - 음성 → 텍스트 변환
 * Phase 3: Function Calling Tool Definitions
 *
 * Gemini transcribeAudio() 활용
 */

import type { ToolDefinition } from '../types.js';
import type { JsonSchema } from '../types.js';

const geminiSttParameters: JsonSchema = {
  type: 'object',
  properties: {
    audioFileId: { type: 'string', description: 'Telegram audio file ID' },
  },
  required: ['audioFileId'],
};

async function handleGeminiStt(args: Record<string, unknown>): Promise<string> {
  const { audioFileId } = args as { audioFileId: string };

  try {
    const { transcribeAudio } = await import('../../lib/gemini/capabilities.js');
    const result = await transcribeAudio(audioFileId, { language: 'Korean' });
    return result.transcription || '(transcription empty)';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `STT failed: ${msg}`;
  }
}

export const geminiSttTool: ToolDefinition = {
  name: 'gemini_stt',
  description: 'Transcribe voice audio to text using Gemini STT',
  parameters: geminiSttParameters,
  handler: handleGeminiStt,
  scope: 'execute',
};
