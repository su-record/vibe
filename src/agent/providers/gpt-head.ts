/**
 * GPT HeadModel Provider
 * Phase 1: Head Model Selection & Tool Registry
 *
 * OpenAI Responses API 사용 (Chat Completions 아님)
 * - OAuth: chatgpt.com/backend-api/codex/responses
 * - API Key: api.openai.com/v1/responses
 * - Azure: chat/completions (Responses API 미지원)
 * Temperature=0 고정 (결정론적 tool selection)
 */

import { getAuthInfo } from '../../lib/gpt/auth.js';
import type { AuthInfo } from '../../lib/gpt/types.js';
import type {
  AgentMessage,
  AgentToolDefinition,
  HeadModelProvider,
  HeadModelProviderType,
  HeadModelResponse,
  ToolCall,
} from '../types.js';

const MODEL_ID = 'gpt-5.2';
const TEMPERATURE = 0;
const MAX_TOKENS = 32768;

// === Responses API Types ===

interface ResponsesInputItem {
  type: string;
  role?: string;
  content?: string | ResponsesContentPart[];
  call_id?: string;
  name?: string;
  arguments?: string;
  output?: string;
}

interface ResponsesContentPart {
  type: string;
  text: string;
}

interface ResponsesToolDef {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

interface ResponsesOutputItem {
  type: string;
  id?: string;
  role?: string;
  content?: ResponsesContentPart[];
  call_id?: string;
  name?: string;
  arguments?: string;
  status?: string;
}

interface ResponsesApiResult {
  id: string;
  object: string;
  model: string;
  output: ResponsesOutputItem[];
  status: string;
}

// === Azure Chat Completions Types (fallback) ===

interface AzureFCToolCall {
  id: string;
  type: string;
  function: { name: string; arguments: string };
}

interface AzureFCMessage {
  role: string;
  content: string | null;
  tool_calls?: AzureFCToolCall[];
}

interface AzureFCResponse {
  choices: Array<{ message: AzureFCMessage; finish_reason: string }>;
  model: string;
}

// === Helper Functions ===

function safeJsonParse(str: string): Record<string, unknown> {
  try {
    return JSON.parse(str) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * AgentMessage[] → Responses API input 배열 변환
 * system 메시지는 별도 instructions로 추출
 */
function convertToResponsesInput(messages: AgentMessage[]): {
  instructions: string | undefined;
  input: ResponsesInputItem[];
} {
  let instructions: string | undefined;
  const input: ResponsesInputItem[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      instructions = msg.content;
      continue;
    }

    if (msg.role === 'user') {
      input.push({ type: 'message', role: 'user', content: msg.content });
      continue;
    }

    if (msg.role === 'assistant') {
      // assistant 메시지에 toolCalls가 있으면 function_call로 변환
      if (msg.toolCalls?.length) {
        for (const tc of msg.toolCalls) {
          input.push({
            type: 'function_call',
            call_id: tc.id,
            name: tc.name,
            arguments: JSON.stringify(tc.arguments),
          });
        }
      }
      // content가 있으면 message로도 추가
      if (msg.content) {
        input.push({
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: msg.content }],
        });
      }
      continue;
    }

    if (msg.role === 'tool' && msg.toolCallId) {
      input.push({
        type: 'function_call_output',
        call_id: msg.toolCallId,
        output: msg.content,
      });
      continue;
    }
  }

  return { instructions, input };
}

function convertToResponsesTools(tools: AgentToolDefinition[]): ResponsesToolDef[] {
  return tools.map((t) => ({
    type: 'function' as const,
    name: t.name,
    description: t.description,
    parameters: t.parameters as Record<string, unknown>,
  }));
}

function parseResponsesOutput(result: ResponsesApiResult): HeadModelResponse {
  const toolCalls: ToolCall[] = [];
  let content = '';

  for (const item of result.output) {
    if (item.type === 'function_call' && item.call_id && item.name) {
      toolCalls.push({
        id: item.call_id,
        name: item.name,
        arguments: safeJsonParse(item.arguments || '{}'),
      });
    }

    if (item.type === 'message' && item.content) {
      const texts = item.content
        .filter((c) => c.type === 'output_text')
        .map((c) => c.text);
      if (texts.length > 0) {
        content = texts.join('');
      }
    }
  }

  return {
    content,
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    finishReason: result.status === 'completed' ? 'stop' : result.status,
    model: result.model || MODEL_ID,
  };
}

// === Azure Chat Completions helpers ===

function convertToAzureMessages(messages: AgentMessage[]): Record<string, unknown>[] {
  return messages.map((msg) => {
    const base: Record<string, unknown> = {
      role: msg.role,
      content: msg.content || null,
    };
    if (msg.toolCalls?.length) {
      base.tool_calls = msg.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      }));
    }
    if (msg.toolCallId) {
      base.tool_call_id = msg.toolCallId;
    }
    return base;
  });
}

function convertToAzureTools(tools: AgentToolDefinition[]): Record<string, unknown>[] {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters as Record<string, unknown>,
    },
  }));
}

function parseAzureResponse(result: AzureFCResponse): HeadModelResponse {
  const choice = result.choices[0];
  if (!choice) {
    throw new Error('Azure GPT returned empty response');
  }

  const message = choice.message;
  let toolCalls: ToolCall[] | undefined;

  if (message.tool_calls?.length) {
    toolCalls = message.tool_calls.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: safeJsonParse(tc.function.arguments),
    }));
  }

  return {
    content: message.content || '',
    toolCalls,
    finishReason: choice.finish_reason,
    model: result.model || MODEL_ID,
  };
}

// === Endpoint Resolution ===

interface EndpointInfo {
  url: string;
  headers: Record<string, string>;
  format: 'responses' | 'chat-completions';
}

function getApiEndpoint(authInfo: AuthInfo): EndpointInfo {
  switch (authInfo.type) {
    case 'oauth': {
      if (!authInfo.accessToken) throw new GptHeadError(0, 'OAuth access token is missing');
      const oauthHeaders: Record<string, string> = {
        'Authorization': `Bearer ${authInfo.accessToken}`,
      };
      if (authInfo.accountId) {
        oauthHeaders['ChatGPT-Account-Id'] = authInfo.accountId;
      }
      return {
        url: 'https://chatgpt.com/backend-api/codex/responses',
        headers: oauthHeaders,
        format: 'responses',
      };
    }
    case 'apikey': {
      if (!authInfo.apiKey) throw new GptHeadError(0, 'API key is missing from auth info');
      return {
        url: 'https://api.openai.com/v1/responses',
        headers: { 'Authorization': `Bearer ${authInfo.apiKey}` },
        format: 'responses',
      };
    }
    case 'azure': {
      if (!authInfo.azureEndpoint || !authInfo.azureDeployment || !authInfo.azureApiKey) {
        throw new GptHeadError(0, 'Azure configuration is incomplete');
      }
      return {
        url: `${authInfo.azureEndpoint}/openai/deployments/${authInfo.azureDeployment}/chat/completions?api-version=${authInfo.azureApiVersion || '2024-12-01-preview'}`,
        headers: { 'api-key': authInfo.azureApiKey },
        format: 'chat-completions',
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
    const { url, headers, format } = getApiEndpoint(authInfo);

    if (format === 'responses') {
      return this.callResponsesApi(url, headers, messages, tools);
    }
    return this.callChatCompletionsApi(url, headers, messages, tools);
  }

  private async callResponsesApi(
    url: string,
    headers: Record<string, string>,
    messages: AgentMessage[],
    tools?: AgentToolDefinition[],
  ): Promise<HeadModelResponse> {
    const { instructions, input } = convertToResponsesInput(messages);

    const isCodexBackend = url.includes('chatgpt.com');
    const requestBody: Record<string, unknown> = {
      model: MODEL_ID,
      input,
      instructions: instructions || 'You are a helpful assistant.',
      store: false,
      stream: isCodexBackend,
    };

    // ChatGPT backend는 temperature, max_output_tokens 미지원
    if (!isCodexBackend) {
      requestBody.temperature = TEMPERATURE;
      requestBody.max_output_tokens = MAX_TOKENS;
    }

    if (tools?.length) {
      requestBody.tools = convertToResponsesTools(tools);
      requestBody.tool_choice = 'auto';
    }

    const fetchHeaders: Record<string, string> = {
      ...headers,
      'Content-Type': 'application/json',
    };
    if (isCodexBackend) {
      fetchHeaders['Accept'] = 'text/event-stream';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: fetchHeaders,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new GptHeadError(response.status, errorText);
    }

    if (isCodexBackend) {
      return this.parseSSEResponse(response);
    }

    const result = (await response.json()) as ResponsesApiResult;
    return parseResponsesOutput(result);
  }

  /**
   * ChatGPT backend SSE 스트리밍 응답 파싱
   * response.completed 이벤트에서 최종 결과 추출
   */
  private async parseSSEResponse(response: Response): Promise<HeadModelResponse> {
    const text = await response.text();
    const lines = text.split('\n');

    let finalResult: ResponsesApiResult | undefined;
    const toolCalls: ToolCall[] = [];
    let content = '';
    let model = MODEL_ID;

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') break;

      try {
        const event = JSON.parse(data) as Record<string, unknown>;
        const eventType = event.type as string | undefined;

        // response.completed → 최종 response 객체
        if (eventType === 'response.completed') {
          const resp = event.response as ResponsesApiResult | undefined;
          if (resp) {
            finalResult = resp;
          }
          continue;
        }

        // response.output_item.done → 개별 output item 완료
        if (eventType === 'response.output_item.done') {
          const item = event.item as ResponsesOutputItem | undefined;
          if (!item) continue;

          if (item.type === 'function_call' && item.call_id && item.name) {
            toolCalls.push({
              id: item.call_id,
              name: item.name,
              arguments: safeJsonParse(item.arguments || '{}'),
            });
          }

          if (item.type === 'message' && item.content) {
            const texts = item.content
              .filter((c) => c.type === 'output_text')
              .map((c) => c.text);
            if (texts.length > 0) {
              content += texts.join('');
            }
          }
          continue;
        }
      } catch {
        // JSON 파싱 실패 → 무시
      }
    }

    // response.completed가 있으면 그걸 사용
    if (finalResult) {
      return parseResponsesOutput(finalResult);
    }

    // SSE 이벤트에서 수집한 결과 반환
    if (toolCalls.length > 0 || content) {
      return {
        content,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: 'stop',
        model,
      };
    }

    throw new Error('GPT SSE stream returned no usable response');
  }

  private async callChatCompletionsApi(
    url: string,
    headers: Record<string, string>,
    messages: AgentMessage[],
    tools?: AgentToolDefinition[],
  ): Promise<HeadModelResponse> {
    const requestBody: Record<string, unknown> = {
      model: MODEL_ID,
      messages: convertToAzureMessages(messages),
      temperature: TEMPERATURE,
      max_completion_tokens: MAX_TOKENS,
    };

    if (tools?.length) {
      requestBody.tools = convertToAzureTools(tools);
      requestBody.tool_choice = 'auto';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new GptHeadError(response.status, errorText);
    }

    const result = (await response.json()) as AzureFCResponse;
    return parseAzureResponse(result);
  }
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
