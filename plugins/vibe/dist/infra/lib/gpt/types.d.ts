/**
 * GPT API 타입 정의
 */
export type GptAuthMethod = 'codex-cli' | 'apikey';
export type ChatGptPlan = 'pro' | 'plus' | 'free';
export interface AuthInfo {
    type: GptAuthMethod;
    accessToken?: string;
    apiKey?: string;
    email?: string;
    accountId?: string;
    plan?: ChatGptPlan;
}
export interface GptModelInfo {
    id: string;
    name: string;
    description: string;
    maxTokens: number;
    reasoning: {
        effort: string;
        summary: string;
    };
}
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}
export interface ChatOptions {
    model?: string;
    messages?: ChatMessage[];
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
    _retryCount?: number;
    /** 외부 취소 signal (SmartRouter 등 호출자). timeout 과 결합된다. */
    signal?: AbortSignal;
    /** fetch hard timeout (ms). 미지정 시 DEFAULT_LLM_TIMEOUT_MS. */
    timeoutMs?: number;
}
export interface ChatResponse {
    content: string;
    model: string;
    finishReason: string;
}
export interface StreamChunk {
    type: 'delta' | 'done';
    content?: string;
}
export interface OpenAIMessage {
    role: string;
    content: string | null;
    tool_calls?: Array<{
        id: string;
        type: string;
        function: {
            name: string;
            arguments: string;
        };
    }>;
}
export interface OpenAIResponse {
    choices: Array<{
        message: OpenAIMessage;
        finish_reason: string;
    }>;
    model: string;
}
export interface VibeGptOptions {
    maxTokens?: number;
    jsonMode?: boolean;
    /** 외부 취소 signal (SmartRouter 등). chat 으로 관통된다. */
    signal?: AbortSignal;
    /** fetch hard timeout (ms). */
    timeoutMs?: number;
}
export interface EmbeddingResponse {
    embeddings: number[][];
    model: string;
}
//# sourceMappingURL=types.d.ts.map