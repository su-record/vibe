/**
 * LLM 도움말
 */

/**
 * Auth help (legacy - now shows new format)
 */
export function showAuthHelp(): void {
  console.log(`
🔐 LLM Authentication

GPT Commands:
  vibe gpt key <KEY>      API key
  vibe gpt status         Check status
  codex auth              Codex CLI authentication

Antigravity Commands:
  vibe antigravity key <KEY>   API key
  vibe antigravity status      Check status

Examples:
  codex auth              Codex CLI login
  vibe gpt key sk-xxx     API key setup
  `);
}

/**
 * Logout help (legacy - now shows new format)
 */
export function showLogoutHelp(): void {
  console.log(`
🚪 LLM Logout

Usage:
  vibe gpt logout       GPT logout
  vibe antigravity logout    Antigravity logout
  `);
}
