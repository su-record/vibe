/**
 * save_memory / recall_memory Tools - 메모리 관리
 * Phase 3: Function Calling Tool Definitions
 *
 * 기존 src/tools/memory/ 활용
 */

import { z } from 'zod';
import type { ToolRegistrationInput } from '../ToolRegistry.js';

// === save_memory ===

export const saveMemorySchema = z.object({
  key: z.string().describe('Memory key identifier'),
  value: z.string().describe('Information to save'),
  category: z.enum(['project', 'personal', 'code', 'notes', 'general'])
    .optional()
    .describe('Memory category (default: general)'),
});

async function handleSaveMemory(args: Record<string, unknown>): Promise<string> {
  const { key, value, category } = args as z.infer<typeof saveMemorySchema>;

  try {
    const { saveMemory } = await import('../../tools/memory/index.js');
    const result = await saveMemory({ key, value, category });
    const text = result.content?.[0];
    return (text && 'text' in text ? text.text : undefined) ?? `Saved: ${key}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Save memory failed: ${msg}`;
  }
}

export const saveMemoryTool: ToolRegistrationInput = {
  name: 'save_memory',
  description: 'Save important information/decisions to persistent memory',
  schema: saveMemorySchema,
  handler: handleSaveMemory,
  scope: 'write',
};

// === recall_memory ===

export const recallMemorySchema = z.object({
  key: z.string().describe('Memory key to recall'),
  category: z.string().optional().describe('Filter by category'),
});

async function handleRecallMemory(args: Record<string, unknown>): Promise<string> {
  const { key, category } = args as z.infer<typeof recallMemorySchema>;

  try {
    const { recallMemory } = await import('../../tools/memory/index.js');
    const result = await recallMemory({ key, category });
    const text = result.content?.[0];
    return (text && 'text' in text ? text.text : undefined) ?? `Not found: ${key}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Recall memory failed: ${msg}`;
  }
}

export const recallMemoryTool: ToolRegistrationInput = {
  name: 'recall_memory',
  description: 'Recall previously saved information from memory',
  schema: recallMemorySchema,
  handler: handleRecallMemory,
  scope: 'read',
};
