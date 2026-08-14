import fs from 'fs';

function parseJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function normalizeHookPayload(stdinData = '', env = process.env) {
  const stdinPayload = parseJson(stdinData);
  if (stdinPayload) return asObject(stdinPayload);

  const hookPayload = parseJson(env.HOOK_INPUT || '');
  if (hookPayload) return asObject(hookPayload);

  const toolInput = parseJson(env.TOOL_INPUT || '');
  if (toolInput) return { tool_input: asObject(toolInput) };

  return {};
}

export function readStdinSync() {
  try {
    if (process.stdin.isTTY) return '';
    const chunks = [];
    const buffer = Buffer.alloc(65536);
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(0, buffer, 0, buffer.length, null);
      if (bytesRead > 0) chunks.push(buffer.subarray(0, bytesRead));
    } while (bytesRead === buffer.length);
    return Buffer.concat(chunks).toString('utf-8');
  } catch {
    return '';
  }
}

export function readHookPayloadSync() {
  return normalizeHookPayload(readStdinSync(), process.env);
}

export function extractToolInput(payload) {
  const fallbackInput = payload?.input && typeof payload.input === 'object' ? payload.input : {};
  const input = payload?.tool_input ?? payload?.toolInput ?? fallbackInput;
  if (typeof input === 'string') return asObject(parseJson(input));
  return asObject(input);
}

export function extractToolName(payload, fallback = '') {
  const name = payload?.tool_name ?? payload?.toolName ?? payload?.tool;
  return typeof name === 'string' ? name : fallback;
}

export function extractPrompt(payload) {
  const prompt = payload?.prompt ?? payload?.user_prompt ?? payload?.input;
  return typeof prompt === 'string' ? prompt : '';
}
