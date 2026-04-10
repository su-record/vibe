/**
 * Codex Proxy — Anthropic Messages API → OpenAI Chat Completions API
 * Claude Code에서 OpenAI 호환 모델을 백엔드로 사용하는 로컬 프록시
 */

import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { getVibeDir } from './config/GlobalConfigManager.js';
import { getApiKeyFromConfig } from './gpt/auth.js';

// ─── Constants ───────────────────────────────────────────────

const PID_FILE = 'codex-proxy.pid';
const PORT_FILE = 'codex-proxy.port';
const LOG_FILE = 'codex-proxy.log';
const DEFAULT_PORT = 8317;
const DEFAULT_TARGET_URL = 'https://api.openai.com';
const __curFilename = fileURLToPath(import.meta.url);
const CLI_ENTRY = path.resolve(path.dirname(__curFilename), '../../cli/index.js');

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
  targetUrl: string;
  apiKey: string;
  defaultModel?: string;
}

export interface ProxyStatus {
  running: boolean;
  pid?: number;
  port?: number;
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

// ─── API Config Resolution ──────────────────────────────────

export function resolveApiConfig(): { apiKey: string; baseUrl: string } | null {
  const apiKey = process.env.CODEX_PROXY_API_KEY
    || process.env.OPENAI_API_KEY
    || getApiKeyFromConfig();
  if (!apiKey) return null;
  return { apiKey, baseUrl: process.env.CODEX_PROXY_TARGET_URL || DEFAULT_TARGET_URL };
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

  const oBody = buildORequest(aReq, config.defaultModel);
  const targetUrl = `${config.targetUrl}/v1/chat/completions`;

  const fetchRes = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
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

// ─── PID File Management ─────────────────────────────────────

function savePidFiles(port: number, pid: number): void {
  const dir = getVibeDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, PID_FILE), String(pid));
  fs.writeFileSync(path.join(dir, PORT_FILE), String(port));
}

function cleanupPidFiles(): void {
  const dir = getVibeDir();
  try { fs.unlinkSync(path.join(dir, PID_FILE)); } catch { /* ignore */ }
  try { fs.unlinkSync(path.join(dir, PORT_FILE)); } catch { /* ignore */ }
}

// ─── Start Proxy (Foreground) ────────────────────────────────

export function startProxy(port: number, daemon: boolean): void {
  const apiConfig = resolveApiConfig();
  if (!apiConfig) {
    console.error('No OpenAI API key found.');
    console.error('Set OPENAI_API_KEY env var or run: vibe gpt key <key>');
    process.exit(1);
  }

  if (daemon) { startDaemon(port); return; }

  const config: ProxyConfig = {
    port, targetUrl: apiConfig.baseUrl, apiKey: apiConfig.apiKey,
    defaultModel: process.env.CODEX_PROXY_MODEL,
  };
  const server = createProxyServer(config);
  server.listen(port, () => {
    console.log(`\n  Codex Proxy listening on http://localhost:${port}`);
    console.log(`  Target: ${config.targetUrl}`);
    console.log(`  Model: ${config.defaultModel || '(pass-through)'}\n`);
    savePidFiles(port, process.pid);
  });
  process.on('SIGINT', () => { cleanupPidFiles(); process.exit(0); });
  process.on('SIGTERM', () => { cleanupPidFiles(); process.exit(0); });
}

// ─── Start Proxy (Daemon) ────────────────────────────────────

function startDaemon(port: number): void {
  const dir = getVibeDir();
  fs.mkdirSync(dir, { recursive: true });
  const logPath = path.join(dir, LOG_FILE);
  const logFd = fs.openSync(logPath, 'a');

  const child = spawn(process.execPath, [CLI_ENTRY], {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: {
      ...process.env,
      VIBE_CODEX_PROXY_MODE: '1',
      VIBE_CODEX_PROXY_PORT: String(port),
    },
  });
  child.unref();
  fs.closeSync(logFd);

  savePidFiles(port, child.pid!);
  console.log(`\n  Codex Proxy started (daemon)`);
  console.log(`  PID: ${child.pid}`);
  console.log(`  Port: ${port}`);
  console.log(`  Log: ${logPath}\n`);
}

// ─── Stop Proxy ──────────────────────────────────────────────

export function stopProxy(): boolean {
  const dir = getVibeDir();
  const pidPath = path.join(dir, PID_FILE);
  try {
    const pid = parseInt(fs.readFileSync(pidPath, 'utf-8').trim(), 10);
    process.kill(pid, 'SIGTERM');
    cleanupPidFiles();
    console.log(`Codex Proxy stopped (PID: ${pid})`);
    return true;
  } catch {
    console.log('Codex Proxy is not running');
    cleanupPidFiles();
    return false;
  }
}

// ─── Proxy Status ────────────────────────────────────────────

export function getProxyStatus(): ProxyStatus {
  const dir = getVibeDir();
  try {
    const pid = parseInt(fs.readFileSync(path.join(dir, PID_FILE), 'utf-8').trim(), 10);
    const port = parseInt(fs.readFileSync(path.join(dir, PORT_FILE), 'utf-8').trim(), 10);
    process.kill(pid, 0);
    return { running: true, pid, port };
  } catch {
    return { running: false };
  }
}

// ─── Shell Function Generator ────────────────────────────────

export function generateShellFunction(port: number, model: string): string {
  return `# Add to ~/.zshrc or ~/.bashrc
codex-cc() {
    export ANTHROPIC_BASE_URL="http://localhost:${port}"
    export ANTHROPIC_API_KEY="codex-proxy"
    export ANTHROPIC_DEFAULT_SONNET_MODEL="${model}"
    export ANTHROPIC_DEFAULT_HAIKU_MODEL="${model}"
    claude "$@"
}`;
}

// ─── Daemon Entry Point ──────────────────────────────────────

export function runProxyServer(): void {
  const port = parseInt(process.env.VIBE_CODEX_PROXY_PORT || String(DEFAULT_PORT), 10);
  startProxy(port, false);
}
