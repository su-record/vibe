/**
 * Google MCP Tools — Per-User OAuth 기반 Google API 도구
 *
 * - core_google_auth: OAuth 인증 시작/상태 확인
 * - core_google_gmail_send: 메일 발송
 * - core_google_gmail_search: 메일 검색
 * - core_google_gmail_report: 개발 리포트 발송
 * - core_google_drive_upload: 파일 업로드
 * - core_google_drive_download: 파일 다운로드
 * - core_google_drive_list: 파일 목록
 * - core_google_sheets_read: 시트 읽기
 * - core_google_sheets_write: 시트 쓰기
 * - core_google_calendar_list: 일정 조회
 * - core_google_calendar_create: 일정 생성
 */

import type { ToolResult, ToolDefinition } from '../../infra/types/tool.js';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import { TokenStore } from '../../pc/google/TokenStore.js';
import { ScopeManager } from '../../pc/google/ScopeManager.js';
import { OAuthFlow } from '../../pc/google/OAuthFlow.js';
import { PerUserGmailService } from '../../pc/google/services/GmailService.js';
import { PerUserDriveService } from '../../pc/google/services/DriveService.js';
import { PerUserSheetsService } from '../../pc/google/services/SheetsService.js';
import { PerUserCalendarService } from '../../pc/google/services/CalendarService.js';
import { GOOGLE_SCOPE_MAP } from '../../pc/google/types.js';
import type { GoogleLogger } from '../../pc/google/types.js';
import { getGlobalConfigDir } from '../../infra/lib/llm/auth/ConfigManager.js';
import {
  getSyncClientId,
  getSyncClientSecret,
} from '../../infra/lib/sync/constants.js';

// ============================================================================
// Singleton (lazy init)
// ============================================================================

let db: Database.Database | null = null;
let tokenStore: TokenStore | null = null;
let scopeManager: ScopeManager | null = null;
let oauthFlow: OAuthFlow | null = null;
let gmailService: PerUserGmailService | null = null;
let driveService: PerUserDriveService | null = null;
let sheetsService: PerUserSheetsService | null = null;
let calendarService: PerUserCalendarService | null = null;

const DEFAULT_USER = 'local';

function getLogger(): GoogleLogger {
  return (level, message, data) => {
    if (level === 'error') {
      console.error(`[google] ${message}`, data ?? '');
    }
  };
}

/** DB는 TokenStore에서 소유. 직접 호출하지 않음 (ensureServices 참조) */
function ensureDb(): Database.Database {
  if (!db) {
    throw new Error('DB not initialized. Call ensureServices() first.');
  }
  return db;
}

function ensureServices(): {
  oauth: OAuthFlow;
  gmail: PerUserGmailService;
  drive: PerUserDriveService;
  sheets: PerUserSheetsService;
  calendar: PerUserCalendarService;
  scopes: ScopeManager;
} {
  const logger = getLogger();

  if (!tokenStore) {
    // TokenStore가 DB를 소유 — 단일 DB 인스턴스 보장
    tokenStore = new TokenStore(logger);
    db = tokenStore.getDatabase();
  }
  if (!scopeManager) {
    scopeManager = new ScopeManager(db!, logger);
  }
  if (!oauthFlow) {
    let clientId: string;
    let clientSecret: string;
    try {
      clientId = getSyncClientId();
      clientSecret = getSyncClientSecret();
    } catch {
      clientId = process.env.VIBE_GOOGLE_CLIENT_ID ?? '';
      clientSecret = process.env.VIBE_GOOGLE_CLIENT_SECRET ?? '';
    }
    oauthFlow = new OAuthFlow(db!, tokenStore, scopeManager, logger, {
      clientId,
      clientSecret: clientSecret || undefined,
    });
  }
  if (!gmailService) gmailService = new PerUserGmailService(oauthFlow, logger);
  if (!driveService) driveService = new PerUserDriveService(oauthFlow, logger);
  if (!sheetsService) sheetsService = new PerUserSheetsService(oauthFlow, logger);
  if (!calendarService) calendarService = new PerUserCalendarService(oauthFlow, logger);

  return {
    oauth: oauthFlow,
    gmail: gmailService,
    drive: driveService,
    sheets: sheetsService,
    calendar: calendarService,
    scopes: scopeManager,
  };
}

/** 에러 → ToolResult */
function errorResult(err: unknown): ToolResult {
  const msg = err instanceof Error ? err.message : String(err);
  // 토큰 값 노출 방지
  const safeMsg = msg.replace(/ya29\.[a-zA-Z0-9_-]+/g, '[REDACTED]')
    .replace(/1\/\/[a-zA-Z0-9_-]+/g, '[REDACTED]');
  return { content: [{ type: 'text', text: JSON.stringify({ error: safeMsg }, null, 2) }] };
}

/** 성공 결과 → ToolResult */
function successResult(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const googleAuthDefinition: ToolDefinition = {
  name: 'core_google_auth',
  description: 'google auth|google login|google oauth - Start or check Google OAuth authentication',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['status', 'start', 'revoke'],
        description: 'Auth action: status (check), start (begin OAuth), revoke (delete tokens)',
      },
      scopes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Scope aliases to request (e.g., gmail.send, drive, spreadsheets)',
      },
    },
    required: ['action'],
  },
  annotations: {
    title: 'Google Auth',
    audience: ['user', 'assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
};

export const googleGmailSendDefinition: ToolDefinition = {
  name: 'core_google_gmail_send',
  description: 'send email|gmail send|mail send - Send email via Gmail',
  inputSchema: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Recipient email address' },
      subject: { type: 'string', description: 'Email subject' },
      body: { type: 'string', description: 'Email body (plain text or markdown)' },
      html: { type: 'string', description: 'Optional HTML body' },
    },
    required: ['to', 'subject', 'body'],
  },
  annotations: {
    title: 'Gmail Send',
    audience: ['assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
};

export const googleGmailSearchDefinition: ToolDefinition = {
  name: 'core_google_gmail_search',
  description: 'search email|gmail search|find mail - Search emails in Gmail',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Gmail search query (e.g., "from:github.com")' },
      maxResults: { type: 'number', description: 'Maximum results (default: 5)' },
    },
    required: ['query'],
  },
  annotations: {
    title: 'Gmail Search',
    audience: ['assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};

export const googleGmailReportDefinition: ToolDefinition = {
  name: 'core_google_gmail_report',
  description: 'send report|dev report|error report - Send development report via Gmail',
  inputSchema: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Recipient email' },
      title: { type: 'string', description: 'Report title' },
      status: { type: 'string', enum: ['success', 'error'], description: 'Report status' },
      summary: { type: 'string', description: 'Report summary' },
      details: { type: 'string', description: 'Detailed report content' },
    },
    required: ['to', 'title', 'status', 'summary'],
  },
  annotations: {
    title: 'Gmail Report',
    audience: ['assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
};

export const googleDriveUploadDefinition: ToolDefinition = {
  name: 'core_google_drive_upload',
  description: 'upload to drive|drive upload|save to drive - Upload file to Google Drive',
  inputSchema: {
    type: 'object',
    properties: {
      filePath: { type: 'string', description: 'Local file path to upload' },
      folderId: { type: 'string', description: 'Drive folder ID (optional)' },
    },
    required: ['filePath'],
  },
  annotations: {
    title: 'Drive Upload',
    audience: ['assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
};

export const googleDriveDownloadDefinition: ToolDefinition = {
  name: 'core_google_drive_download',
  description: 'download from drive|drive download - Download file from Google Drive',
  inputSchema: {
    type: 'object',
    properties: {
      fileId: { type: 'string', description: 'Drive file ID' },
      destPath: { type: 'string', description: 'Local destination path' },
    },
    required: ['fileId', 'destPath'],
  },
  annotations: {
    title: 'Drive Download',
    audience: ['assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
};

export const googleDriveListDefinition: ToolDefinition = {
  name: 'core_google_drive_list',
  description: 'list drive files|drive search|drive list - List or search Google Drive files',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Drive search query' },
      maxResults: { type: 'number', description: 'Maximum results (default: 20)' },
    },
  },
  annotations: {
    title: 'Drive List',
    audience: ['assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};

export const googleSheetsReadDefinition: ToolDefinition = {
  name: 'core_google_sheets_read',
  description: 'read sheet|sheets read|spreadsheet read - Read data from Google Sheets',
  inputSchema: {
    type: 'object',
    properties: {
      spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
      range: { type: 'string', description: 'A1 notation range (e.g., "Sheet1!A1:C10")' },
    },
    required: ['spreadsheetId', 'range'],
  },
  annotations: {
    title: 'Sheets Read',
    audience: ['assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};

export const googleSheetsWriteDefinition: ToolDefinition = {
  name: 'core_google_sheets_write',
  description: 'write sheet|sheets write|spreadsheet write - Write data to Google Sheets',
  inputSchema: {
    type: 'object',
    properties: {
      spreadsheetId: { type: 'string', description: 'Spreadsheet ID' },
      range: { type: 'string', description: 'A1 notation range' },
      values: {
        type: 'array',
        description: '2D array of cell values',
        items: { type: 'array', items: {} },
      },
    },
    required: ['spreadsheetId', 'range', 'values'],
  },
  annotations: {
    title: 'Sheets Write',
    audience: ['assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
};

export const googleCalendarListDefinition: ToolDefinition = {
  name: 'core_google_calendar_list',
  description: 'list events|calendar events|show schedule - List Google Calendar events',
  inputSchema: {
    type: 'object',
    properties: {
      timeMin: { type: 'string', description: 'Start time (ISO 8601)' },
      timeMax: { type: 'string', description: 'End time (ISO 8601)' },
      maxResults: { type: 'number', description: 'Maximum results (default: 10)' },
    },
    required: ['timeMin', 'timeMax'],
  },
  annotations: {
    title: 'Calendar List',
    audience: ['assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};

export const googleCalendarCreateDefinition: ToolDefinition = {
  name: 'core_google_calendar_create',
  description: 'create event|add event|schedule event - Create Google Calendar event',
  inputSchema: {
    type: 'object',
    properties: {
      summary: { type: 'string', description: 'Event title' },
      start: { type: 'string', description: 'Start time (ISO 8601)' },
      end: { type: 'string', description: 'End time (ISO 8601)' },
      description: { type: 'string', description: 'Event description' },
      location: { type: 'string', description: 'Event location' },
    },
    required: ['summary', 'start', 'end'],
  },
  annotations: {
    title: 'Calendar Create',
    audience: ['assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
};

// ============================================================================
// Tool Handlers
// ============================================================================

export async function googleAuth(
  args: { action: string; scopes?: string[] },
): Promise<ToolResult> {
  try {
    const { oauth, scopes } = ensureServices();

    switch (args.action) {
      case 'status': {
        const granted = scopes.getGrantedScopes(DEFAULT_USER);
        const tokens = tokenStore?.load(DEFAULT_USER);
        return successResult({
          authenticated: !!tokens,
          scopes: granted,
          expiresAt: tokens?.expiresAt ? new Date(tokens.expiresAt).toISOString() : null,
        });
      }
      case 'start': {
        const requestScopes = (args.scopes ?? ['gmail.send', 'drive', 'spreadsheets', 'calendar'])
          .map(alias => GOOGLE_SCOPE_MAP[alias] ?? alias)
          .concat(GOOGLE_SCOPE_MAP['userinfo.email']);
        const { url } = oauth.generateAuthUrl(DEFAULT_USER, requestScopes);
        return successResult({
          message: '브라우저에서 아래 URL을 열어 Google 인증을 완료해주세요.',
          authUrl: url,
        });
      }
      case 'revoke': {
        tokenStore?.revoke(DEFAULT_USER);
        scopes.revokeScopes(DEFAULT_USER);
        return successResult({ message: 'Google 토큰이 삭제되었습니다.' });
      }
      default:
        return errorResult({ message: `Unknown action: ${args.action}. Use: status, start, revoke` });
    }
  } catch (err) {
    return errorResult(err);
  }
}

export async function googleGmailSend(
  args: { to: string; subject: string; body: string; html?: string },
): Promise<ToolResult> {
  try {
    const { gmail } = ensureServices();
    const messageId = await gmail.sendEmail(DEFAULT_USER, args);
    return successResult({ success: true, messageId });
  } catch (err) {
    return errorResult(err);
  }
}

export async function googleGmailSearch(
  args: { query: string; maxResults?: number },
): Promise<ToolResult> {
  try {
    const { gmail } = ensureServices();
    const results = await gmail.searchMail(DEFAULT_USER, args.query, args.maxResults ?? 5);
    return successResult({ results, count: results.length });
  } catch (err) {
    return errorResult(err);
  }
}

export async function googleGmailReport(
  args: { to: string; title: string; status: string; summary: string; details?: string },
): Promise<ToolResult> {
  try {
    const { gmail } = ensureServices();
    const reportStatus = args.status === 'error' ? 'error' as const : 'success' as const;
    const messageId = await gmail.sendReport(DEFAULT_USER, args.to, {
      title: args.title,
      status: reportStatus,
      summary: args.summary,
      details: args.details,
    });
    return successResult({ success: true, messageId });
  } catch (err) {
    return errorResult(err);
  }
}

export async function googleDriveUpload(
  args: { filePath: string; folderId?: string },
): Promise<ToolResult> {
  try {
    const { drive } = ensureServices();
    const file = await drive.upload(DEFAULT_USER, args.filePath, args.folderId);
    return successResult({ success: true, file });
  } catch (err) {
    return errorResult(err);
  }
}

export async function googleDriveDownload(
  args: { fileId: string; destPath: string },
): Promise<ToolResult> {
  try {
    const { drive } = ensureServices();
    await drive.download(DEFAULT_USER, args.fileId, args.destPath);
    return successResult({ success: true, destPath: args.destPath });
  } catch (err) {
    return errorResult(err);
  }
}

export async function googleDriveList(
  args: { query?: string; maxResults?: number } = {},
): Promise<ToolResult> {
  try {
    const { drive } = ensureServices();
    const files = await drive.list(DEFAULT_USER, args.query, args.maxResults ?? 20);
    return successResult({ files, count: files.length });
  } catch (err) {
    return errorResult(err);
  }
}

export async function googleSheetsRead(
  args: { spreadsheetId: string; range: string },
): Promise<ToolResult> {
  try {
    const { sheets } = ensureServices();
    const values = await sheets.read(DEFAULT_USER, args.spreadsheetId, args.range);
    return successResult({ range: args.range, values, rows: values.length });
  } catch (err) {
    return errorResult(err);
  }
}

export async function googleSheetsWrite(
  args: { spreadsheetId: string; range: string; values: unknown[][] },
): Promise<ToolResult> {
  try {
    const { sheets } = ensureServices();
    await sheets.write(DEFAULT_USER, args.spreadsheetId, args.range, args.values as (string | number | boolean | null)[][]);
    return successResult({ success: true, range: args.range });
  } catch (err) {
    return errorResult(err);
  }
}

export async function googleCalendarList(
  args: { timeMin: string; timeMax: string; maxResults?: number },
): Promise<ToolResult> {
  try {
    const { calendar } = ensureServices();
    const events = await calendar.listEvents(DEFAULT_USER, args.timeMin, args.timeMax, args.maxResults);
    return successResult({ events, count: events.length });
  } catch (err) {
    return errorResult(err);
  }
}

export async function googleCalendarCreate(
  args: { summary: string; start: string; end: string; description?: string; location?: string },
): Promise<ToolResult> {
  try {
    const { calendar } = ensureServices();
    const event = await calendar.createEvent(DEFAULT_USER, args);
    return successResult({ success: true, event });
  } catch (err) {
    return errorResult(err);
  }
}

/** 서비스 종료 (데몬 stop 시 호출) */
export function shutdownGoogleService(): void {
  tokenStore?.close();
  db?.close();
  tokenStore = null;
  scopeManager = null;
  oauthFlow = null;
  gmailService = null;
  driveService = null;
  sheetsService = null;
  calendarService = null;
  db = null;
}
