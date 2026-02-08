/**
 * GPT HeadModel Provider
 * Phase 1: Head Model Selection & Tool Registry
 *
 * GPT-5.3-Codex를 헤드 모델로 사용하여 function calling 수행.
 * Temperature=0 고정 (결정론적 tool selection)
 */

import { getAuthInfo, getApiKeyFromConfig, getAzureConfig } from '../../lib/gpt/auth.js';
import type { AuthInfo } from '../../lib/gpt/types.js';
import type {
  AgentMessage,
  AgentToolDefinition,
  HeadModelProvider,
  HeadModelProviderType,
  HeadModelResponse,
  ToolCall,
} from '../types.js';

const MODEL_ID = 'gpt-5.3-codex';
const TEMPERATURE = 0;
const MAX_TOKENS = 32768;

// === OpenAI API Response Types (for function calling) ===

interface OpenAIFCToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIFCMessage {
  role: string;
  content: string | null;
  tool_calls?: OpenAIFCToolCall[];
}

interface OpenAIFCResponse {
  choices: Array<{
    message: OpenAIFCMessage;
    finish_reason: string;
  }>;
  model: string;
}

// === API Request Types ===

interface OpenAIToolParam {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIRequestMessage {
  role: string;
  content: string | null;
  tool_calls?: OpenAIFCToolCall[];
  tool_call_id?: string;
}

// === Helper Functions ===

function convertMessagesToOpenAI(messages: AgentMessage[]): OpenAIRequestMessage[] {
  return messages.map((msg) => {
    const base: OpenAIRequestMessage = {
      role: msg.role,
      content: msg.content || null,
    };
    if (msg.toolCalls?.length) {
      base.tool_calls = msg.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        },
      }));
    }
    if (msg.toolCallId) {
      base.tool_call_id = msg.toolCallId;
    }
    return base;
  });
}

function convertToolsToOpenAI(tools: AgentToolDefinition[]): OpenAIToolParam[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters as Record<string, unknown>,
    },
  }));
}

function parseToolCalls(toolCalls: OpenAIFCToolCall[] | undefined): ToolCall[] | undefined {
  if (!toolCalls?.length) return undefined;

  return toolCalls.map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: safeJsonParse(tc.function.arguments),
  }));
}

function safeJsonParse(str: string): Record<string, unknown> {
  try {
    return JSON.parse(str) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function getApiEndpoint(authInfo: AuthInfo): { url: string; headers: Record<string, string> } {
  switch (authInfo.type) {
    case 'apikey': {
      if (!authInfo.apiKey) throw new GptHeadError(0, 'API key is missing from auth info');
      return {
        url: 'https://api.openai.com/v1/chat/completions',
        headers: { 'Authorization': `Bearer ${authInfo.apiKey}` },
      };
    }
    case 'azure': {
      if (!authInfo.azureEndpoint || !authInfo.azureDeployment || !authInfo.azureApiKey) {
        throw new GptHeadError(0, 'Azure configuration is incomplete');
      }
      return {
        url: `${authInfo.azureEndpoint}/openai/deployments/${authInfo.azureDeployment}/chat/completions?api-version=${authInfo.azureApiVersion || '2024-12-01-preview'}`,
        headers: { 'api-key': authInfo.azureApiKey },
      };
    }
    case 'oauth': {
      if (!authInfo.accessToken) throw new GptHeadError(0, 'OAuth access token is missing');
      return {
        url: 'https://api.openai.com/v1/chat/completions',
        headers: { 'Authorization': `Bearer ${authInfo.accessToken}` },
      };
    }
  }
}

// === GPT Head Provider ===

export class GptHeadModelProvider implements HeadModelProvider {
  readonly provider: HeadModelProviderType = 'gpt';
  readonly model: string = MODEL_ID;

  async chat(
    messages: AgentMessage[],
    tools?: AgentToolDefinition[],
  ): Promise<HeadModelResponse> {
    const authInfo = await getAuthInfo();
    const apiMessages = convertMessagesToOpenAI(messages);
    const openaiTools = tools?.length ? convertToolsToOpenAI(tools) : undefined;

    const requestBody: Record<string, unknown> = {
      model: MODEL_ID,
      messages: apiMessages,
      temperature: TEMPERATURE,
      max_completion_tokens: MAX_TOKENS,
    };

    if (openaiTools?.length) {
      requestBody.tools = openaiTools;
      requestBody.tool_choice = 'auto';
    }

    const { url, headers } = getApiEndpoint(authInfo);
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new GptHeadError(response.status, errorText);
    }

    const result = (await response.json()) as OpenAIFCResponse;
    return parseGptResponse(result);
  }
}

function parseGptResponse(result: OpenAIFCResponse): HeadModelResponse {
  const choice = result.choices[0];
  if (!choice) {
    throw new Error('GPT returned empty response');
  }

  const message = choice.message;
  const toolCalls = parseToolCalls(message.tool_calls);

  return {
    content: message.content || '',
    toolCalls,
    finishReason: choice.finish_reason,
    model: result.model || MODEL_ID,
  };
}

// === Error Type ===

export class GptHeadError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly responseBody: string,
  ) {
    const truncated = responseBody.substring(0, 200);
    super(`GPT HeadModel API error (${statusCode}): ${truncated}`);
    this.name = 'GptHeadError';
  }

  isRetryable(): boolean {
    return this.statusCode === 429 || this.statusCode >= 500;
  }
}
