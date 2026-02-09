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
import * as http from 'node:http';
import * as https from 'node:https';
import type { ToolDefinition, JsonSchema } from '../types.js';

const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const MAX_RESPONSE_SIZE = 50_000; // 50KB text
const MAX_BODY_BUFFER = MAX_RESPONSE_SIZE * 2; // 응답 스트리밍 중 메모리 제한

const webBrowseParameters: JsonSchema = {
  type: 'object',
  properties: {
    url: { type: 'string', description: 'URL to fetch' },
    extractMode: {
      type: 'string',
      enum: ['text', 'summary'],
      description: 'Extract mode: text or summary (default: text)',
    },
  },
  required: ['url'],
};

// === SSRF Protection ===

export function isPrivateIP(ip: string): boolean {
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

export function validateUrl(urlStr: string): URL {
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

/**
 * DNS를 해석하고 모든 주소가 public IP인지 검증한 뒤, 첫 번째 safe IP 반환.
 * DNS rebinding 방지: 반환된 IP를 직접 연결에 사용하여 TOCTOU 제거.
 */
export async function resolveToSafeIP(hostname: string): Promise<string> {
  // IPv4
  try {
    const addrs = await dns.resolve4(hostname);
    for (const addr of addrs) {
      if (isPrivateIP(addr)) throw new Error(`Private IP access blocked: ${addr}`);
    }
    if (addrs.length > 0) return addrs[0];
  } catch (err) {
    if (err instanceof Error && err.message.includes('Private IP')) throw err;
  }

  // IPv6 fallback
  try {
    const addrs = await dns.resolve6(hostname);
    for (const addr of addrs) {
      if (isPrivateIP(addr)) throw new Error(`Private IPv6 access blocked: ${addr}`);
    }
    if (addrs.length > 0) return addrs[0];
  } catch (err) {
    if (err instanceof Error && err.message.includes('Private IP')) throw err;
  }

  throw new Error(`DNS resolution failed for ${hostname}`);
}

/**
 * 검증된 IP로 직접 HTTP(S) 요청. DNS를 재해석하지 않으므로 rebinding 불가.
 * - hostname → resolvedIP로 연결
 * - Host 헤더 → 원래 hostname (virtual hosting)
 * - servername → 원래 hostname (TLS SNI + 인증서 검증)
 */
function pinnedRequest(
  parsed: URL,
  resolvedIP: string,
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? https : http;
    const port = parsed.port || (isHttps ? '443' : '80');

    const options: https.RequestOptions = {
      hostname: resolvedIP,
      port: Number(port),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: { 'User-Agent': 'VIBE-Agent/1.0', Host: parsed.host },
      timeout: FETCH_TIMEOUT_MS,
      ...(isHttps ? { servername: parsed.hostname } : {}),
    };

    const req = mod.request(options, (res) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;
      res.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;
        if (totalSize <= MAX_BODY_BUFFER) chunks.push(chunk);
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Fetch timed out')); });
    req.end();
  });
}

async function safeFetch(urlStr: string, redirectCount = 0): Promise<string> {
  if (redirectCount > MAX_REDIRECTS) {
    throw new Error(`Too many redirects (max ${MAX_REDIRECTS})`);
  }

  const parsed = validateUrl(urlStr);
  const resolvedIP = await resolveToSafeIP(parsed.hostname);
  const { statusCode, headers, body } = await pinnedRequest(parsed, resolvedIP);

  // Handle redirects — 각 hop마다 resolveToSafeIP로 재검증
  if (statusCode >= 300 && statusCode < 400) {
    const location = headers.location;
    if (!location) throw new Error('Redirect without Location header');
    const redirectUrl = new URL(location, urlStr).toString();
    return safeFetch(redirectUrl, redirectCount + 1);
  }

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(`HTTP ${statusCode}`);
  }

  if (body.length > MAX_RESPONSE_SIZE) {
    return body.substring(0, MAX_RESPONSE_SIZE) + '\n\n[...truncated]';
  }
  return body;
}

// === Tool Handler ===

async function handleWebBrowse(args: Record<string, unknown>): Promise<string> {
  const { url } = args as { url: string; extractMode?: 'text' | 'summary' };

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

export const webBrowseTool: ToolDefinition = {
  name: 'web_browse',
  description: 'Fetch and read web page content from a URL (with SSRF protection)',
  parameters: webBrowseParameters,
  handler: handleWebBrowse,
  scope: 'read',
};
