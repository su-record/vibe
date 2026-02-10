/**
 * Per-User GmailService — userId 기반 Gmail API 래퍼
 *
 * OAuthFlow에서 per-user access token을 받아
 * Google Gmail API를 호출한다.
 * HTML 템플릿 기반 리포트 발송 포함.
 */

import type { GoogleLogger } from '../types.js';
import { createGoogleError, DEFAULT_GOOGLE_CONFIG } from '../types.js';
import type { GoogleServiceConfig } from '../types.js';
import { OAuthFlow } from '../OAuthFlow.js';

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

export interface SendMailOptions {
  to: string;
  subject: string;
  body: string;
  html?: string;
  cc?: string;
  bcc?: string;
}

export interface MailSearchResult {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

export interface ReportData {
  title: string;
  status: 'success' | 'error';
  summary: string;
  details?: string;
  timestamp?: string;
}

export class PerUserGmailService {
  private oauthFlow: OAuthFlow;
  private logger: GoogleLogger;
  private config: Required<GoogleServiceConfig>;

  constructor(oauthFlow: OAuthFlow, logger: GoogleLogger, config?: GoogleServiceConfig) {
    this.oauthFlow = oauthFlow;
    this.logger = logger;
    this.config = {
      apiTimeout: config?.apiTimeout ?? DEFAULT_GOOGLE_CONFIG.apiTimeout,
      maxRetries: config?.maxRetries ?? DEFAULT_GOOGLE_CONFIG.maxRetries,
      refreshMarginMs: config?.refreshMarginMs ?? DEFAULT_GOOGLE_CONFIG.refreshMarginMs,
    };
  }

  /** 메일 발송 */
  async sendEmail(userId: string, options: SendMailOptions): Promise<string> {
    const raw = this.buildRawEmail(options);
    const res = await this.fetchWithRetry(userId, `${GMAIL_BASE}/messages/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });

    if (!res.ok) {
      throw createGoogleError('API_ERROR', `메일 전송 실패: ${await res.text()}`);
    }
    const data = (await res.json()) as { id: string };
    this.logger('info', `Mail sent: ${data.id}`);
    return data.id;
  }

  /** 메일 검색 */
  async searchMail(
    userId: string,
    query: string,
    maxResults: number = 10,
  ): Promise<MailSearchResult[]> {
    const params = new URLSearchParams({
      q: query,
      maxResults: String(maxResults),
    });
    const res = await this.fetchWithRetry(userId, `${GMAIL_BASE}/messages?${params}`);
    if (!res.ok) {
      throw createGoogleError('API_ERROR', `메일 검색 실패: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      messages?: Array<{ id: string; threadId: string }>;
    };
    if (!data.messages?.length) return [];

    return this.fetchSummaries(userId, data.messages.slice(0, maxResults));
  }

  /** 리포트 메일 발송 (HTML 템플릿) */
  async sendReport(userId: string, to: string, report: ReportData): Promise<string> {
    const html = this.buildReportHtml(report);
    return this.sendEmail(userId, {
      to,
      subject: `[VIBE] ${report.title}`,
      body: report.summary,
      html,
    });
  }

  // ════════════════════════════════════════════════════════════
  // Private
  // ════════════════════════════════════════════════════════════

  private async fetchWithRetry(
    userId: string,
    url: string,
    options?: RequestInit,
  ): Promise<Response> {
    const token = await this.oauthFlow.getValidAccessToken(userId);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      ...toHeaderRecord(options?.headers),
    };

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.apiTimeout);

        const res = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.status !== 429 && res.status < 500) return res;

        const retryAfter = Number(res.headers.get('Retry-After')) || Math.pow(2, attempt);
        const jitter = Math.random() * 1000;
        this.logger('warn', `Gmail API ${res.status}, retry ${attempt + 1}/${this.config.maxRetries}`);
        await sleep(retryAfter * 1000 + jitter);
      } catch (err) {
        if (attempt === this.config.maxRetries - 1) {
          throw createGoogleError('API_ERROR',
            'Google 서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.',
            { retries: this.config.maxRetries });
        }
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }

    throw createGoogleError('API_ERROR',
      'Google 서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.',
      { retries: this.config.maxRetries });
  }

  private async fetchSummaries(
    userId: string,
    messages: Array<{ id: string; threadId: string }>,
  ): Promise<MailSearchResult[]> {
    const results: MailSearchResult[] = [];
    for (const { id, threadId } of messages) {
      const res = await this.fetchWithRetry(
        userId,
        `${GMAIL_BASE}/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
      );
      if (!res.ok) continue;
      const msg = (await res.json()) as {
        snippet: string;
        payload: { headers: Array<{ name: string; value: string }> };
      };
      const getHeader = (name: string): string =>
        msg.payload.headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

      results.push({
        id,
        threadId,
        subject: getHeader('Subject'),
        from: getHeader('From'),
        date: getHeader('Date'),
        snippet: msg.snippet,
      });
    }
    return results;
  }

  private buildRawEmail(options: SendMailOptions): string {
    const lines = [
      `To: ${options.to}`,
      `Subject: ${options.subject}`,
    ];
    if (options.cc) lines.push(`Cc: ${options.cc}`);
    if (options.bcc) lines.push(`Bcc: ${options.bcc}`);

    if (options.html) {
      lines.push('Content-Type: text/html; charset=utf-8');
    } else {
      lines.push('Content-Type: text/plain; charset=utf-8');
    }
    lines.push('MIME-Version: 1.0', '', options.html ?? options.body);
    return Buffer.from(lines.join('\r\n')).toString('base64url');
  }

  private buildReportHtml(report: ReportData): string {
    const statusColor = report.status === 'success' ? '#22c55e' : '#ef4444';
    const statusIcon = report.status === 'success' ? '&#10003;' : '&#10007;';
    const timestamp = report.timestamp ?? new Date().toISOString();

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <div style="background:${statusColor};color:white;padding:16px;border-radius:8px 8px 0 0">
    <h2 style="margin:0">${statusIcon} ${report.title}</h2>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:16px;border-radius:0 0 8px 8px">
    <p><strong>Status:</strong> ${report.status}</p>
    <p>${report.summary}</p>
    ${report.details ? `<pre style="background:#f3f4f6;padding:12px;border-radius:4px;overflow-x:auto">${report.details}</pre>` : ''}
    <hr style="border:none;border-top:1px solid #e5e7eb">
    <p style="color:#6b7280;font-size:12px">Generated by VIBE at ${timestamp}</p>
  </div>
</body></html>`;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** HeadersInit → Record<string, string> 안전 변환 */
function toHeaderRecord(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) {
    const record: Record<string, string> = {};
    headers.forEach((value, key) => { record[key] = value; });
    return record;
  }
  if (Array.isArray(headers)) {
    const record: Record<string, string> = {};
    for (const [key, value] of headers) { record[key] = value; }
    return record;
  }
  return headers as Record<string, string>;
}
