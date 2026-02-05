/**
 * Kimi/Moonshot API 상수
 */

export const KIMI_BASE_URL = process.env.KIMI_BASE_URL || 'https://api.moonshot.ai/v1';
export const KIMI_CN_URL = 'https://api.moonshot.cn/v1';

export interface KimiModelMeta {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  maxTokens: number;
  cost: number;
}

export const KIMI_MODELS: Record<string, KimiModelMeta> = {
  'kimi-k2.5': {
    id: 'kimi-k2.5',
    name: 'Kimi K2.5',
    description: 'Kimi K2.5 — 256K context, balanced',
    contextWindow: 256000,
    maxTokens: 8192,
    cost: 0,
  },
  'kimi-k2-thinking': {
    id: 'kimi-k2-thinking',
    name: 'Kimi K2 Thinking',
    description: 'Kimi K2 Thinking — reasoning model',
    contextWindow: 256000,
    maxTokens: 8192,
    cost: 0,
  },
  'kimi-k2-thinking-turbo': {
    id: 'kimi-k2-thinking-turbo',
    name: 'Kimi K2 Thinking Turbo',
    description: 'Kimi K2 Thinking Turbo — fast reasoning',
    contextWindow: 256000,
    maxTokens: 8192,
    cost: 0,
  },
};

export const KIMI_DEFAULT_MODEL = 'kimi-k2.5';
