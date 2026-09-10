import { spawn } from 'node:child_process';
import fs from 'node:fs';

const zero = () => ({ input: 0, cacheRead: 0, cacheWrite: 0, output: 0 });
export const weightedInput = (tokens) => tokens.input + 0.1 * tokens.cacheRead + 1.25 * tokens.cacheWrite;
export const rawTokens = (tokens) => Object.values(tokens).reduce((sum, value) => sum + value, 0);
export function addTokens(entries) {
  if (!entries.length || entries.some((entry) => !entry || Object.keys(zero()).some((key) => !Number.isFinite(entry[key]) || entry[key] < 0))) return null;
  return entries.reduce((sum, entry) => {
    for (const key of Object.keys(sum)) sum[key] += entry[key];
    return sum;
  }, zero());
}

function usage(input, cached, written, output) {
  if (![input, cached, written, output].every((n) => Number.isFinite(n) && n >= 0)) return null;
  return { input, cacheRead: cached, cacheWrite: written, output };
}

export function parseEvents(client, stdout) {
  const parsed = { finalText: '', tokens: null, model: null, costUsd: null, toolCalls: [], errors: [] };
  const turns = [];
  for (const line of stdout.split('\n')) {
    let event;
    try { event = JSON.parse(line); } catch { continue; }
    if (client === 'claude') parseClaude(event, parsed);
    else parseCodex(event, parsed, turns);
  }
  if (client === 'codex') parsed.tokens = addTokens(turns);
  return parsed;
}

function parseClaude(event, parsed) {
  if (event.type === 'assistant') {
    for (const block of event.message?.content ?? []) {
      if (block.type === 'tool_use') parsed.toolCalls.push({ name: block.name, input: block.input });
    }
  }
  if (event.type !== 'result') return;
  parsed.finalText = typeof event.result === 'string' ? event.result : '';
  parsed.costUsd = typeof event.total_cost_usd === 'number' ? event.total_cost_usd : null;
  if (event.is_error) parsed.errors.push(parsed.finalText || event.subtype || 'client result error');
  const models = Object.entries(event.modelUsage ?? {});
  parsed.models = models.map(([model, u]) => ({ model, tokens: usage(u.inputTokens, u.cacheReadInputTokens ?? 0, u.cacheCreationInputTokens ?? 0, u.outputTokens) }));
  parsed.model = models.length === 1 ? models[0][0] : null;
  // The per-model totals include auxiliary models; selecting just the largest loses paid usage.
  parsed.tokens = addTokens(parsed.models.map((entry) => entry.tokens));
  if (!models.length && event.usage) {
    const u = event.usage;
    parsed.tokens = usage(u.input_tokens, u.cache_read_input_tokens ?? 0, u.cache_creation_input_tokens ?? 0, u.output_tokens);
  }
}

function parseCodex(event, parsed, turns) {
  if (event.type === 'error' || event.type === 'turn.failed') parsed.errors.push(event.message ?? event.error?.message ?? event.type);
  if (event.type === 'turn.completed') {
    const u = event.usage ?? {};
    const cached = u.cached_input_tokens ?? 0;
    turns.push(cached > u.input_tokens ? null : usage(u.input_tokens - cached, cached, u.cache_write_input_tokens ?? 0, u.output_tokens));
  }
  if (event.type !== 'item.completed') return;
  const item = event.item ?? {};
  if (item.type === 'agent_message') parsed.finalText = item.text ?? '';
  else parsed.toolCalls.push({ name: item.type, input: item.command ?? item });
}

export function clientArgs(client, settings, workspace, harness) {
  if (client === 'claude') return ['-p', '--output-format', 'stream-json', '--verbose',
    '--dangerously-skip-permissions', '--max-turns', String(settings.maxTurns),
    '--setting-sources', harness === 'off' ? '' : 'project,local', '--strict-mcp-config',
    '--model', settings.model, ...(settings.effort ? ['--effort', settings.effort] : [])];
  return ['exec', '--skip-git-repo-check', '--dangerously-bypass-approvals-and-sandbox',
    '--dangerously-bypass-hook-trust', '--json', '-C', workspace, '-m', settings.model,
    ...(settings.effort ? ['-c', `model_reasoning_effort=${JSON.stringify(settings.effort)}`] : []), '-'];
}

/** Stream bytes to durable files. Nonzero exit and missing usage remain evidence, regardless of wording. */
export async function runClient({ client, settings, workspace, harness, env, prompt, timeoutMs, log }) {
  const started = Date.now();
  const result = await capture(client, clientArgs(client, settings, workspace, harness), { workspace, env, prompt, timeoutMs, log });
  const parsed = parseEvents(client, fs.readFileSync(`${log}.stdout`, 'utf8'));
  const error = result.error ?? (result.exit !== 0 ? `client exited ${result.exit} (${result.signal ?? 'no signal'})` : parsed.errors.join('; ') || null);
  return { ...parsed, requestedModel: settings.model, settings, ...result, error,
    ms: Date.now() - started, usage: parsed.tokens ? 'captured' : 'missing', log };
}

async function capture(command, args, { workspace, env, prompt, timeoutMs, log }) {
  const { shellArgs } = await import('../../dist/core/readerSession.js');
  return new Promise((resolve) => {
    const stdout = fs.openSync(`${log}.stdout`, 'wx');
    const stderr = fs.openSync(`${log}.stderr`, 'wx');
    const child = spawn(command, shellArgs(args), { cwd: workspace, env, shell: process.platform === 'win32', stdio: ['pipe', stdout, stderr] });
    let error = null;
    const timer = setTimeout(() => { error = 'client timeout'; child.kill('SIGKILL'); }, timeoutMs);
    child.on('error', (err) => { error = `client could not start: ${err.message}`; });
    child.on('close', (exit, signal) => {
      clearTimeout(timer); fs.closeSync(stdout); fs.closeSync(stderr);
      resolve({ exit, signal, error });
    });
    child.stdin.on('error', () => undefined);
    child.stdin.end(prompt);
  });
}
