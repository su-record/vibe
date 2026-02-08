/**
 * WebSocket/SSE Types & Zod Schemas
 * Phase 1: API Server (SSE + WebSocket)
 */

import { z } from 'zod';

// ============================================================================
// WebSocket Message Protocol
// ============================================================================

export type WsMessageType =
  | 'auth'
  | 'message'
  | 'subscribe'
  | 'unsubscribe'
  | 'ping'
  | 'pong';

export const wsInboundSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('auth'),
    token: z.string().min(1),
  }),
  z.object({
    type: z.literal('message'),
    content: z.string().min(1).max(65536),
    jobId: z.string().optional(),
  }),
  z.object({
    type: z.literal('subscribe'),
    jobId: z.string().min(1),
  }),
  z.object({
    type: z.literal('unsubscribe'),
    jobId: z.string().min(1),
  }),
  z.object({
    type: z.literal('ping'),
  }),
  z.object({
    type: z.literal('pong'),
  }),
]);

export type WsInboundMessage = z.infer<typeof wsInboundSchema>;

export interface WsOutboundMessage {
  type: string;
  jobId?: string;
  data?: unknown;
  timestamp: string;
  id?: string;
}

// ============================================================================
// SSE Event Types
// ============================================================================

export type SseEventType =
  | 'job:created'
  | 'job:progress'
  | 'job:chunk'
  | 'job:complete'
  | 'job:error'
  | 'permission:request';

export interface SseEvent {
  id: string;
  type: SseEventType;
  jobId: string;
  data: unknown;
  timestamp: string;
}

// ============================================================================
// WebSocket Client State
// ============================================================================

export interface WebSocketClient {
  id: string;
  socket: import('node:net').Socket;
  authenticated: boolean;
  subscribedJobs: Set<string>;
  lastActivity: number;
  lastPong: number;
  writeBufferSize: number;
}

// ============================================================================
// SSE Client State
// ============================================================================

export interface SseClient {
  id: string;
  response: import('node:http').ServerResponse;
  jobId?: string;
  lastActivity: number;
  token: string;
}

// ============================================================================
// JWT Types (Cloud Mode)
// ============================================================================

export interface JwtPayload {
  sub: string;
  iat: number;
  exp: number;
  iss?: string;
  aud?: string;
  nbf?: number;
}

export type AuthMode = 'local' | 'cloud';

// ============================================================================
// Rate Limiting
// ============================================================================

export interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
  windowStart: number;
  requestTimestamps: number[];
}

// ============================================================================
// Event Buffer (SSE reconnection)
// ============================================================================

export interface BufferedEvent {
  id: string;
  event: string;
  data: string;
  timestamp: number;
  size: number;
}

// ============================================================================
// Constants
// ============================================================================

export const WS_MAX_FRAME_SIZE = 65536; // 64KB
export const WS_MAX_CONNECTIONS = 50;
export const SSE_MAX_CONNECTIONS = 100;
export const WS_IDLE_TIMEOUT_MS = 300_000; // 5 min
export const SSE_IDLE_TIMEOUT_MS = 600_000; // 10 min
export const WS_PING_INTERVAL_MS = 30_000; // 30s
export const SSE_KEEPALIVE_INTERVAL_MS = 15_000; // 15s
export const WS_HANDSHAKE_TIMEOUT_MS = 5_000; // 5s
export const WS_BACKPRESSURE_LIMIT = 65536; // 64KB
export const SSE_BACKPRESSURE_LIMIT = 65536; // 64KB
export const SSE_EVENT_BUFFER_MAX_COUNT = 1000;
export const SSE_EVENT_BUFFER_MAX_BYTES = 1024 * 1024; // 1MB
export const SSE_EVENT_BUFFER_MAX_AGE_MS = 30_000; // 30s
export const RATE_LIMIT_WINDOW_MS = 60_000; // 1 min
export const RATE_LIMIT_MAX_REQUESTS = 100;
export const SSE_TOKEN_EXPIRY_MS = 300_000; // 5 min
export const JWT_CLOCK_SKEW_SECONDS = 30;

// WebSocket opcodes (RFC 6455)
export const WS_OPCODE_TEXT = 0x01;
export const WS_OPCODE_BINARY = 0x02;
export const WS_OPCODE_CLOSE = 0x08;
export const WS_OPCODE_PING = 0x09;
export const WS_OPCODE_PONG = 0x0a;

// WebSocket close codes
export const WS_CLOSE_NORMAL = 1000;
export const WS_CLOSE_GOING_AWAY = 1001;
export const WS_CLOSE_PROTOCOL_ERROR = 1002;
export const WS_CLOSE_UNSUPPORTED_DATA = 1003;
export const WS_CLOSE_POLICY_VIOLATION = 1008;
export const WS_CLOSE_MESSAGE_TOO_BIG = 1009;
export const WS_CLOSE_TRY_AGAIN_LATER = 1013;

// WebSocket magic GUID (RFC 6455)
export const WS_MAGIC_GUID = '258EAFA5-E914-47DA-95CA-5AB9B176E5D8';
