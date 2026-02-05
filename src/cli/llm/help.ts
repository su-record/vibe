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

Kimi Commands:
  vibe kimi key <KEY>     API key (Moonshot)
  vibe kimi status        Check status
  vibe kimi logout        Remove key

Examples:
  vibe gpt auth           OpenAI login
  vibe gemini auth        Google login
  vibe gpt key sk-xxx     API key setup
  vibe kimi key sk-xxx    Moonshot API key
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
  vibe kimi logout      Kimi logout
  `);
}
