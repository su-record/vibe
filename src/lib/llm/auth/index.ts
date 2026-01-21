/**
 * LLM Auth Module - Centralized authentication management
 */

export * from './ConfigManager.js';
export * from './ApiKeyManager.js';

import type { AuthInfo, LLMProvider } from '../types.js';
import { getApiKey } from './ApiKeyManager.js';
import { getOAuthTokenPath, readJsonConfig } from './ConfigManager.js';

interface OAuthTokens {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  email?: string;
  projectId?: string;
}

/**
 * Get authentication info for a provider
 * Prioritizes OAuth over API key
 */
export async function getAuthInfo(
  provider: LLMProvider,
  getValidAccessToken?: () => Promise<{ accessToken: string; email?: string; projectId?: string } | null>
): Promise<AuthInfo> {
  // Try OAuth first if token getter is provided
  if (getValidAccessToken) {
    try {
      const oauthResult = await getValidAccessToken();
      if (oauthResult?.accessToken) {
        return {
          type: 'oauth',
          accessToken: oauthResult.accessToken,
          email: oauthResult.email,
          projectId: oauthResult.projectId,
        };
      }
    } catch {
      // Fall through to API key
    }
  }

  // Check for stored OAuth tokens
  const tokenPath = getOAuthTokenPath(provider);
  const tokens = readJsonConfig<OAuthTokens>(tokenPath);
  if (tokens?.access_token && tokens.expires_at && tokens.expires_at > Date.now()) {
    return {
      type: 'oauth',
      accessToken: tokens.access_token,
      email: tokens.email,
      projectId: tokens.projectId,
    };
  }

  // Fall back to API key
  const apiKey = getApiKey(provider);
  if (apiKey) {
    return {
      type: 'apikey',
      apiKey,
    };
  }

  // No auth available
  const providerName = provider === 'gpt' ? 'GPT' : 'Gemini';
  throw new Error(
    `${providerName} not configured. Run 'vibe ${provider} auth' to set up authentication.`
  );
}

/**
 * Check if a provider has any authentication configured
 */
export function hasAuth(provider: LLMProvider): boolean {
  // Check API key
  const apiKey = getApiKey(provider);
  if (apiKey) return true;

  // Check OAuth tokens
  const tokenPath = getOAuthTokenPath(provider);
  const tokens = readJsonConfig<OAuthTokens>(tokenPath);
  if (tokens?.access_token || tokens?.refresh_token) return true;

  return false;
}

/**
 * Remove email from config if no valid token exists
 * Used for cleanup after token expiration
 */
export function removeEmailFromConfigIfNoToken(provider: LLMProvider): void {
  const tokenPath = getOAuthTokenPath(provider);
  const tokens = readJsonConfig<OAuthTokens>(tokenPath);

  if (tokens && !tokens.access_token && !tokens.refresh_token) {
    // Clear the tokens file but keep the directory
    const { email, projectId, ...rest } = tokens;
    if (Object.keys(rest).length === 0) {
      // File is essentially empty, can be removed
    }
  }
}
