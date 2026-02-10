/**
 * vibe sync — Google Drive AppData OAuth 상수
 * Google Cloud Console에서 Desktop OAuth 클라이언트 생성 후
 * VIBE_SYNC_GOOGLE_CLIENT_ID 로 설정
 */

export const SYNC_REDIRECT_PORT = 51122;
export const SYNC_REDIRECT_PATH = '/oauth-callback';
export const SYNC_REDIRECT_URI = `http://localhost:${SYNC_REDIRECT_PORT}${SYNC_REDIRECT_PATH}`;

export const SYNC_SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/youtube.readonly',
];

export const SYNC_OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const SYNC_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const SYNC_OAUTH_USERINFO_URL = 'https://www.googleapis.com/oauth2/v1/userinfo?alt=json';

export const SYNC_DRIVE_APPDATA_FOLDER = 'vibe-sync';
export const SYNC_FILE_AUTH = 'vibe-auth.enc';
export const SYNC_FILE_MEMORY = 'vibe-memory.enc';

export const SYNC_OAUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5분

export function getSyncClientId(): string {
  const id = process.env.VIBE_SYNC_GOOGLE_CLIENT_ID;
  if (!id) {
    throw new Error(
      'VIBE_SYNC_GOOGLE_CLIENT_ID is not set. Create an OAuth 2.0 Desktop client in Google Cloud Console and set the env var.'
    );
  }
  return id;
}

export function getSyncClientSecret(): string {
  return process.env.VIBE_SYNC_GOOGLE_CLIENT_SECRET || '';
}
