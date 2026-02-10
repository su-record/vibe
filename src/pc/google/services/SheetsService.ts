/**
 * Per-User SheetsService — userId 기반 Google Sheets API 래퍼
 *
 * 읽기/쓰기/시트 생성 + 재시도.
 */

import type { GoogleLogger, GoogleServiceConfig } from '../types.js';
import { createGoogleError, DEFAULT_GOOGLE_CONFIG } from '../types.js';
import { OAuthFlow } from '../OAuthFlow.js';

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export type CellValue = string | number | boolean | null;

export interface SpreadsheetInfo {
  id: string;
  title: string;
  url: string;
}

export class PerUserSheetsService {
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

  /** 데이터 읽기 */
  async read(userId: string, spreadsheetId: string, range: string): Promise<CellValue[][]> {
    const encodedRange = encodeURIComponent(range);
    const res = await this.fetchWithRetry(
      userId,
      `${SHEETS_BASE}/${spreadsheetId}/values/${encodedRange}`,
    );
    if (!res.ok) {
      throw createGoogleError('API_ERROR', `시트 읽기 실패: ${await res.text()}`);
    }
    const data = (await res.json()) as { values?: CellValue[][] };
    return data.values ?? [];
  }

  /** 데이터 쓰기 */
  async write(
    userId: string,
    spreadsheetId: string,
    range: string,
    values: CellValue[][],
  ): Promise<void> {
    const encodedRange = encodeURIComponent(range);
    const res = await this.fetchWithRetry(
      userId,
      `${SHEETS_BASE}/${spreadsheetId}/values/${encodedRange}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ range, values }),
      },
    );
    if (!res.ok) {
      throw createGoogleError('API_ERROR', `시트 쓰기 실패: ${await res.text()}`);
    }
    this.logger('info', `Sheet write: ${range}`);
  }

  /** 새 시트 생성 */
  async createSheet(userId: string, title: string): Promise<SpreadsheetInfo> {
    const res = await this.fetchWithRetry(userId, SHEETS_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ properties: { title } }),
    });
    if (!res.ok) {
      throw createGoogleError('API_ERROR', `시트 생성 실패: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      spreadsheetId: string;
      properties: { title: string };
      spreadsheetUrl: string;
    };
    return { id: data.spreadsheetId, title: data.properties.title, url: data.spreadsheetUrl };
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
        const res = await fetch(url, { ...options, headers, signal: controller.signal });
        clearTimeout(timeout);

        if (res.status !== 429 && res.status < 500) return res;
        const retryAfter = Number(res.headers.get('Retry-After')) || Math.pow(2, attempt);
        await sleep(retryAfter * 1000 + Math.random() * 1000);
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
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
