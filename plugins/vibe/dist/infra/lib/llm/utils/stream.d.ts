/**
 * Streaming utilities for LLM responses
 */
import type { StreamChunk } from '../types.js';
/**
 * Parse Server-Sent Events (SSE) stream
 */
export declare function parseSSEStream(stream: ReadableStream<Uint8Array>): Promise<string>;
/**
 * Parse SSE stream as async generator
 */
export declare function streamSSE(stream: ReadableStream<Uint8Array>): AsyncGenerator<StreamChunk>;
//# sourceMappingURL=stream.d.ts.map