/**
 * DriveService - Google Drive API v3 operations
 * Upload, download, search, share files via REST API
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { InterfaceLogger } from '../../interface/types.js';
import { GoogleAuthManager } from './GoogleAuthManager.js';
import { FileMetadata, FolderMetadata, DriveFileListResponse } from './google-types.js';

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const RESUMABLE_THRESHOLD = 5 * 1024 * 1024; // 5MB
const FILE_FIELDS = 'id,name,mimeType,size,webViewLink,createdTime,modifiedTime,parents';

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.zip': 'application/zip',
};

export class DriveService {
  private auth: GoogleAuthManager;
  private logger: InterfaceLogger;

  constructor(auth: GoogleAuthManager, logger: InterfaceLogger) {
    this.auth = auth;
    this.logger = logger;
  }

  /** Upload a file to Drive */
  async upload(filePath: string, folderId?: string): Promise<FileMetadata> {
    const stat = fs.statSync(filePath);
    if (stat.size >= RESUMABLE_THRESHOLD) {
      return this.resumableUpload(filePath, folderId);
    }
    return this.simpleUpload(filePath, folderId);
  }

  /** Download a file from Drive */
  async download(fileId: string, destPath: string): Promise<void> {
    const res = await this.auth.fetchApi(
      `${DRIVE_BASE}/files/${fileId}?alt=media`,
    );
    if (!res.ok) {
      throw new Error(`파일 다운로드 실패: ${await res.text()}`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(destPath, buffer);
    this.logger('info', `파일 다운로드 완료: ${destPath}`);
  }

  /** Create a folder on Drive */
  async createFolder(name: string, parentId?: string): Promise<FolderMetadata> {
    const metadata: Record<string, unknown> = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId) metadata.parents = [parentId];

    const res = await this.auth.fetchApi(`${DRIVE_BASE}/files?fields=id,name,webViewLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata),
    });
    if (!res.ok) {
      throw new Error(`폴더 생성 실패: ${await res.text()}`);
    }
    return (await res.json()) as FolderMetadata;
  }

  /** Search files on Drive */
  async search(query: string, maxResults: number = 20): Promise<FileMetadata[]> {
    const params = new URLSearchParams({
      q: query,
      pageSize: String(maxResults),
      fields: `files(${FILE_FIELDS})`,
    });
    const res = await this.auth.fetchApi(`${DRIVE_BASE}/files?${params}`);
    if (!res.ok) {
      throw new Error(`파일 검색 실패: ${await res.text()}`);
    }
    const data = (await res.json()) as DriveFileListResponse;
    return (data.files ?? []) as unknown as FileMetadata[];
  }

  /** List files in a folder */
  async list(folderId?: string, maxResults: number = 50): Promise<FileMetadata[]> {
    const q = folderId ? `'${folderId}' in parents and trashed = false` : 'trashed = false';
    return this.search(q, maxResults);
  }

  /** Share a file with another user */
  async share(fileId: string, email: string, role: string = 'reader'): Promise<void> {
    const res = await this.auth.fetchApi(
      `${DRIVE_BASE}/files/${fileId}/permissions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'user', role, emailAddress: email }),
      },
    );
    if (!res.ok) {
      throw new Error(`파일 공유 실패: ${await res.text()}`);
    }
    this.logger('info', `파일 공유 완료: ${fileId} → ${email} (${role})`);
  }

  private async simpleUpload(filePath: string, folderId?: string): Promise<FileMetadata> {
    const name = path.basename(filePath);
    const mimeType = this.detectMimeType(filePath);
    const content = fs.readFileSync(filePath);
    const boundary = `boundary_${Date.now()}`;

    const metadata: Record<string, unknown> = { name, mimeType };
    if (folderId) metadata.parents = [folderId];

    const body = this.buildMultipartUpload(metadata, content, mimeType, boundary);
    const res = await this.auth.fetchApi(
      `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=${FILE_FIELDS}`,
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      },
    );
    if (!res.ok) {
      throw new Error(`파일 업로드 실패: ${await res.text()}`);
    }
    this.logger('info', `파일 업로드 완료: ${name}`);
    return (await res.json()) as FileMetadata;
  }

  private async resumableUpload(filePath: string, folderId?: string): Promise<FileMetadata> {
    const name = path.basename(filePath);
    const mimeType = this.detectMimeType(filePath);
    const metadata: Record<string, unknown> = { name, mimeType };
    if (folderId) metadata.parents = [folderId];

    // Step 1: Initiate resumable session
    const initRes = await this.auth.fetchApi(
      `${DRIVE_UPLOAD}/files?uploadType=resumable&fields=${FILE_FIELDS}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      },
    );
    if (!initRes.ok) {
      throw new Error(`업로드 세션 생성 실패: ${await initRes.text()}`);
    }
    const uploadUrl = initRes.headers.get('Location');
    if (!uploadUrl) throw new Error('업로드 URL이 없습니다');

    // Step 2: Upload content
    const content = fs.readFileSync(filePath);
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: content,
    });
    if (!uploadRes.ok) {
      throw new Error(`파일 업로드 실패: ${await uploadRes.text()}`);
    }
    this.logger('info', `대용량 파일 업로드 완료: ${name}`);
    return (await uploadRes.json()) as FileMetadata;
  }

  private buildMultipartUpload(
    metadata: Record<string, unknown>,
    content: Buffer,
    mimeType: string,
    boundary: string,
  ): string {
    const metaJson = JSON.stringify(metadata);
    const parts = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metaJson,
      `--${boundary}`,
      `Content-Type: ${mimeType}`,
      'Content-Transfer-Encoding: base64',
      '',
      content.toString('base64'),
      `--${boundary}--`,
    ];
    return parts.join('\r\n');
  }

  private detectMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return MIME_MAP[ext] ?? 'application/octet-stream';
  }
}
