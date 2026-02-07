/**
 * Google Services Type Definitions
 * Types for Gmail, Drive, Sheets, YouTube, Calendar
 */

// ============================================================================
// Google Sub-Intent Classification
// ============================================================================

export type GoogleSubIntent =
  | 'gmail_send' | 'gmail_search' | 'gmail_read'
  | 'drive_upload' | 'drive_download' | 'drive_search' | 'drive_share'
  | 'sheets_create' | 'sheets_read' | 'sheets_write'
  | 'youtube_search' | 'youtube_info' | 'youtube_summarize'
  | 'calendar_list' | 'calendar_create' | 'calendar_update' | 'calendar_delete';

// ============================================================================
// Auth Types
// ============================================================================

export interface GoogleAuthTokens {
  accessToken: string;
  refreshToken: string;
  expires: number;
  email?: string;
  scopes: string[];
}

// ============================================================================
// Gmail Types
// ============================================================================

export interface SendMailOptions {
  to: string;
  subject: string;
  body: string;
  html?: string;
  attachments?: MailAttachment[];
}

export interface MailAttachment {
  filename: string;
  mimeType: string;
  data: string; // base64
}

export interface MailContent {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  attachments: MailAttachmentInfo[];
}

export interface MailAttachmentInfo {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

export interface MailSearchResult {
  messages: MailSummary[];
  total: number;
}

export interface MailSummary {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

// ============================================================================
// Drive Types
// ============================================================================

export interface FileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  webViewLink?: string;
  createdTime?: string;
  modifiedTime?: string;
  parents?: string[];
}

export interface FolderMetadata {
  id: string;
  name: string;
  webViewLink?: string;
}

// ============================================================================
// Sheets Types
// ============================================================================

export interface SpreadsheetMetadata {
  id: string;
  title: string;
  url: string;
  sheets: SheetInfo[];
}

export interface SheetInfo {
  id: number;
  title: string;
}

export type CellValue = string | number | boolean | null;

// ============================================================================
// YouTube Types
// ============================================================================

export interface VideoInfo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  publishedAt: string;
}

export interface VideoDetail extends VideoInfo {
  description: string;
  duration: string;
  viewCount: number;
  likeCount: number;
}

export interface CaptionText {
  language: string;
  text: string;
}

// ============================================================================
// Calendar Types
// ============================================================================

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  htmlLink?: string;
}

export interface CreateEventOptions {
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  timeZone?: string;
}

export interface UpdateEventOptions {
  summary?: string;
  start?: string;
  end?: string;
  description?: string;
  location?: string;
}

// ============================================================================
// Google API Response Types (internal)
// ============================================================================

export interface GmailMessageListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  resultSizeEstimate?: number;
}

export interface GmailMessageResponse {
  id: string;
  threadId: string;
  payload: GmailPayload;
  snippet: string;
  internalDate: string;
}

export interface GmailPayload {
  headers: Array<{ name: string; value: string }>;
  mimeType: string;
  body?: { data?: string; size: number };
  parts?: GmailPayload[];
}

export interface DriveFileListResponse {
  files: Array<Record<string, unknown>>;
  nextPageToken?: string;
}

export interface SheetsValuesResponse {
  range: string;
  majorDimension: string;
  values?: CellValue[][];
}

export interface YouTubeSearchResponse {
  items: Array<{
    id: { videoId: string };
    snippet: {
      title: string;
      channelTitle: string;
      publishedAt: string;
      thumbnails: { default: { url: string } };
    };
  }>;
}

export interface YouTubeVideoResponse {
  items: Array<{
    id: string;
    snippet: { title: string; description: string; channelTitle: string; publishedAt: string; thumbnails: { default: { url: string } } };
    contentDetails: { duration: string };
    statistics: { viewCount: string; likeCount: string };
  }>;
}

export interface YouTubeCaptionListResponse {
  items: Array<{
    id: string;
    snippet: { language: string; trackKind: string; name: string };
  }>;
}

export interface CalendarEventListResponse {
  items: Array<{
    id: string;
    summary: string;
    description?: string;
    location?: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
    htmlLink: string;
  }>;
}
