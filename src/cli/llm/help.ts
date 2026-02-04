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
  vibe gpt auth           OAuth (Plus/Pro subscription)
  vibe gpt key <KEY>      API key

Gemini Commands:
  vibe gemini auth        OAuth (free with Advanced)
  vibe gemini key <KEY>   API key

Examples:
  vibe gpt auth           OpenAI login
  vibe gemini auth        Google login
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
