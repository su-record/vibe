/**
 * Provider 우선순위 설정 읽기/쓰기
 * config.json의 "priority" 키를 관리
 */

import path from 'path';
import fs from 'fs';

export type EmbeddingProvider = 'az' | 'gpt';
export type KimiProvider = 'az' | 'kimi';

export interface PriorityConfig {
  embedding: EmbeddingProvider[];
  kimi: KimiProvider[];
}

const DEFAULT_PRIORITY: PriorityConfig = {
  embedding: ['az', 'gpt'],
  kimi: ['az', 'kimi'],
};

/** Phase 7: Response style configuration */
export interface ResponseStyleConfig {
  format: 'text' | 'markdown' | 'html';
  useEmoji: boolean;
  tone: 'conversational' | 'formal';
}

/** Phase 8: Messaging configuration */
export interface MessagingConfig {
  batchWaitMs: number;
  maxInjectionPerSession: number;
  conversationHistoryHours: number;
}

const DEFAULT_RESPONSE_STYLE: ResponseStyleConfig = {
  format: 'text',
  useEmoji: true,
  tone: 'conversational',
};

const DEFAULT_MESSAGING: MessagingConfig = {
  batchWaitMs: 2000,
  maxInjectionPerSession: 3,
  conversationHistoryHours: 24,
};

interface ConfigJson {
  priority?: {
    embedding?: string[];
    kimi?: string[];
  };
  responseStyle?: Partial<ResponseStyleConfig>;
  messaging?: Partial<MessagingConfig>;
  [key: string]: unknown;
}

/**
 * 프로젝트 config.json 경로
 */
function getConfigPath(): string {
  return path.join(process.cwd(), '.claude', 'vibe', 'config.json');
}

/**
 * config.json 읽기
 */
function readConfig(): ConfigJson {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8')) as ConfigJson;
    }
  } catch { /* ignore */ }
  return {};
}

/**
 * config.json 쓰기
 */
function writeConfig(config: ConfigJson): void {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/**
 * 유효한 임베딩 프로바이더인지 확인
 */
function isValidEmbeddingProvider(p: string): p is EmbeddingProvider {
  return p === 'az' || p === 'gpt';
}

/**
 * 유효한 Kimi 프로바이더인지 확인
 */
function isValidKimiProvider(p: string): p is KimiProvider {
  return p === 'az' || p === 'kimi';
}

/**
 * 우선순위 설정 로드
 */
export function loadPriorityConfig(): PriorityConfig {
  const config = readConfig();
  const priority = config.priority;

  const result: PriorityConfig = { ...DEFAULT_PRIORITY };

  if (priority?.embedding && Array.isArray(priority.embedding)) {
    const valid = priority.embedding.filter(isValidEmbeddingProvider);
    if (valid.length > 0) {
      result.embedding = valid;
    }
  }

  if (priority?.kimi && Array.isArray(priority.kimi)) {
    const valid = priority.kimi.filter(isValidKimiProvider);
    if (valid.length > 0) {
      result.kimi = valid;
    }
  }

  return result;
}

/**
 * Phase 7: Response style 로드 (기본값 fallback)
 */
export function loadResponseStyleConfig(): ResponseStyleConfig {
  const config = readConfig();
  const style = config.responseStyle;
  if (!style) return { ...DEFAULT_RESPONSE_STYLE };

  const validFormats = ['text', 'markdown', 'html'] as const;
  const validTones = ['conversational', 'formal'] as const;

  return {
    format: validFormats.includes(style.format as never)
      ? (style.format as ResponseStyleConfig['format'])
      : DEFAULT_RESPONSE_STYLE.format,
    useEmoji: typeof style.useEmoji === 'boolean' ? style.useEmoji : DEFAULT_RESPONSE_STYLE.useEmoji,
    tone: validTones.includes(style.tone as never)
      ? (style.tone as ResponseStyleConfig['tone'])
      : DEFAULT_RESPONSE_STYLE.tone,
  };
}

/**
 * Phase 8: Messaging config 로드 (기본값 fallback)
 */
export function loadMessagingConfig(): MessagingConfig {
  const config = readConfig();
  const msg = config.messaging;
  if (!msg) return { ...DEFAULT_MESSAGING };

  return {
    batchWaitMs: typeof msg.batchWaitMs === 'number' && msg.batchWaitMs > 0
      ? msg.batchWaitMs : DEFAULT_MESSAGING.batchWaitMs,
    maxInjectionPerSession: typeof msg.maxInjectionPerSession === 'number' && msg.maxInjectionPerSession > 0
      ? msg.maxInjectionPerSession : DEFAULT_MESSAGING.maxInjectionPerSession,
    conversationHistoryHours: typeof msg.conversationHistoryHours === 'number' && msg.conversationHistoryHours > 0
      ? msg.conversationHistoryHours : DEFAULT_MESSAGING.conversationHistoryHours,
  };
}

/**
 * 우선순위 설정 저장
 */
export function savePriorityConfig(update: Partial<PriorityConfig>): void {
  const config = readConfig();

  if (!config.priority) {
    config.priority = {};
  }

  if (update.embedding) {
    config.priority.embedding = update.embedding;
  }
  if (update.kimi) {
    config.priority.kimi = update.kimi;
  }

  writeConfig(config);
}
