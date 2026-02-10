/**
 * vibe sync — Google Drive AppData API (upload/download)
 */

import { getSyncAccessToken } from './oauth.js';
import { SYNC_FILE_AUTH, SYNC_FILE_MEMORY } from './constants.js';

const DRIVE_FILES_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

async function getAccessToken(): Promise<string> {
  return getSyncAccessToken();
}

/**
 * AppData 폴더 내 파일 목록 조회 (name으로 필터)
 */
export async function findAppDataFile(name: string): Promise<{ id: string } | null> {
  const token = await getAccessToken();
  const url = `${DRIVE_FILES_URL}?spaces=appDataFolder&q=${encodeURIComponent("name='" + name + "'")}&fields=files(id,name)`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive list failed: ${await res.text()}`);
  const data = (await res.json()) as { files: { id: string; name: string }[] };
  const file = data.files?.[0];
  return file ? { id: file.id } : null;
}

/**
 * AppData에 파일 업로드 (없으면 생성, 있으면 PATCH 덮어쓰기)
 */
export async function uploadAppDataFile(name: string, body: Buffer): Promise<void> {
  const token = await getAccessToken();
  const existing = await findAppDataFile(name);

  const metadata = {
    name,
    parents: ['appDataFolder'],
  };

  const boundary = '-------vibe-sync-multipart';
  const metaJson = JSON.stringify(metadata);
  const parts = [
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metaJson}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`, 'utf8'),
    body,
    Buffer.from(`\r\n--${boundary}--`, 'utf8'),
  ];
  const multipartBody = Buffer.concat(parts);

  if (existing) {
    const res = await fetch(
      `${DRIVE_UPLOAD_URL}/${existing.id}?uploadType=multipart`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );
    if (!res.ok) throw new Error(`Drive update failed: ${await res.text()}`);
    return;
  }

  const res = await fetch(`${DRIVE_UPLOAD_URL}?uploadType=multipart`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });
  if (!res.ok) throw new Error(`Drive upload failed: ${await res.text()}`);
}

/**
 * AppData에서 파일 다운로드
 */
export async function downloadAppDataFile(name: string): Promise<Buffer | null> {
  const file = await findAppDataFile(name);
  if (!file) return null;
  const token = await getAccessToken();
  const res = await fetch(`${DRIVE_FILES_URL}/${file.id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Drive download failed: ${await res.text()}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function uploadAuthEnc(data: Buffer): Promise<void> {
  return uploadAppDataFile(SYNC_FILE_AUTH, data);
}

export async function uploadMemoryEnc(data: Buffer): Promise<void> {
  return uploadAppDataFile(SYNC_FILE_MEMORY, data);
}

export async function downloadAuthEnc(): Promise<Buffer | null> {
  return downloadAppDataFile(SYNC_FILE_AUTH);
}

export async function downloadMemoryEnc(): Promise<Buffer | null> {
  return downloadAppDataFile(SYNC_FILE_MEMORY);
}
