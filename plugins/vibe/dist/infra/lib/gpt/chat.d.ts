/**
 * GPT 채팅 API
 */
import type { GptModelInfo, ChatOptions, ChatResponse, StreamChunk, ChatGptPlan } from './types.js';
export declare const GPT_MODELS: Record<string, GptModelInfo>;
/**
 * 플랜 기반 모델 선택 (환경변수 GPT_MODEL 우선)
 */
export declare function getDefaultModel(plan?: ChatGptPlan): string;
export declare const DEFAULT_MODEL: string;
/**
 * GitHub에서 Codex instructions 가져오기
 */
export declare function getCodexInstructions(model?: string): Promise<string>;
/**
 * GPT API 호출 (고정 순서 인증 + Fallback)
 * codex-cli → apikey 순서, 실패 시 다음 방식으로 자동 전환
 */
export declare function chat(options: ChatOptions): Promise<ChatResponse>;
/**
 * 스트리밍 Chat (Codex 또는 API Key 자동 선택)
 */
export declare function chatStream(options: ChatOptions): AsyncGenerator<StreamChunk>;
/**
 * 사용 가능한 모델 목록 반환
 */
export declare function getAvailableModels(): GptModelInfo[];
/**
 * 모델 정보 가져오기
 */
export declare function getModelInfo(modelId: string): GptModelInfo | null;
/**
 * 간단한 질문-응답
 */
export declare function ask(prompt: string, options?: Omit<ChatOptions, 'messages'>): Promise<string>;
/**
 * 빠른 질문 (GPT-5.5 사용)
 */
export declare function quickAsk(prompt: string): Promise<string>;
//# sourceMappingURL=chat.d.ts.map