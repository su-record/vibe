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
export { VisionInterface } from './vision/VisionInterface.js';
export { GeminiVision } from './vision/GeminiVision.js';
export { ScreenCapture } from './vision/ScreenCapture.js';
export { SlackBot } from './slack/SlackBot.js';
export { SlackFormatter } from './slack/SlackFormatter.js';
export { IMessageBot } from './imessage/IMessageBot.js';
export { IMessageRpcClient, createIMessageRpcClient } from './imessage/IMessageRpcClient.js';
export { IMessageFormatter } from './imessage/IMessageFormatter.js';

export type {
  ExternalInterface,
  ExternalMessage,
  ExternalResponse,
  ChannelType,
  InterfaceStatus,
  InterfaceInfo,
  TelegramConfig,
  SlackConfig,
  IMessageConfig,
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
  VisionConfig,
} from './types.js';

export type { CaptureOptions } from './vision/ScreenCapture.js';
