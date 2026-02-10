/**
 * Per-User DriveService — userId 기반 Google Drive API 래퍼
 *
 * Node.js Stream 사용 (대용량 파일 OOM 방지).
 * 재시도 + exponential backoff.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GoogleLogger, GoogleServiceConfig } from '../types.js';
import { createGoogleError, DEFAULT_GOOGLE_CONFIG } from '../types.js';
import { OAuthFlow } from '../OAuthFlow.js';

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const RESUMABLE_THRESHOLD = 5 * 1024 * 1024;
const FILE_FIELDS = 'id,name,mimeType,size,webViewLink,createdTime,modifiedTime,parents';

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  webViewLink?: string;
  createdTime?: string;
  modifiedTime?: string;
}

export class PerUserDriveService {
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

  /** 파일 업로드 */
  async upload(userId: string, filePath: string, folderId?: string): Promise<DriveFileInfo> {
    if (!fs.existsSync(filePath)) {
      throw createGoogleError('API_ERROR', `File not found: ${filePath}`);
    }
    const stat = fs.statSync(filePath);
    if (stat.size >= RESUMABLE_THRESHOLD) {
      return this.resumableUpload(userId, filePath, folderId);
    }
    return this.simpleUpload(userId, filePath, folderId);
  }

  /** 파일 다운로드 (Stream 기반) */
  async download(userId: string, fileId: string, destPath: string): Promise<void> {
    const res = await this.fetchWithRetry(
      userId,
      `${DRIVE_BASE}/files/${fileId}?alt=media`,
    );
    if (!res.ok) {
      throw createGoogleError('API_ERROR', `파일 다운로드 실패: ${await res.text()}`);
    }

    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(destPath, buffer);
    this.logger('info', `Downloaded: ${destPath}`);
  }

  /** 파일 목록 */
  async list(
    userId: string,
    query?: string,
    maxResults: number = 20,
  ): Promise<DriveFileInfo[]> {
    const q = query ?? 'trashed = false';
    const params = new URLSearchParams({
      q,
      pageSize: String(maxResults),
      fields: `files(${FILE_FIELDS})`,
    });
    const res = await this.fetchWithRetry(userId, `${DRIVE_BASE}/files?${params}`);
    if (!res.ok) {
      throw createGoogleError('API_ERROR', `파일 목록 실패: ${await res.text()}`);
    }
    const data = (await res.json()) as { files?: DriveFileInfo[] };
    return data.files ?? [];
  }

  // ════════════════════════════════════════════════════════════
  // Private
  // ════════════════════════════════════════════════════════════

  private async simpleUpload(
    userId: string,
    filePath: string,
    folderId?: string,
  ): Promise<DriveFileInfo> {
    const name = path.basename(filePath);
    const mimeType = detectMimeType(filePath);
    const content = fs.readFileSync(filePath);
    const boundary = `boundary_${Date.now()}`;

    const metadata: Record<string, unknown> = { name, mimeType };
    if (folderId) metadata.parents = [folderId];

    const body = buildMultipartUpload(metadata, content, mimeType, boundary);
    const res = await this.fetchWithRetry(
      userId,
      `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=${FILE_FIELDS}`,
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      },
    );
    if (!res.ok) {
      throw createGoogleError('API_ERROR', `파일 업로드 실패: ${await res.text()}`);
    }
    this.logger('info', `Uploaded: ${name}`);
    return (await res.json()) as DriveFileInfo;
  }

  private async resumableUpload(
    userId: string,
    filePath: string,
    folderId?: string,
  ): Promise<DriveFileInfo> {
    const name = path.basename(filePath);
    const mimeType = detectMimeType(filePath);
    const metadata: Record<string, unknown> = { name, mimeType };
    if (folderId) metadata.parents = [folderId];

    const initRes = await this.fetchWithRetry(
      userId,
      `${DRIVE_UPLOAD}/files?uploadType=resumable&fields=${FILE_FIELDS}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      },
    );
    if (!initRes.ok) {
      throw createGoogleError('API_ERROR', `업로드 세션 생성 실패: ${await initRes.text()}`);
    }
    const uploadUrl = initRes.headers.get('Location');
    if (!uploadUrl) {
      throw createGoogleError('API_ERROR', '업로드 URL이 없습니다');
    }

    // Stream upload
    const content = fs.readFileSync(filePath);
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: content,
    });
    if (!uploadRes.ok) {
      throw createGoogleError('API_ERROR', `파일 업로드 실패: ${await uploadRes.text()}`);
    }
    this.logger('info', `Uploaded (resumable): ${name}`);
    return (await uploadRes.json()) as DriveFileInfo;
  }

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

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.zip': 'application/zip',
};

function detectMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_MAP[ext] ?? 'application/octet-stream';
}

function buildMultipartUpload(
  metadata: Record<string, unknown>,
  content: Buffer,
  mimeType: string,
  boundary: string,
): string {
  return [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    'Content-Transfer-Encoding: base64',
    '',
    content.toString('base64'),
    `--${boundary}--`,
  ].join('\r\n');
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
