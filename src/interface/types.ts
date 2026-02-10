/**
 * External Interface Type Definitions
 * Phase 4: External Interface
 */

import { LogLevel } from '../daemon/types.js';

// ============================================================================
// Message & Response (Channel-agnostic)
// ============================================================================

export type ChannelType = 'telegram' | 'web' | 'webhook' | 'cli' | 'vision' | 'slack';

export interface ExternalMessage {
  id: string;
  channel: ChannelType;
  chatId: string;
  userId: string;
  content: string;
  type: 'text' | 'voice' | 'file' | 'command';
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface ExternalResponse {
  messageId: string;
  channel: ChannelType;
  chatId: string;
  content: string;
  format: 'text' | 'markdown' | 'html';
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Interface Status
// ============================================================================

export type InterfaceStatus = 'enabled' | 'disabled' | 'error' | 'connecting';

export interface InterfaceInfo {
  name: string;
  channel: ChannelType;
  status: InterfaceStatus;
  connectedAt?: string;
  lastActivity?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// External Interface Contract
// ============================================================================

export interface ExternalInterface {
  readonly name: string;
  readonly channel: ChannelType;
  getStatus(): InterfaceStatus;
  start(): Promise<void>;
  stop(): Promise<void>;
  sendResponse(response: ExternalResponse): Promise<void>;
  getInfo(): InterfaceInfo;
}

// ============================================================================
// Telegram Types
// ============================================================================

export interface TelegramConfig {
  botToken: string;
  allowedChatIds: string[];
  pollingTimeout?: number;
}

// ============================================================================
// Vision Types
// ============================================================================

export interface VisionConfig {
  enabled: boolean;
  geminiApiKey?: string;
  maxImageSizeMB?: number;
}

// ============================================================================
// Slack Types
// ============================================================================

export interface SlackConfig {
  botToken: string;
  appToken: string;
  allowedChannelIds: string[];
}

// ============================================================================
// Multi-Channel Configuration
// ============================================================================

export interface VibeChannelsConfig {
  telegram?: {
    enabled: boolean;
    config?: TelegramConfig;
  };
  slack?: {
    enabled: boolean;
    config?: SlackConfig;
  };
  vision?: {
    enabled: boolean;
    config?: VisionConfig;
  };
  web?: {
    enabled: boolean;
    config?: WebServerConfig;
  };
}

// ============================================================================
// Web Server Types
// ============================================================================

export interface WebServerConfig {
  port: number;
  host: string;
  authToken: string;
  maxConnections: number;
  maxSseConnections: number;
  idleTimeoutMs: number;
  maxPayloadBytes: number;
  corsOrigins: string[];
  authMode: 'local' | 'cloud';
  jwtSecret?: string;
  jwtIssuer?: string;
  jwtAudience?: string;
}

export interface WebSocketMessage {
  type: 'auth' | 'message' | 'ping' | 'pong';
  token?: string;
  content?: string;
  jobId?: string;
}

// ============================================================================
// Webhook Types
// ============================================================================

export type WebhookProvider = 'github' | 'gitlab' | 'custom';

export interface WebhookConfig {
  name: string;
  provider: WebhookProvider;
  secret: string;
  events?: string[];
}

export interface WebhookEvent {
  provider: WebhookProvider;
  event: string;
  deliveryId: string;
  payload: Record<string, unknown>;
  verified: boolean;
}

// ============================================================================
// Claude Code Bridge Types
// ============================================================================

export interface ClaudeStreamMessage {
  type: 'user' | 'assistant' | 'system' | 'result' | 'permission_request';
  subtype?: string;
  message?: {
    role?: string;
    content?: string | Array<{ text: string }>;
  };
  result?: string;
  permission?: {
    tool: string;
    description: string;
  };
}

export interface ClaudeSessionConfig {
  sessionId?: string;
  projectPath: string;
  maxRetries: number;
}

// ============================================================================
// Permission Request (forwarded to clients)
// ============================================================================

export interface PermissionRequest {
  jobId: string;
  sessionId: string;
  tool: string;
  description: string;
  timestamp: string;
}

export interface PermissionResponse {
  jobId: string;
  approved: boolean;
}

// ============================================================================
// Logger Type
// ============================================================================

export type InterfaceLogger = (level: LogLevel, message: string, data?: unknown) => void;
