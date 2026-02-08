/**
 * web_browse Tool - URL 내용 읽기 (SSRF 방지)
 * Phase 3: Function Calling Tool Definitions
 *
 * 보안:
 * - Scheme/Port 제한: http/https, 80/443만 허용
 * - Private IP 차단: 10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x, ::1
 * - 메타데이터 IP 차단: 169.254.169.254
 * - Redirect: 수동 루프, 각 hop마다 IP 재검증 (최대 3회)
 */

import * as dns from 'node:dns/promises';
import { z } from 'zod';
import type { ToolRegistrationInput } from '../ToolRegistry.js';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const MAX_RESPONSE_SIZE = 50_000; // 50KB text

export const webBrowseSchema = z.object({
  url: z.string().url().describe('URL to fetch'),
  extractMode: z.enum(['text', 'summary']).optional().describe('Extract mode: text or summary (default: text)'),
});

// === SSRF Protection ===

function isPrivateIP(ip: string): boolean {
  // IPv4 private ranges
  if (/^10\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^127\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;
  if (ip === '0.0.0.0') return true;

  // IPv6 private ranges
  if (ip === '::1') return true;
  if (/^fc/i.test(ip) || /^fd/i.test(ip)) return true;
  if (/^fe8/i.test(ip) || /^fe9/i.test(ip) || /^fea/i.test(ip) || /^feb/i.test(ip)) return true;

  // AWS/GCP metadata
  if (ip === '169.254.169.254') return true;

  return false;
}

function validateUrl(urlStr: string): URL {
  const parsed = new URL(urlStr);

  // Scheme check
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Blocked scheme: ${parsed.protocol} (only http/https allowed)`);
  }

  // Port check
  const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
  if (port !== '80' && port !== '443') {
    throw new Error(`Blocked port: ${port} (only 80/443 allowed)`);
  }

  return parsed;
}

async function resolveAndValidate(hostname: string): Promise<void> {
  try {
    const addresses = await dns.resolve4(hostname);
    for (const addr of addresses) {
      if (isPrivateIP(addr)) {
        throw new Error(`Private IP access blocked: ${addr}`);
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('Private IP')) throw err;
    // DNS resolution might fail for some domains; allow fetch to handle
  }

  try {
    const addresses6 = await dns.resolve6(hostname);
    for (const addr of addresses6) {
      if (isPrivateIP(addr)) {
        throw new Error(`Private IPv6 access blocked: ${addr}`);
      }
    }
  } catch {
    // IPv6 resolution failure is OK
  }
}

async function safeFetch(urlStr: string, redirectCount = 0): Promise<string> {
  if (redirectCount > MAX_REDIRECTS) {
    throw new Error(`Too many redirects (max ${MAX_REDIRECTS})`);
  }

  const parsed = validateUrl(urlStr);
  await resolveAndValidate(parsed.hostname);

  const response = await fetch(urlStr, {
    redirect: 'manual',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'User-Agent': 'VIBE-Agent/1.0' },
  });

  // Handle redirects manually
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (!location) throw new Error('Redirect without Location header');
    const redirectUrl = new URL(location, urlStr).toString();
    return safeFetch(redirectUrl, redirectCount + 1);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const text = await response.text();
  if (text.length > MAX_RESPONSE_SIZE) {
    return text.substring(0, MAX_RESPONSE_SIZE) + '\n\n[...truncated]';
  }
  return text;
}

// === Tool Handler ===

async function handleWebBrowse(args: Record<string, unknown>): Promise<string> {
  const { url } = args as z.infer<typeof webBrowseSchema>;

  try {
    const rawContent = await safeFetch(url);

    // Basic HTML tag stripping for text mode
    const textContent = rawContent
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return textContent || '(empty page)';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Browse failed: ${msg}`;
  }
}

export const webBrowseTool: ToolRegistrationInput = {
  name: 'web_browse',
  description: 'Fetch and read web page content from a URL (with SSRF protection)',
  schema: webBrowseSchema,
  handler: handleWebBrowse,
  scope: 'read',
};

export { isPrivateIP, validateUrl };
