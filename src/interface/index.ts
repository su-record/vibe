/**
 * Interface Module Exports
 * Phase 4: External Interface
 */

export { BaseInterface } from './BaseInterface.js';
export { ClaudeCodeBridge } from './ClaudeCodeBridge.js';
export { TelegramBot } from './telegram/TelegramBot.js';
export { TelegramFormatter } from './telegram/TelegramFormatter.js';
export { WebServer } from './web/WebServer.js';
export { WebhookHandler } from './webhook/WebhookHandler.js';

export type {
  ExternalInterface,
  ExternalMessage,
  ExternalResponse,
  ChannelType,
  InterfaceStatus,
  InterfaceInfo,
  TelegramConfig,
  WebServerConfig,
  WebSocketMessage,
  WebhookConfig,
  WebhookEvent,
  WebhookProvider,
  ClaudeStreamMessage,
  ClaudeSessionConfig,
  PermissionRequest,
  PermissionResponse,
  InterfaceLogger,
} from './types.js';
