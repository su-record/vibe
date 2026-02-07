/**
 * Router Type Definitions
 * Model A: Telegram AI Assistant Router
 */

import { ExternalMessage, InterfaceLogger } from '../interface/types.js';

// ============================================================================
// Intent Classification
// ============================================================================

export type IntentCategory =
  | 'development'
  | 'google'
  | 'research'
  | 'utility'
  | 'monitor'
  | 'composite'
  | 'browse'
  | 'conversation';

export interface ClassifiedIntent {
  category: IntentCategory;
  confidence: number;
  subIntent?: string;
  params?: Record<string, unknown>;
  rawQuery: string;
  /** For composite intents */
  subIntents?: Array<{ category: IntentCategory; confidence: number }>;
}

// ============================================================================
// Route Types
// ============================================================================

export interface RouteContext {
  job: RouteJob;
  intent: ClassifiedIntent;
  message: ExternalMessage;
  chatId: string;
  userId: string;
  services: RouteServices;
}

export interface RouteResult {
  success: boolean;
  data?: string;
  error?: string;
  followUp?: string;
}

export interface RouteJob {
  id: string;
  status: RouteJobStatus;
  createdAt: string;
  updatedAt: string;
}

export type RouteJobStatus =
  | 'pending'
  | 'executing'
  | 'completed'
  | 'failed';

// ============================================================================
// Router Configuration
// ============================================================================

export interface RouterConfig {
  repos: RepoConfig;
  qa: QAConfig;
  notifications: NotificationConfig;
}

export interface RepoConfig {
  aliases: Record<string, string>;
  basePaths: string[];
}

export interface QAConfig {
  autoApproveTools: string[];
  maxWaitSeconds: number;
  readOnTimeout: 'approve' | 'deny';
  writeOnTimeout: 'deny' | 'ai_decide';
}

export interface NotificationConfig {
  quietHoursStart: number;
  quietHoursEnd: number;
  minIntervalMs: number;
}

// ============================================================================
// Service Dependencies
// ============================================================================

export interface RouteServices {
  logger: InterfaceLogger;
  sendTelegram: (chatId: string, text: string, options?: TelegramSendOptions) => Promise<void>;
  sendTelegramInlineKeyboard: (
    chatId: string,
    text: string,
    buttons: InlineKeyboardButton[][],
  ) => Promise<number | undefined>;
  router: ModelARouterInterface;
  config: RouterConfig;
}

export interface TelegramSendOptions {
  format?: 'text' | 'markdown' | 'html';
  replyToMessageId?: number;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

// ============================================================================
// ModelARouter Interface (for circular dependency avoidance)
// ============================================================================

export interface ModelARouterInterface {
  handleMessage(message: ExternalMessage): Promise<void>;
  getSmartRouter(): SmartRouterLike;
}

export interface SmartRouterLike {
  route(request: {
    type: string;
    prompt: string;
    systemPrompt?: string;
  }): Promise<{ content: string; success: boolean }>;
}

// ============================================================================
// Dedup Cache
// ============================================================================

export interface DedupEntry {
  updateId: number;
  processedAt: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

export const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  repos: {
    aliases: {},
    basePaths: [],
  },
  qa: {
    autoApproveTools: ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'Ls'],
    maxWaitSeconds: 60,
    readOnTimeout: 'approve',
    writeOnTimeout: 'deny',
  },
  notifications: {
    quietHoursStart: 23,
    quietHoursEnd: 7,
    minIntervalMs: 10_000,
  },
};
