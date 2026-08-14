/**
 * Antigravity Chat API (generateContent)
 *
 * API Key → Google AI Studio
 */
import type { AntigravityModelInfo, ChatOptions, ChatResponse, StreamChunk } from './types.js';
export declare function getAntigravityModels(): Record<string, AntigravityModelInfo>;
export declare const ANTIGRAVITY_MODELS: Record<string, AntigravityModelInfo>;
export declare const DEFAULT_MODEL = "antigravity-fast";
/**
 * Antigravity API 호출 (API Key)
 */
export declare function chat(options: ChatOptions): Promise<ChatResponse>;
/**
 * 스트리밍 Chat (API Key → 단일 yield)
 */
export declare function chatStream(options: ChatOptions): AsyncGenerator<StreamChunk>;
/**
 * 사용 가능한 모델 목록
 */
export declare function getAvailableModels(): AntigravityModelInfo[];
/**
 * 모델 정보 가져오기
 */
export declare function getModelInfo(modelId: string): AntigravityModelInfo | null;
/**
 * 간단한 질문-응답
 */
export declare function ask(prompt: string, options?: Omit<ChatOptions, 'messages'>): Promise<string>;
/**
 * 코드 탐색용 빠른 질문 (Antigravity Fast)
 */
export declare function quickAsk(prompt: string): Promise<string>;
//# sourceMappingURL=chat.d.ts.map