/**
 * save_memory / recall_memory Tools - 메모리 관리
 * Phase 3: Function Calling Tool Definitions
 *
 * 기존 src/tools/memory/ 활용
 */

import type { ToolDefinition, JsonSchema } from '../types.js';

// === save_memory ===

const saveMemoryParameters: JsonSchema = {
  type: 'object',
  properties: {
    key: { type: 'string', description: 'Memory key identifier' },
    value: { type: 'string', description: 'Information to save' },
    category: {
      type: 'string',
      enum: ['project', 'personal', 'code', 'notes', 'general'],
      description: 'Memory category (default: general)',
    },
  },
  required: ['key', 'value'],
};

async function handleSaveMemory(args: Record<string, unknown>): Promise<string> {
  const { key, value, category } = args as {
    key: string;
    value: string;
    category?: 'project' | 'personal' | 'code' | 'notes' | 'general';
  };

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

export const saveMemoryTool: ToolDefinition = {
  name: 'save_memory',
  description: 'Save important information/decisions to persistent memory',
  parameters: saveMemoryParameters,
  handler: handleSaveMemory,
  scope: 'write',
};

// === recall_memory ===

const recallMemoryParameters: JsonSchema = {
  type: 'object',
  properties: {
    key: { type: 'string', description: 'Memory key to recall' },
    category: { type: 'string', description: 'Filter by category' },
  },
  required: ['key'],
};

async function handleRecallMemory(args: Record<string, unknown>): Promise<string> {
  const { key, category } = args as { key: string; category?: string };

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

export const recallMemoryTool: ToolDefinition = {
  name: 'recall_memory',
  description: 'Recall previously saved information from memory',
  parameters: recallMemoryParameters,
  handler: handleRecallMemory,
  scope: 'read',
};
