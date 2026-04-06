/**
 * Figma REST API 클라이언트
 *
 * native fetch + exponential backoff retry
 */

import { readGlobalConfig } from '../config/GlobalConfigManager.js';

const FIGMA_API = 'https://api.figma.com/v1';
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 2000;

export function loadToken(): string {
  // 1. env
  const envToken = process.env.FIGMA_ACCESS_TOKEN;
  if (envToken) return envToken;

  // 2. ~/.vibe/config.json
  const config = readGlobalConfig();
  const token = config.credentials?.figma?.accessToken;
  if (token) return token;

  throw new Error('Figma token not found. Run: vibe figma setup <token>');
}

export function maskToken(token: string): string {
  if (token.length < 12) return '***';
  return token.slice(0, 6) + '...' + token.slice(-4);
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export async function figmaFetch<T = unknown>(endpoint: string, token: string): Promise<T> {
  const url = `${FIGMA_API}${endpoint}`;
  let lastError: string = '';

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'X-Figma-Token': token },
      });

      if (res.status === 429) {
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }

      if (res.status === 403) {
        throw new Error(`Figma API 403 Forbidden. Token: ${maskToken(token)}`);
      }

      if (res.status === 404) {
        throw new Error('Node not found. Check fileKey/nodeId.');
      }

      if (!res.ok) {
        const body = await res.text();
        lastError = `HTTP ${res.status}: ${body.slice(0, 200)}`;
        if (res.status >= 500) {
          const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }
        throw new Error(lastError);
      }

      return await res.json() as T;
    } catch (err) {
      lastError = (err as Error).message;
      if (lastError.includes('403') || lastError.includes('404')) throw err;
      if (attempt < MAX_RETRIES - 1) {
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }

  throw new Error(`Failed after ${MAX_RETRIES} retries: ${lastError}`);
}
