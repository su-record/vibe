import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AgentResult, BackgroundAgentArgs, BackgroundAgentHandle } from './types.js';
import { getModelOverride } from '../lib/config/GlobalConfigManager.js';

interface CodexExecArgs {
  projectPath: string;
  outputPath: string;
  model?: string;
}

export function resolveCodexAgentModel(model?: string): string | undefined {
  const override = getModelOverride('gptCodex') ?? process.env.GPT_CODEX_MODEL ?? process.env.CODEX_MODEL;
  if (override) return override;
  if (!model || model.startsWith('claude')) return undefined;
  return model;
}

export function buildCodexExecArgs(options: CodexExecArgs): string[] {
  const args = [
    'exec',
    '--cd',
    options.projectPath,
    '--sandbox',
    'workspace-write',
    '--output-last-message',
    options.outputPath,
  ];
  const model = resolveCodexAgentModel(options.model);
  if (model) args.push('--model', model);
  args.push('-');
  return args;
}

function buildPrompt(args: BackgroundAgentArgs): string {
  const agentName = args.agentName ? `Agent: ${args.agentName}\n\n` : '';
  const tools = args.allowedTools?.length ? `Allowed tool intent: ${args.allowedTools.join(', ')}\n\n` : '';
  const turns = args.maxTurns ? `Max turns: ${args.maxTurns}\n\n` : '';
  return `${agentName}${tools}${turns}${args.prompt}`;
}

function readOutput(outputPath: string, stdout: string, stderr: string): string {
  try {
    if (fs.existsSync(outputPath)) {
      const content = fs.readFileSync(outputPath, 'utf-8').trim();
      if (content) return content;
    }
  } catch {
    // Fall back to captured process output.
  }
  return `${stdout}${stderr ? `\n${stderr}` : ''}`.trim();
}

export function launchCodexBackgroundAgent(args: BackgroundAgentArgs): BackgroundAgentHandle {
  const agentName = args.agentName ?? `codex-agent-${Date.now()}`;
  const projectPath = args.projectPath ?? process.cwd();
  const startTime = Date.now();
  const sessionId = `codex-${startTime}-${Math.random().toString(36).slice(2, 8)}`;
  const outputPath = path.join(os.tmpdir(), `${sessionId}.txt`);
  const codexArgs = buildCodexExecArgs({ projectPath, outputPath, model: args.model });
  let status: BackgroundAgentHandle['status'] = 'running';
  let child: ChildProcessWithoutNullStreams | null = null;
  let stdout = '';
  let stderr = '';

  const resultPromise = new Promise<AgentResult>((resolve) => {
    child = spawn('codex', codexArgs, {
      cwd: projectPath,
      env: { ...process.env, VIBE_HOOK_DEPTH: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', error => {
      status = 'failed';
      resolve({ agentName, sessionId, result: stdout, success: false, error: error.message, duration: Date.now() - startTime });
    });
    child.on('close', code => {
      status = code === 0 ? 'completed' : 'failed';
      const result = readOutput(outputPath, stdout, stderr);
      resolve({ agentName, sessionId, result, success: code === 0, error: code === 0 ? undefined : result, duration: Date.now() - startTime });
    });
    child.stdin.end(buildPrompt(args));
  });

  return {
    sessionId,
    agentName,
    status,
    startTime,
    getResult: () => resultPromise,
    cancel: () => {
      status = 'cancelled';
      child?.kill();
    },
  };
}

export async function runCodexAgentOnce(args: BackgroundAgentArgs): Promise<AgentResult> {
  return launchCodexBackgroundAgent(args).getResult();
}
