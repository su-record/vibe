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

Gemini Commands:
  vibe gemini key <KEY>   API key
  vibe gemini status      Check status

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
  vibe gemini logout    Gemini logout
  `);
}
