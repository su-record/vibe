import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from 'node:child_process';
import { executionShell } from './inspect.js';
import { outputCapture } from './output-capture.js';

export type OutputObserver = (stream: 'stdout' | 'stderr', bytes: Buffer) => boolean;

export function checkProcess(command: string, options: { cwd: string; timeoutMs: number; input?: string; args?: string[]; env?: NodeJS.ProcessEnv; onOutput?: OutputObserver }) {
  const spawnOptions: SpawnOptionsWithoutStdio = { cwd: options.cwd, env: options.env ?? { ...process.env, VIBE_CHECK: '1' }, shell: options.args ? process.platform === 'win32' : executionShell() };
  const child = options.args ? spawn(command, options.args, spawnOptions) : spawn(command, spawnOptions);
  return observe(child, options.timeoutMs, options.input ?? '', options.onOutput);
}

function observe(child: ChildProcessWithoutNullStreams, timeoutMs: number, input: string, onOutput?: OutputObserver) {
  const streams = outputCapture();
  const started = Date.now();
  type Result = ReturnType<typeof streams.finish> & { exit: number | null; signal: string | null; ms: number; failureCode: string | null; cleanupUncertain: boolean };
  return new Promise<Result>((resolve) => {
    let failureCode: string | null = null, settled = false, grace: ReturnType<typeof setTimeout> | undefined;
    const finish = (exit: number | null, signal: string | null, closed: boolean): void => {
      if (settled) return; settled = true; clearTimeout(timer); clearTimeout(grace);
      if (!closed) { child.stdout.destroy(); child.stderr.destroy(); child.stdin.destroy(); child.unref(); }
      resolve({ ...streams.finish(closed && failureCode === null), exit, signal, ms: Date.now() - started, failureCode, cleanupUncertain: failureCode !== null });
    };
    const stop = (code: string): void => {
      if (failureCode) return; failureCode = code; child.kill('SIGKILL');
      grace = setTimeout(() => finish(null, 'SIGKILL', false), 1000);
    };
    const timer = setTimeout(() => stop('timeout'), timeoutMs);
    for (const name of ['stdout', 'stderr'] as const) child[name].on('data', (chunk: Buffer) => {
      if (settled) return;
      const overflow = streams.add(name, chunk);
      if (onOutput?.(name, chunk) || overflow) stop('capture-overflow');
    });
    child.on('error', () => { failureCode = 'spawn-error'; finish(null, null, false); });
    child.on('close', (exit, signal) => finish(exit, signal, true));
    // A command may deliberately ignore stdin. EPIPE does not replace its exit verdict.
    child.stdin.on('error', () => undefined);
    child.stdin.end(input);
  });
}
