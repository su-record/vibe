/**
 * Codex Proxy — Anthropic Messages API → OpenAI API
 * Claude Code에서 OpenAI 호환 모델을 백엔드로 사용하는 로컬 프록시
 *
 * chatgpt-pro: Codex Responses API (chatgpt.com/backend-api/codex/responses)
 * openai/antigravity/custom: Chat Completions API (api.openai.com/v1/chat/completions)
 */
import http from 'http';
import type { CodexProxyConfig } from '../../cli/types.js';
interface ContentBlock {
    type: string;
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
    tool_use_id?: string;
    content?: string | ContentBlock[];
    source?: {
        type: string;
        media_type?: string;
        data?: string;
    };
}
interface AMessage {
    role: string;
    content: string | ContentBlock[];
}
interface ARequest {
    model: string;
    messages: AMessage[];
    system?: string | ContentBlock[];
    max_tokens: number;
    temperature?: number;
    top_p?: number;
    stream?: boolean;
    tools?: Array<{
        name: string;
        description?: string;
        input_schema: Record<string, unknown>;
    }>;
    tool_choice?: {
        type: string;
        name?: string;
    };
    stop_sequences?: string[];
}
interface OMessage {
    role: string;
    content: string | Array<{
        type: string;
        text?: string;
        image_url?: {
            url: string;
        };
    }> | null;
    tool_calls?: Array<{
        id: string;
        type: string;
        function: {
            name: string;
            arguments: string;
        };
    }>;
    tool_call_id?: string;
}
interface OStreamChunk {
    choices?: Array<{
        delta?: {
            content?: string;
            tool_calls?: Array<{
                index: number;
                id?: string;
                function?: {
                    name?: string;
                    arguments?: string;
                };
            }>;
        };
        finish_reason?: string | null;
    }>;
    usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
    };
}
interface ProxyConfig {
    port: number;
    defaultModel?: string;
}
export interface AuthSource {
    source: 'codex-cli' | 'apikey' | 'env';
    email?: string;
}
export declare function buildOMessages(system: ARequest['system'], messages: AMessage[]): OMessage[];
export declare function translateTools(tools: ARequest['tools']): Array<Record<string, unknown>> | undefined;
export declare function translateToolChoice(choice: ARequest['tool_choice']): string | Record<string, unknown> | undefined;
export declare function buildORequest(req: ARequest, defaultModel?: string): Record<string, unknown>;
export declare function mapFinishReason(reason: string | null | undefined): string;
export declare function buildAResponse(oResp: Record<string, unknown>, model: string): Record<string, unknown>;
export interface StreamState {
    messageId: string;
    model: string;
    nextBlockIndex: number;
    textBlockIndex: number;
    textBlockOpen: boolean;
    toolBlockMap: Map<number, number>;
    finishReason: string | null;
    inputTokens: number;
    outputTokens: number;
}
export declare function newStreamState(model: string): StreamState;
export declare function processChunk(res: http.ServerResponse, s: StreamState, chunk: OStreamChunk): void;
export declare function closeStream(res: http.ServerResponse, s: StreamState): void;
export declare function getProxySettings(): CodexProxyConfig;
export declare function checkAuthSource(): AuthSource | null;
interface CodexInput {
    type: string;
    role?: string;
    content?: Array<{
        type: string;
        text: string;
    }>;
    call_id?: string;
    name?: string;
    arguments?: string;
    output?: string;
}
export declare function buildCodexInput(messages: AMessage[]): CodexInput[];
export declare function buildCodexTools(tools: ARequest['tools']): Array<Record<string, unknown>> | undefined;
export declare function buildCodexRequest(req: ARequest, defaultModel?: string): Record<string, unknown>;
export declare function buildCodexHeaders(token: string, accountId?: string): Record<string, string>;
export interface CodexStreamState {
    messageId: string;
    model: string;
    nextBlockIndex: number;
    textBlockIndex: number;
    textBlockOpen: boolean;
    toolBlockMap: Map<string, number>;
    finishReason: string;
    inputTokens: number;
    outputTokens: number;
}
export declare function newCodexStreamState(model: string): CodexStreamState;
export declare function processCodexEvent(res: http.ServerResponse, s: CodexStreamState, eventType: string, data: Record<string, unknown>): void;
export declare function closeCodexStream(res: http.ServerResponse, s: CodexStreamState): void;
export declare function createProxyServer(config: ProxyConfig): http.Server;
export declare function launchSession(model?: string, claudeArgs?: string[]): void;
export declare function generateShellFunction(model?: string): string;
export {};
//# sourceMappingURL=codex-proxy.d.ts.map