/**
 * Claude HeadModel Provider (Fallback)
 * Phase 1: Head Model Selection & Tool Registry
 *
 * Claude Opus 4.6을 fallback 헤드 모델로 사용.
 * Anthropic Messages API를 직접 호출하여 tool use 수행.
 */

import type {
  AgentMessage,
  AgentToolDefinition,
  AnthropicTool,
  HeadModelProvider,
  HeadModelProviderType,
  HeadModelResponse,
  ToolCall,
} from '../types.js';

const MODEL_ID = 'claude-opus-4-6';
const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const MAX_TOKENS = 8192;

// === Anthropic API Types ===

interface AnthropicContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

interface AnthropicRequestMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

interface AnthropicApiResponse {
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens';
}

// === Helper Functions ===

function getApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new ClaudeHeadError('ANTHROPIC_API_KEY environment variable is not set');
  }
  return key;
}

function convertMessagesToAnthropic(
  messages: AgentMessage[],
): { system: string; messages: AnthropicRequestMessage[] } {
  let system = '';
  const apiMessages: AnthropicRequestMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      system = msg.content;
      continue;
    }

    if (msg.role === 'tool') {
      apiMessages.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: msg.toolCallId,
          content: msg.content,
        }],
      });
      continue;
    }

    if (msg.role === 'assistant' && msg.toolCalls?.length) {
      const blocks: AnthropicContentBlock[] = [];
      if (msg.content) blocks.push({ type: 'text', text: msg.content });
      for (const tc of msg.toolCalls) {
        blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments });
      }
      apiMessages.push({ role: 'assistant', content: blocks });
      continue;
    }

    const role = msg.role === 'assistant' ? 'assistant' : 'user';
    apiMessages.push({ role, content: msg.content });
  }

  return { system, messages: apiMessages };
}

function convertToolsToAnthropic(tools: AgentToolDefinition[]): AnthropicTool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

function parseAnthropicResponse(result: AnthropicApiResponse): HeadModelResponse {
  let textContent = '';
  const toolCalls: ToolCall[] = [];

  for (const block of result.content) {
    if (block.type === 'text' && block.text) {
      textContent += block.text;
    }
    if (block.type === 'tool_use' && block.id && block.name) {
      toolCalls.push({
        id: block.id,
        name: block.name,
        arguments: (block.input ?? {}) as Record<string, unknown>,
      });
    }
  }

  return {
    content: textContent,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    finishReason: result.stop_reason,
    model: result.model || MODEL_ID,
  };
}

// === Claude Head Provider ===

export class ClaudeHeadModelProvider implements HeadModelProvider {
  readonly provider: HeadModelProviderType = 'claude';
  readonly model: string = MODEL_ID;

  async chat(
    messages: AgentMessage[],
    tools?: AgentToolDefinition[],
  ): Promise<HeadModelResponse> {
    const apiKey = getApiKey();
    const { system, messages: apiMessages } = convertMessagesToAnthropic(messages);
    const anthropicTools = tools?.length ? convertToolsToAnthropic(tools) : undefined;

    const requestBody: Record<string, unknown> = {
      model: MODEL_ID,
      max_tokens: MAX_TOKENS,
      messages: apiMessages,
    };

    if (system) requestBody.system = system;
    if (anthropicTools?.length) requestBody.tools = anthropicTools;

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ClaudeHeadError(
        `Claude HeadModel API error (${response.status}): ${errorText.substring(0, 200)}`,
      );
    }

    const result = (await response.json()) as AnthropicApiResponse;
    return parseAnthropicResponse(result);
  }
}

// === Error Type ===

export class ClaudeHeadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClaudeHeadError';
  }
}
