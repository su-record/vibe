/** Which client called us — the first column of the ledger. Unknown stays unknown; no guessing. */
export function detectClient(env: NodeJS.ProcessEnv = process.env): string {
  if (env['VIBE_CLIENT']) return env['VIBE_CLIENT'];
  if (env['CLAUDECODE'] || env['CLAUDE_CODE_ENTRYPOINT'] || env['CLAUDE_PROJECT_DIR']) return 'claude-code';
  if (env['CODEX_SANDBOX'] || env['CODEX_HOME'] || env['CODEX_THREAD_ID']) return 'codex';
  if (env['CHATGPT_DESKTOP']) return 'chatgpt';
  return 'unknown';
}

/** Bench arms: VIBE_HARNESS=on|off says whether the agent worked with the vibe card and skills. */
export function detectHarness(): 'on' | 'off' | null {
  const v = process.env['VIBE_HARNESS'];
  return v === 'on' || v === 'off' ? v : null;
}

function envNumber(name: string): number | null {
  const v = process.env[name];
  if (v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Turns and cost are the client's numbers, passed in by whoever ran the agent (VIBE_TURNS, VIBE_COST_USD). */
export function reportedTurns(): number | null {
  return envNumber('VIBE_TURNS');
}
export function reportedCostUsd(): number | null {
  return envNumber('VIBE_COST_USD');
}

export function detectModel(env: NodeJS.ProcessEnv = process.env): string | null {
  return env['VIBE_MODEL'] ?? env['ANTHROPIC_MODEL'] ?? env['CLAUDE_MODEL'] ?? env['CODEX_MODEL'] ?? null;
}
