/** Which client called us — the first column of the ledger. Unknown stays unknown; no guessing. */
export function detectClient(env: NodeJS.ProcessEnv = process.env): string {
  if (env['VIBE_CLIENT']) return env['VIBE_CLIENT'];
  if (env['CLAUDECODE'] || env['CLAUDE_CODE_ENTRYPOINT'] || env['CLAUDE_PROJECT_DIR']) return 'claude-code';
  if (env['CODEX_SANDBOX'] || env['CODEX_HOME'] || env['CODEX_THREAD_ID']) return 'codex';
  if (env['CHATGPT_DESKTOP']) return 'chatgpt';
  return 'unknown';
}

export function detectModel(env: NodeJS.ProcessEnv = process.env): string | null {
  return env['VIBE_MODEL'] ?? env['ANTHROPIC_MODEL'] ?? env['CLAUDE_MODEL'] ?? env['CODEX_MODEL'] ?? null;
}
