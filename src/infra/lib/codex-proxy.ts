/**
 * Codex Proxy — Anthropic Messages API → OpenAI API
 * Claude Code에서 OpenAI 호환 모델을 백엔드로 사용하는 로컬 프록시
 *
 * chatgpt-pro: Codex Responses API (chatgpt.com/backend-api/codex/responses)
 * openai/gemini/custom: Chat Completions API (api.openai.com/v1/chat/completions)
 */

import http from 'http';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { getApiKeyFromConfig, findCodexCredentials, getAuthInfo } from './gpt/auth.js';
import { readGlobalConfig, getGeminiApiKey } from './config/GlobalConfigManager.js';
import { CHATGPT_BASE_URL } from './gpt/constants.js';
import type { CodexProxyConfig } from '../../cli/types.js';

// ─── Constants ───────────────────────────────────────────────

const DEFAULT_TARGET_URL = 'https://api.openai.com';
const CODEX_RESPONSES_URL = `${CHATGPT_BASE_URL}/codex/responses`;

// ─── Anthropic Types (incoming from Claude Code) ─────────────

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | ContentBlock[];
  source?: { type: string; media_type?: string; data?: string };
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
  tools?: Array<{ name: string; description?: string; input_schema: Record<string, unknown> }>;
  tool_choice?: { type: string; name?: string };
  stop_sequences?: string[];
}

// ─── OpenAI Types (outgoing to target API) ───────────────────

interface OMessage {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> | null;
  tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

interface OStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

// ─── Proxy Config ────────────────────────────────────────────

interface ProxyConfig {
  port: number;
  defaultModel?: string;
}

export interface AuthSource {
  source: 'codex-cli' | 'apikey' | 'env';
  email?: string;
}

// ─── System Prompt Extraction ────────────────────────────────

function extractSystemText(system: string | ContentBlock[] | undefined): string {
  if (!system) return '';
  if (typeof system === 'string') return system;
  return system.filter(b => b.type === 'text' && b.text).map(b => b.text!).join('\n');
}

// ─── Content Block Translation ───────────────────────────────

type OContentPart = { type: string; text?: string; image_url?: { url: string } };

function translateContentPart(block: ContentBlock): OContentPart | null {
  if (block.type === 'text') return { type: 'text', text: block.text || '' };
  if (block.type === 'image' && block.source?.data) {
    const media = block.source.media_type || 'image/png';
    return { type: 'image_url', image_url: { url: `data:${media};base64,${block.source.data}` } };
  }
  return null;
}

// ─── Assistant Message Translation ───────────────────────────

function translateAssistantMsg(msg: AMessage): OMessage {
  if (typeof msg.content === 'string') {
    return { role: 'assistant', content: msg.content };
  }
  const blocks = msg.content;
  const text = blocks.filter(b => b.type === 'text').map(b => b.text || '').join('');
  const tools = blocks.filter(b => b.type === 'tool_use');
  const result: OMessage = { role: 'assistant', content: text || null };
  if (tools.length > 0) {
    result.tool_calls = tools.map(t => ({
      id: t.id || `call_${crypto.randomUUID()}`,
      type: 'function',
      function: { name: t.name || '', arguments: JSON.stringify(t.input || {}) },
    }));
  }
  return result;
}

// ─── User Message Translation ────────────────────────────────

function translateUserMsg(msg: AMessage, result: OMessage[]): void {
  if (typeof msg.content === 'string') {
    result.push({ role: 'user', content: msg.content });
    return;
  }
  const blocks = msg.content;
  const toolResults = blocks.filter(b => b.type === 'tool_result');
  const others = blocks.filter(b => b.type !== 'tool_result' && b.type !== 'thinking');

  for (const tr of toolResults) {
    const text = typeof tr.content === 'string'
      ? tr.content
      : Array.isArray(tr.content)
        ? tr.content.filter(b => b.type === 'text').map(b => b.text || '').join('')
        : '';
    result.push({ role: 'tool', tool_call_id: tr.tool_use_id || '', content: text });
  }

  if (others.length === 0) return;
  const parts = others
    .map(b => translateContentPart(b))
    .filter((p): p is OContentPart => p !== null);
  if (parts.length === 1 && parts[0].type === 'text') {
    result.push({ role: 'user', content: parts[0].text || '' });
  } else if (parts.length > 0) {
    result.push({ role: 'user', content: parts });
  }
}

// ─── Full Message Array Translation ──────────────────────────

function buildOMessages(system: ARequest['system'], messages: AMessage[]): OMessage[] {
  const result: OMessage[] = [];
  const sysText = extractSystemText(system);
  if (sysText) result.push({ role: 'system', content: sysText });
  for (const msg of messages) {
    if (msg.role === 'assistant') {
      result.push(translateAssistantMsg(msg));
    } else {
      translateUserMsg(msg, result);
    }
  }
  return result;
}

// ─── Tool Definition Translation ─────────────────────────────

function translateTools(
  tools: ARequest['tools'],
): Array<Record<string, unknown>> | undefined {
  if (!tools?.length) return undefined;
  return tools.map(t => ({
    type: 'function',
    function: { name: t.name, description: t.description || '', parameters: t.input_schema },
  }));
}

function translateToolChoice(
  choice: ARequest['tool_choice'],
): string | Record<string, unknown> | undefined {
  if (!choice) return undefined;
  if (choice.type === 'auto') return 'auto';
  if (choice.type === 'any') return 'required';
  if (choice.type === 'tool' && choice.name) {
    return { type: 'function', function: { name: choice.name } };
  }
  return undefined;
}

// ─── Build OpenAI Request Body ───────────────────────────────

function buildORequest(req: ARequest, defaultModel?: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: defaultModel || req.model,
    messages: buildOMessages(req.system, req.messages),
    max_tokens: req.max_tokens,
    stream: req.stream ?? false,
  };
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.top_p !== undefined) body.top_p = req.top_p;
  if (req.stop_sequences) body.stop = req.stop_sequences;
  const tools = translateTools(req.tools);
  if (tools) body.tools = tools;
  const tc = translateToolChoice(req.tool_choice);
  if (tc !== undefined) body.tool_choice = tc;
  if (req.stream) body.stream_options = { include_usage: true };
  return body;
}

// ─── Finish Reason Mapping ───────────────────────────────────

function mapFinishReason(reason: string | null | undefined): string {
  if (reason === 'stop') return 'end_turn';
  if (reason === 'tool_calls') return 'tool_use';
  if (reason === 'length') return 'max_tokens';
  return 'end_turn';
}

// ─── Build Anthropic Response (Non-Streaming) ────────────────

function buildAResponse(
  oResp: Record<string, unknown>,
  model: string,
): Record<string, unknown> {
  const choices = (oResp.choices as Array<Record<string, unknown>>) || [];
  const choice = choices[0] || {};
  const msg = (choice.message as Record<string, unknown>) || {};
  const usage = (oResp.usage as Record<string, number>) || {};
  const content: Array<Record<string, unknown>> = [];

  if (msg.content) content.push({ type: 'text', text: msg.content });

  const tcs = msg.tool_calls as Array<Record<string, unknown>> | undefined;
  if (tcs) {
    for (const tc of tcs) {
      const fn = tc.function as Record<string, string>;
      let input: Record<string, unknown> = {};
      try { input = JSON.parse(fn.arguments || '{}') as Record<string, unknown>; } catch { /* use empty */ }
      content.push({ type: 'tool_use', id: tc.id, name: fn.name, input });
    }
  }

  return {
    id: `msg_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
    type: 'message',
    role: 'assistant',
    content,
    model,
    stop_reason: mapFinishReason(choice.finish_reason as string),
    stop_sequence: null,
    usage: { input_tokens: usage.prompt_tokens || 0, output_tokens: usage.completion_tokens || 0 },
  };
}

// ─── SSE Helpers ─────────────────────────────────────────────

function writeSSE(res: http.ServerResponse, event: string, data: Record<string, unknown>): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// ─── Streaming State ─────────────────────────────────────────

interface StreamState {
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

function newStreamState(model: string): StreamState {
  return {
    messageId: `msg_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
    model,
    nextBlockIndex: 0,
    textBlockIndex: -1,
    textBlockOpen: false,
    toolBlockMap: new Map(),
    finishReason: null,
    inputTokens: 0,
    outputTokens: 0,
  };
}

// ─── Stream Chunk Processing ─────────────────────────────────

function processChunk(res: http.ServerResponse, s: StreamState, chunk: OStreamChunk): void {
  if (chunk.usage) {
    s.inputTokens = chunk.usage.prompt_tokens ?? s.inputTokens;
    s.outputTokens = chunk.usage.completion_tokens ?? s.outputTokens;
  }
  const choice = chunk.choices?.[0];
  if (!choice) return;

  if (choice.delta?.content) {
    if (s.textBlockIndex < 0) {
      s.textBlockIndex = s.nextBlockIndex++;
      writeSSE(res, 'content_block_start', {
        type: 'content_block_start', index: s.textBlockIndex,
        content_block: { type: 'text', text: '' },
      });
      s.textBlockOpen = true;
    }
    writeSSE(res, 'content_block_delta', {
      type: 'content_block_delta', index: s.textBlockIndex,
      delta: { type: 'text_delta', text: choice.delta.content },
    });
  }

  if (choice.delta?.tool_calls) {
    for (const tc of choice.delta.tool_calls) {
      processToolDelta(res, s, tc);
    }
  }

  if (choice.finish_reason) s.finishReason = choice.finish_reason;
}

// ─── Tool Call Delta Processing ──────────────────────────────

interface ToolCallDelta {
  index: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

function processToolDelta(res: http.ServerResponse, s: StreamState, tc: ToolCallDelta): void {
  const idx = tc.index;
  if (!s.toolBlockMap.has(idx)) {
    if (s.textBlockOpen) {
      writeSSE(res, 'content_block_stop', { type: 'content_block_stop', index: s.textBlockIndex });
      s.textBlockOpen = false;
    }
    const blockIdx = s.nextBlockIndex++;
    s.toolBlockMap.set(idx, blockIdx);
    writeSSE(res, 'content_block_start', {
      type: 'content_block_start', index: blockIdx,
      content_block: {
        type: 'tool_use',
        id: tc.id || `call_${crypto.randomUUID()}`,
        name: tc.function?.name || '',
        input: {},
      },
    });
  }
  if (tc.function?.arguments) {
    writeSSE(res, 'content_block_delta', {
      type: 'content_block_delta', index: s.toolBlockMap.get(idx)!,
      delta: { type: 'input_json_delta', partial_json: tc.function.arguments },
    });
  }
}

// ─── Close All Stream Blocks ─────────────────────────────────

function closeStream(res: http.ServerResponse, s: StreamState): void {
  if (s.textBlockOpen) {
    writeSSE(res, 'content_block_stop', { type: 'content_block_stop', index: s.textBlockIndex });
  }
  for (const [, blockIdx] of s.toolBlockMap) {
    writeSSE(res, 'content_block_stop', { type: 'content_block_stop', index: blockIdx });
  }
  writeSSE(res, 'message_delta', {
    type: 'message_delta',
    delta: { stop_reason: mapFinishReason(s.finishReason), stop_sequence: null },
    usage: { output_tokens: s.outputTokens },
  });
  writeSSE(res, 'message_stop', { type: 'message_stop' });
}

// ─── Streaming Response Handler ──────────────────────────────

async function handleStream(
  fetchRes: Response,
  httpRes: http.ServerResponse,
  model: string,
): Promise<void> {
  const s = newStreamState(model);
  httpRes.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  writeSSE(httpRes, 'message_start', {
    type: 'message_start',
    message: {
      id: s.messageId, type: 'message', role: 'assistant', content: [],
      model: s.model, stop_reason: null, stop_sequence: null,
      usage: { input_tokens: s.inputTokens, output_tokens: 0 },
    },
  });

  const reader = fetchRes.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    let streamDone = false;
    while (!streamDone) {
      const read = await reader.read();
      if (read.done) break;
      buffer += decoder.decode(read.value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') { streamDone = true; break; }
        try { processChunk(httpRes, s, JSON.parse(data) as OStreamChunk); }
        catch { /* skip malformed chunk */ }
      }
    }
  } catch (err) {
    try {
      writeSSE(httpRes, 'error', {
        type: 'error', error: { type: 'api_error', message: (err as Error).message },
      });
    } catch { /* response may be closed */ }
  }

  closeStream(httpRes, s);
  httpRes.end();
}

// ─── HTTP Helpers ────────────────────────────────────────────

function collectBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function sendError(res: http.ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message } }));
}

// ─── Config 읽기 ─────────────────────────────────────────────

export function getProxySettings(): CodexProxyConfig {
  const config = readGlobalConfig();
  return config.codexProxy || {};
}

// ─── 인증 소스 확인 (동기, 시작/상태 표시용) ────────────────

export function checkAuthSource(): AuthSource | null {
  if (process.env.CODEX_PROXY_API_KEY) return { source: 'env' };
  const settings = getProxySettings();
  if (settings.apiKey) return { source: 'apikey' };
  if (settings.provider === 'gemini' && getGeminiApiKey()) return { source: 'apikey' };
  const codex = findCodexCredentials();
  if (codex) return { source: 'codex-cli' };
  const apiKey = process.env.OPENAI_API_KEY || getApiKeyFromConfig();
  if (apiKey) return { source: 'apikey' };
  return null;
}

// ─── 요청별 인증 해석 (비동기, 토큰 갱신 포함) ──────────────

interface ResolvedAuth {
  token: string;
  baseUrl: string;
  provider: 'chatgpt-pro' | 'openai-compat';
  accountId?: string;
}

async function resolveRequestAuth(): Promise<ResolvedAuth> {
  const settings = getProxySettings();
  const baseUrl = process.env.CODEX_PROXY_TARGET_URL || settings.targetUrl || DEFAULT_TARGET_URL;

  // 1. 환경변수 최우선
  const proxyKey = process.env.CODEX_PROXY_API_KEY;
  if (proxyKey) return { token: proxyKey, baseUrl, provider: 'openai-compat' };

  // 2. Config의 커스텀 API key
  if (settings.apiKey) return { token: settings.apiKey, baseUrl, provider: 'openai-compat' };

  // 3. Gemini provider → credentials.gemini.apiKey
  if (settings.provider === 'gemini') {
    const geminiKey = getGeminiApiKey();
    if (geminiKey) return { token: geminiKey, baseUrl, provider: 'openai-compat' };
  }

  // 4. GPT 인증 (codex-cli OAuth → apikey 순서, 토큰 자동 갱신)
  const auth = await getAuthInfo();
  const token = auth.accessToken || auth.apiKey;
  if (!token) throw new Error('인증 정보 없음. vibe codex --setup 실행 필요');

  // codex-cli OAuth → ChatGPT Pro (Codex Responses API)
  if (auth.type === 'codex-cli' && auth.accessToken) {
    return {
      token: auth.accessToken,
      baseUrl: CHATGPT_BASE_URL,
      provider: 'chatgpt-pro',
      accountId: auth.accountId,
    };
  }

  return { token, baseUrl, provider: 'openai-compat' };
}

// ─── Codex Responses API 변환 (chatgpt-pro) ────────────────

interface CodexInput {
  type: string;
  role?: string;
  content?: Array<{ type: string; text: string }>;
  call_id?: string;
  name?: string;
  arguments?: string;
  output?: string;
}

function buildCodexInput(messages: AMessage[]): CodexInput[] {
  const input: CodexInput[] = [];

  for (const msg of messages) {
    if (msg.role === 'assistant') {
      if (typeof msg.content === 'string') {
        input.push({
          type: 'message', role: 'assistant',
          content: [{ type: 'output_text', text: msg.content }],
        });
      } else {
        const texts = msg.content.filter(b => b.type === 'text');
        const tools = msg.content.filter(b => b.type === 'tool_use');
        if (texts.length > 0) {
          input.push({
            type: 'message', role: 'assistant',
            content: [{ type: 'output_text', text: texts.map(t => t.text || '').join('') }],
          });
        }
        for (const t of tools) {
          input.push({
            type: 'function_call',
            call_id: t.id || `call_${crypto.randomUUID()}`,
            name: t.name || '',
            arguments: JSON.stringify(t.input || {}),
          });
        }
      }
    } else {
      // user messages
      if (typeof msg.content === 'string') {
        input.push({
          type: 'message', role: 'user',
          content: [{ type: 'input_text', text: msg.content }],
        });
      } else {
        const toolResults = msg.content.filter(b => b.type === 'tool_result');
        const others = msg.content.filter(b => b.type !== 'tool_result' && b.type !== 'thinking');

        for (const tr of toolResults) {
          const text = typeof tr.content === 'string'
            ? tr.content
            : Array.isArray(tr.content)
              ? tr.content.filter(b => b.type === 'text').map(b => b.text || '').join('')
              : '';
          input.push({
            type: 'function_call_output',
            call_id: tr.tool_use_id || '',
            output: text,
          });
        }

        if (others.length > 0) {
          const text = others
            .filter(b => b.type === 'text')
            .map(b => b.text || '').join('');
          if (text) {
            input.push({
              type: 'message', role: 'user',
              content: [{ type: 'input_text', text }],
            });
          }
        }
      }
    }
  }
  return input;
}

function buildCodexTools(
  tools: ARequest['tools'],
): Array<Record<string, unknown>> | undefined {
  if (!tools?.length) return undefined;
  return tools.map(t => ({
    type: 'function',
    name: t.name,
    description: t.description || '',
    parameters: t.input_schema,
  }));
}

function buildCodexRequest(req: ARequest, defaultModel?: string): Record<string, unknown> {
  const sysText = extractSystemText(req.system);
  const body: Record<string, unknown> = {
    model: defaultModel || req.model,
    instructions: sysText || 'You are a helpful assistant.',
    input: buildCodexInput(req.messages),
    store: false,
    stream: true,
  };
  if (req.temperature !== undefined) body.temperature = req.temperature;
  if (req.top_p !== undefined) body.top_p = req.top_p;
  const tools = buildCodexTools(req.tools);
  if (tools) body.tools = tools;
  return body;
}

function buildCodexHeaders(token: string, accountId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'OpenAI-Beta': 'responses=experimental',
    'originator': 'codex_cli_rs',
    'session_id': crypto.randomUUID(),
    'User-Agent': 'codex-tui/0.120.0',
  };
  if (accountId) headers['chatgpt-account-id'] = accountId;
  return headers;
}

// ─── Codex Responses SSE → Anthropic SSE ────────────────────

interface CodexStreamState {
  messageId: string;
  model: string;
  nextBlockIndex: number;
  textBlockIndex: number;
  textBlockOpen: boolean;
  toolBlockMap: Map<string, number>; // call_id → blockIndex
  finishReason: string;
  inputTokens: number;
  outputTokens: number;
}

function newCodexStreamState(model: string): CodexStreamState {
  return {
    messageId: `msg_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
    model,
    nextBlockIndex: 0,
    textBlockIndex: -1,
    textBlockOpen: false,
    toolBlockMap: new Map(),
    finishReason: 'end_turn',
    inputTokens: 0,
    outputTokens: 0,
  };
}

function processCodexEvent(
  res: http.ServerResponse,
  s: CodexStreamState,
  eventType: string,
  data: Record<string, unknown>,
): void {
  switch (eventType) {
    case 'response.output_text.delta': {
      const delta = data.delta as string;
      if (!delta) break;
      if (s.textBlockIndex < 0) {
        s.textBlockIndex = s.nextBlockIndex++;
        writeSSE(res, 'content_block_start', {
          type: 'content_block_start', index: s.textBlockIndex,
          content_block: { type: 'text', text: '' },
        });
        s.textBlockOpen = true;
      }
      writeSSE(res, 'content_block_delta', {
        type: 'content_block_delta', index: s.textBlockIndex,
        delta: { type: 'text_delta', text: delta },
      });
      break;
    }
    case 'response.output_item.added': {
      const item = data.item as Record<string, unknown>;
      if (!item) break;
      if (item.type === 'function_call') {
        if (s.textBlockOpen) {
          writeSSE(res, 'content_block_stop', { type: 'content_block_stop', index: s.textBlockIndex });
          s.textBlockOpen = false;
        }
        const blockIdx = s.nextBlockIndex++;
        const callId = item.call_id as string || `call_${crypto.randomUUID()}`;
        s.toolBlockMap.set(callId, blockIdx);
        s.finishReason = 'tool_use';
        writeSSE(res, 'content_block_start', {
          type: 'content_block_start', index: blockIdx,
          content_block: {
            type: 'tool_use', id: callId,
            name: item.name as string || '', input: {},
          },
        });
      }
      break;
    }
    case 'response.function_call_arguments.delta': {
      const delta = data.delta as string;
      const callId = data.call_id as string || data.item_id as string;
      if (!delta || !callId) break;
      const blockIdx = s.toolBlockMap.get(callId);
      if (blockIdx !== undefined) {
        writeSSE(res, 'content_block_delta', {
          type: 'content_block_delta', index: blockIdx,
          delta: { type: 'input_json_delta', partial_json: delta },
        });
      }
      break;
    }
    case 'response.completed': {
      const response = data.response as Record<string, unknown>;
      if (response?.usage) {
        const usage = response.usage as Record<string, number>;
        s.inputTokens = usage.input_tokens ?? 0;
        s.outputTokens = usage.output_tokens ?? 0;
      }
      break;
    }
  }
}

function closeCodexStream(res: http.ServerResponse, s: CodexStreamState): void {
  if (s.textBlockOpen) {
    writeSSE(res, 'content_block_stop', { type: 'content_block_stop', index: s.textBlockIndex });
  }
  for (const [, blockIdx] of s.toolBlockMap) {
    writeSSE(res, 'content_block_stop', { type: 'content_block_stop', index: blockIdx });
  }
  writeSSE(res, 'message_delta', {
    type: 'message_delta',
    delta: { stop_reason: mapFinishReason(s.finishReason === 'tool_use' ? 'tool_calls' : 'stop'), stop_sequence: null },
    usage: { output_tokens: s.outputTokens },
  });
  writeSSE(res, 'message_stop', { type: 'message_stop' });
}

async function handleCodexStream(
  fetchRes: Response,
  httpRes: http.ServerResponse,
  model: string,
): Promise<void> {
  const s = newCodexStreamState(model);
  httpRes.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  writeSSE(httpRes, 'message_start', {
    type: 'message_start',
    message: {
      id: s.messageId, type: 'message', role: 'assistant', content: [],
      model: s.model, stop_reason: null, stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    },
  });

  const reader = fetchRes.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';

  try {
    let done = false;
    while (!done) {
      const read = await reader.read();
      if (read.done) break;
      buffer += decoder.decode(read.value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const raw = line.slice(6).trim();
          if (currentEvent === 'response.completed') done = true;
          try {
            const data = JSON.parse(raw) as Record<string, unknown>;
            processCodexEvent(httpRes, s, currentEvent, data);
          } catch { /* skip */ }
          if (done) {
            // parse completed event before breaking
            try {
              const data = JSON.parse(raw) as Record<string, unknown>;
              processCodexEvent(httpRes, s, 'response.completed', data);
            } catch { /* skip */ }
          }
        }
      }
    }
  } catch (err) {
    try {
      writeSSE(httpRes, 'error', {
        type: 'error', error: { type: 'api_error', message: (err as Error).message },
      });
    } catch { /* response may be closed */ }
  }

  closeCodexStream(httpRes, s);
  httpRes.end();
}

// ─── Codex Responses 비스트리밍 수집 ────────────────────────

async function collectCodexResponse(
  fetchRes: Response,
  model: string,
): Promise<Record<string, unknown>> {
  const reader = fetchRes.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';
  let textContent = '';
  const toolCalls: Array<{ id: string; name: string; args: string }> = [];
  let currentToolId = '';
  let currentToolArgs = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let stopReason = 'end_turn';

  while (true) {
    const read = await reader.read();
    if (read.done) break;
    buffer += decoder.decode(read.value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        const raw = line.slice(6).trim();
        try {
          const data = JSON.parse(raw) as Record<string, unknown>;
          switch (currentEvent) {
            case 'response.output_text.delta':
              textContent += (data.delta as string) || '';
              break;
            case 'response.output_item.added': {
              const item = data.item as Record<string, unknown>;
              if (item?.type === 'function_call') {
                if (currentToolId) {
                  toolCalls.push({ id: currentToolId, name: '', args: currentToolArgs });
                }
                currentToolId = item.call_id as string || '';
                currentToolArgs = '';
                stopReason = 'tool_use';
                toolCalls.push({ id: currentToolId, name: item.name as string || '', args: '' });
              }
              break;
            }
            case 'response.function_call_arguments.delta':
              currentToolArgs += (data.delta as string) || '';
              if (toolCalls.length > 0) {
                toolCalls[toolCalls.length - 1].args = currentToolArgs;
              }
              break;
            case 'response.completed': {
              const resp = data.response as Record<string, unknown>;
              if (resp?.usage) {
                const u = resp.usage as Record<string, number>;
                inputTokens = u.input_tokens ?? 0;
                outputTokens = u.output_tokens ?? 0;
              }
              break;
            }
          }
        } catch { /* skip */ }
      }
    }
  }

  const content: Array<Record<string, unknown>> = [];
  if (textContent) content.push({ type: 'text', text: textContent });
  for (const tc of toolCalls) {
    let input: Record<string, unknown> = {};
    try { input = JSON.parse(tc.args || '{}') as Record<string, unknown>; } catch { /* use empty */ }
    content.push({ type: 'tool_use', id: tc.id, name: tc.name, input });
  }

  return {
    id: `msg_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
    type: 'message',
    role: 'assistant',
    content,
    model,
    stop_reason: stopReason === 'tool_use' ? 'tool_use' : 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  };
}

// ─── Messages Endpoint Handler ───────────────────────────────

async function handleMessages(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  config: ProxyConfig,
): Promise<void> {
  const body = await collectBody(req);
  let aReq: ARequest;
  try { aReq = JSON.parse(body) as ARequest; }
  catch { sendError(res, 400, 'Invalid JSON'); return; }

  let auth: ResolvedAuth;
  try { auth = await resolveRequestAuth(); }
  catch (err) { sendError(res, 401, (err as Error).message); return; }

  if (auth.provider === 'chatgpt-pro') {
    // ─── Codex Responses API 경로 ──────────────────────────
    const codexBody = buildCodexRequest(aReq, config.defaultModel);
    const headers = buildCodexHeaders(auth.token, auth.accountId);

    const fetchRes = await fetch(CODEX_RESPONSES_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(codexBody),
    });

    if (!fetchRes.ok) {
      const errText = await fetchRes.text();
      sendError(res, fetchRes.status, `Codex error: ${errText.slice(0, 500)}`);
      return;
    }

    if (aReq.stream) {
      await handleCodexStream(fetchRes, res, aReq.model);
    } else {
      const aResp = await collectCodexResponse(fetchRes, aReq.model);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(aResp));
    }
  } else {
    // ─── Chat Completions API 경로 (기존) ──────────────────
    const oBody = buildORequest(aReq, config.defaultModel);
    const targetUrl = `${auth.baseUrl}/v1/chat/completions`;

    const fetchRes = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(oBody),
    });

    if (!fetchRes.ok) {
      const errText = await fetchRes.text();
      sendError(res, fetchRes.status, `OpenAI error: ${errText.slice(0, 500)}`);
      return;
    }

    if (aReq.stream) {
      await handleStream(fetchRes, res, aReq.model);
    } else {
      const oResp = await fetchRes.json() as Record<string, unknown>;
      const aResp = buildAResponse(oResp, aReq.model);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(aResp));
    }
  }
}

// ─── HTTP Server ─────────────────────────────────────────────

export function createProxyServer(config: ProxyConfig): http.Server {
  return http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const url = req.url || '';
    if (url === '/v1/messages' && req.method === 'POST') {
      try { await handleMessages(req, res, config); }
      catch (err) { sendError(res, 500, (err as Error).message); }
    } else if (url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', port: config.port }));
    } else {
      sendError(res, 404, `Unknown endpoint: ${url}`);
    }
  });
}

// ─── 세션 실행 (프록시 + Claude Code 원샷) ──────────────────

export function launchSession(
  model?: string,
  claudeArgs: string[] = [],
): void {
  const authSource = checkAuthSource();
  if (!authSource) {
    console.error('인증 정보 없음.');
    console.error('  ChatGPT Pro: npm i -g @openai/codex && codex login');
    console.error('  Gemini:      GEMINI_API_KEY 또는 CODEX_PROXY_API_KEY 설정');
    console.error('  OpenAI:      vibe gpt key <key> 또는 OPENAI_API_KEY 설정');
    process.exit(1);
  }

  const settings = getProxySettings();
  const defaultModel = model || process.env.CODEX_PROXY_MODEL || settings.model || 'gpt-4o';
  const config: ProxyConfig = { port: 0, defaultModel };
  const server = createProxyServer(config);

  server.listen(0, '127.0.0.1', () => {
    const addr = server.address() as { port: number };
    const port = addr.port;
    const authLabel = AUTH_SOURCE_LABELS[authSource.source];
    console.log(`Codex Proxy :${port} | ${authLabel} | ${defaultModel}`);

    const child = spawn('claude', ['--dangerously-skip-permissions', ...claudeArgs], {
      stdio: 'inherit',
      env: {
        ...process.env,
        ANTHROPIC_BASE_URL: `http://localhost:${port}`,
        ANTHROPIC_AUTH_TOKEN: 'codex-proxy',
        ANTHROPIC_API_KEY: 'codex-proxy',
        API_TIMEOUT_MS: '3000000',
        ANTHROPIC_DEFAULT_OPUS_MODEL: defaultModel,
        ANTHROPIC_DEFAULT_SONNET_MODEL: defaultModel,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: defaultModel,
      },
    });

    child.on('error', (err) => {
      console.error(`claude 실행 실패: ${err.message}`);
      console.error('Claude Code 설치: npm i -g @anthropic-ai/claude-code');
      server.close();
      process.exit(1);
    });

    child.on('exit', (code) => {
      server.close();
      process.exit(code ?? 0);
    });
  });

  process.on('SIGINT', () => { server.close(); });
  process.on('SIGTERM', () => { server.close(); process.exit(0); });
}

const AUTH_SOURCE_LABELS: Record<string, string> = {
  'codex-cli': 'Codex CLI (ChatGPT Pro)',
  'apikey': 'API Key',
  'env': 'CODEX_PROXY_API_KEY',
};

// ─── 셸 함수 생성 ───────────────────────────────────────────

export function generateShellFunction(model?: string): string {
  if (model) {
    return `codex-cc() { CODEX_PROXY_MODEL="${model}" vibe codex "$@"; }`;
  }
  return `codex-cc() { vibe codex "$@"; }`;
}
