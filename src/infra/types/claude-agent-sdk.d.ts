/**
 * Type declarations for @anthropic-ai/claude-agent-sdk
 * 실제 SDK 설치 전에도 빌드가 가능하도록 타입만 선언
 */

declare module '@anthropic-ai/claude-agent-sdk' {
  export interface QueryOptions {
    model?: string;
    maxTurns?: number;
    allowedTools?: string[];
    cwd?: string;
    resume?: string;
    forkSession?: boolean;
    systemPrompt?: string;
  }

  export interface QueryParams {
    prompt: string;
    options?: QueryOptions;
  }

  export interface SystemMessage {
    type: 'system';
    subtype?: 'init' | 'progress' | 'tool_use' | 'tool_result';
    session_id?: string;
    content?: string;
    data?: Record<string, unknown>;
  }

  export interface AssistantMessage {
    type: 'assistant';
    message: {
      content: Array<{
        type: string;
        text?: string;
        tool_use?: unknown;
      }>;
    };
    session_id?: string;
  }

  export interface ResultMessage {
    type: 'result';
    result: string;
    session_id?: string;
  }

  export interface UserMessage {
    type: 'user';
    content: string;
    session_id?: string;
  }

  export type Message = SystemMessage | AssistantMessage | ResultMessage | UserMessage;

  export function query(params: QueryParams): AsyncIterable<Message>;
}
