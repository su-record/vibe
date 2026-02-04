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
  su-core gpt auth           OAuth (Plus/Pro subscription)
  su-core gpt key <KEY>      API key

Gemini Commands:
  su-core gemini auth        OAuth (free with Advanced)
  su-core gemini key <KEY>   API key

Examples:
  su-core gpt auth           OpenAI login
  su-core gemini auth        Google login
  su-core gpt key sk-xxx     API key setup
  `);
}

/**
 * Logout help (legacy - now shows new format)
 */
export function showLogoutHelp(): void {
  console.log(`
🚪 LLM Logout

Usage:
  su-core gpt logout       GPT logout
  su-core gemini logout    Gemini logout
  `);
}
