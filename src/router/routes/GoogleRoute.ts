/**
 * GoogleRoute - Google Apps integration route
 * Routes google-category intents to appropriate Google services
 */

import { InterfaceLogger } from '../../interface/types.js';
import { ClassifiedIntent, RouteContext, RouteResult, SmartRouterLike } from '../types.js';
import { BaseRoute } from './BaseRoute.js';
import { GoogleAuthManager } from '../services/GoogleAuthManager.js';
import { GmailService } from '../services/GmailService.js';
import { DriveService } from '../services/DriveService.js';
import { SheetsService } from '../services/SheetsService.js';
import { YouTubeService } from '../services/YouTubeService.js';
import { CalendarService } from '../services/CalendarService.js';
import { GoogleSubIntent } from '../services/google-types.js';

/** Keyword map for Google sub-intent classification */
const SUB_INTENT_KEYWORDS: Record<GoogleSubIntent, readonly string[]> = {
  gmail_send: ['메일 보내', 'email send', 'send mail', '메일 전송', '이메일 보내'],
  gmail_search: ['메일 검색', '메일 찾', 'email search', 'search mail', '이메일 찾'],
  gmail_read: ['메일 읽', '메일 확인', 'read mail', 'check email'],
  drive_upload: ['드라이브 업로드', '파일 올려', 'drive upload', 'upload file', '드라이브에 올'],
  drive_download: ['드라이브 다운', '파일 다운', 'drive download', 'download file'],
  drive_search: ['드라이브 검색', '드라이브 찾', 'drive search', '파일 검색'],
  drive_share: ['파일 공유', 'share file', '드라이브 공유'],
  sheets_create: ['시트 만들', '스프레드시트 생성', 'create sheet'],
  sheets_read: ['시트 읽', '시트 확인', 'read sheet', '시트 데이터'],
  sheets_write: ['시트 쓰', '시트 추가', '데이터 추가', 'write sheet', 'append sheet'],
  youtube_search: ['유튜브 검색', 'youtube search', '영상 검색'],
  youtube_info: ['유튜브 정보', 'video info', '영상 정보'],
  youtube_summarize: ['유튜브 요약', 'youtube summary', '영상 요약', '요약해줘'],
  calendar_list: ['일정 조회', '일정 알려', '일정 확인', 'list events', '스케줄 확인'],
  calendar_create: ['일정 추가', '일정 만들', '일정 생성', 'create event', '미팅 추가'],
  calendar_update: ['일정 수정', '일정 변경', 'update event', '일정 바꿔'],
  calendar_delete: ['일정 삭제', '일정 취소', 'delete event', '일정 지워'],
};

export class GoogleRoute extends BaseRoute {
  readonly name = 'google';
  private authManager: GoogleAuthManager;
  private gmail: GmailService;
  private drive: DriveService;
  private sheets: SheetsService;
  private youtube: YouTubeService;
  private calendar: CalendarService;

  constructor(
    logger: InterfaceLogger,
    authManager: GoogleAuthManager,
    smartRouter?: SmartRouterLike,
  ) {
    super(logger);
    this.authManager = authManager;
    this.gmail = new GmailService(authManager, logger);
    this.drive = new DriveService(authManager, logger);
    this.sheets = new SheetsService(authManager, logger);
    this.youtube = new YouTubeService(authManager, logger, smartRouter);
    this.calendar = new CalendarService(authManager, logger);
  }

  /** Set SmartRouter for YouTube summarization */
  setSmartRouter(router: SmartRouterLike): void {
    this.youtube.setSmartRouter(router);
  }

  canHandle(intent: ClassifiedIntent): boolean {
    return intent.category === 'google';
  }

  protected async executeInternal(context: RouteContext): Promise<RouteResult> {
    // Check authentication
    if (!this.authManager.isAuthenticated()) {
      return this.handleUnauthenticated(context);
    }

    const subIntent = this.classifySubIntent(context.intent.rawQuery);
    this.logger('info', `Google sub-intent: ${subIntent}`);

    try {
      return await this.routeSubIntent(subIntent, context);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    }
  }

  private async handleUnauthenticated(context: RouteContext): Promise<RouteResult> {
    const authUrl = this.authManager.getAuthUrl();

    // Send auth URL to user via Telegram
    await context.services.sendTelegram(
      context.chatId,
      `Google 인증이 필요합니다.\n\n아래 링크를 눌러 Google 계정을 연결해주세요:\n${authUrl}\n\n(5분 내 인증을 완료해주세요)`,
    );

    // Start OAuth callback server and wait for code
    try {
      const code = await this.authManager.startAuthFlow();
      await this.authManager.exchangeCode(code);

      await context.services.sendTelegram(
        context.chatId,
        'Google 인증 완료! 이제 명령을 다시 보내주세요.',
      );

      return { success: true, data: 'Google 인증이 완료되었습니다. 명령을 다시 보내주세요.' };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Google 인증 실패: ${error}` };
    }
  }

  private async routeSubIntent(
    subIntent: GoogleSubIntent,
    context: RouteContext,
  ): Promise<RouteResult> {
    const query = context.intent.rawQuery;

    switch (subIntent) {
      case 'gmail_send': return this.handleGmailSend(query);
      case 'gmail_search': return this.handleGmailSearch(query);
      case 'gmail_read': return this.handleGmailRead(query);
      case 'drive_upload': return this.handleDriveUpload(query);
      case 'drive_search': return this.handleDriveSearch(query);
      case 'drive_share': return this.handleDriveShare(query);
      case 'sheets_write': return this.handleSheetsWrite(query);
      case 'sheets_read': return this.handleSheetsRead(query);
      case 'youtube_search': return this.handleYouTubeSearch(query);
      case 'youtube_summarize': return this.handleYouTubeSummarize(query);
      case 'youtube_info': return this.handleYouTubeInfo(query);
      case 'calendar_list': return this.handleCalendarList(query);
      case 'calendar_create': return this.handleCalendarCreate(query);
      case 'calendar_update': return this.handleCalendarUpdate(query);
      case 'calendar_delete': return this.handleCalendarDelete(query);
      default: return this.handleDriveDownload(query);
    }
  }

  // =========================================================================
  // Gmail Handlers
  // =========================================================================

  private async handleGmailSend(query: string): Promise<RouteResult> {
    const parsed = this.parseMailCommand(query);
    if (!parsed) {
      return { success: false, error: '메일 형식을 파악할 수 없습니다. "누구에게 제목 내용" 형식으로 보내주세요.' };
    }
    const id = await this.gmail.sendMail(parsed);
    return { success: true, data: `메일 전송 완료 (ID: ${id})\n받는 사람: ${parsed.to}\n제목: ${parsed.subject}` };
  }

  private async handleGmailSearch(query: string): Promise<RouteResult> {
    const searchQuery = this.extractSearchQuery(query, ['메일', '이메일', '검색', '찾아']);
    const result = await this.gmail.searchMail(searchQuery);
    if (result.messages.length === 0) {
      return { success: true, data: '검색 결과가 없습니다.' };
    }
    const formatted = result.messages
      .map((m, i) => `${i + 1}. [${m.date}] ${m.from}\n   ${m.subject}\n   ${m.snippet}`)
      .join('\n\n');
    return { success: true, data: `메일 검색 결과 (${result.total}건):\n\n${formatted}` };
  }

  private async handleGmailRead(query: string): Promise<RouteResult> {
    const searchQuery = this.extractSearchQuery(query, ['메일', '이메일', '읽', '확인']);
    const result = await this.gmail.searchMail(searchQuery, 1);
    if (result.messages.length === 0) {
      return { success: true, data: '해당 메일을 찾을 수 없습니다.' };
    }
    const mail = await this.gmail.getMail(result.messages[0].id);
    return { success: true, data: `보낸 사람: ${mail.from}\n제목: ${mail.subject}\n날짜: ${mail.date}\n\n${mail.body.slice(0, 2000)}` };
  }

  // =========================================================================
  // Drive Handlers
  // =========================================================================

  private async handleDriveUpload(query: string): Promise<RouteResult> {
    return { success: false, error: '파일 업로드는 텔레그램에서 파일을 첨부하여 보내주세요.' };
  }

  private async handleDriveSearch(query: string): Promise<RouteResult> {
    const searchQuery = this.extractSearchQuery(query, ['드라이브', '파일', '검색', '찾']);
    const nameQuery = `name contains '${searchQuery}' and trashed = false`;
    const files = await this.drive.search(nameQuery);
    if (files.length === 0) {
      return { success: true, data: '검색 결과가 없습니다.' };
    }
    const formatted = files
      .map((f, i) => `${i + 1}. ${f.name} (${f.mimeType})\n   ${f.webViewLink ?? ''}`)
      .join('\n');
    return { success: true, data: `Drive 검색 결과:\n\n${formatted}` };
  }

  private async handleDriveShare(query: string): Promise<RouteResult> {
    return { success: false, error: '파일 공유: "파일ID 이메일" 형식으로 알려주세요.' };
  }

  private async handleDriveDownload(query: string): Promise<RouteResult> {
    return { success: false, error: '파일 다운로드: 파일 ID를 알려주세요.' };
  }

  // =========================================================================
  // Sheets Handlers
  // =========================================================================

  private async handleSheetsWrite(query: string): Promise<RouteResult> {
    return { success: false, error: '시트 작업: 스프레드시트 ID와 데이터를 알려주세요.' };
  }

  private async handleSheetsRead(query: string): Promise<RouteResult> {
    return { success: false, error: '시트 읽기: 스프레드시트 ID와 범위를 알려주세요.' };
  }

  // =========================================================================
  // YouTube Handlers
  // =========================================================================

  private async handleYouTubeSearch(query: string): Promise<RouteResult> {
    const searchQuery = this.extractSearchQuery(query, ['유튜브', 'youtube', '검색', '영상']);
    const videos = await this.youtube.search(searchQuery);
    if (videos.length === 0) {
      return { success: true, data: '검색 결과가 없습니다.' };
    }
    const formatted = videos
      .map((v, i) => `${i + 1}. ${v.title}\n   ${v.channelTitle} | ${v.publishedAt}\n   https://youtu.be/${v.videoId}`)
      .join('\n\n');
    return { success: true, data: `YouTube 검색 결과:\n\n${formatted}` };
  }

  private async handleYouTubeSummarize(query: string): Promise<RouteResult> {
    const videoId = YouTubeService.extractVideoId(query);
    if (!videoId) {
      return { success: false, error: 'YouTube URL 또는 비디오 ID를 포함해주세요.' };
    }
    const summary = await this.youtube.summarize(videoId);
    return { success: true, data: summary };
  }

  private async handleYouTubeInfo(query: string): Promise<RouteResult> {
    const videoId = YouTubeService.extractVideoId(query);
    if (!videoId) {
      return { success: false, error: 'YouTube URL 또는 비디오 ID를 포함해주세요.' };
    }
    const video = await this.youtube.getVideo(videoId);
    const info = [
      `제목: ${video.title}`,
      `채널: ${video.channelTitle}`,
      `조회수: ${video.viewCount.toLocaleString()}`,
      `좋아요: ${video.likeCount.toLocaleString()}`,
      `길이: ${video.duration}`,
    ].join('\n');
    return { success: true, data: info };
  }

  // =========================================================================
  // Calendar Handlers
  // =========================================================================

  private async handleCalendarList(query: string): Promise<RouteResult> {
    const range = CalendarService.parseDateRange(query);
    if (range) {
      const events = await this.calendar.listEvents(range.timeMin, range.timeMax);
      return this.formatCalendarEvents(events);
    }
    // Default: next 7 days
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const events = await this.calendar.listEvents(now.toISOString(), weekLater.toISOString());
    return this.formatCalendarEvents(events);
  }

  private async handleCalendarCreate(query: string): Promise<RouteResult> {
    const dateTime = CalendarService.parseDateTime(query);
    if (!dateTime) {
      return { success: false, error: '시간을 파악할 수 없습니다. "내일 오후 3시" 형식으로 알려주세요.' };
    }
    const summary = this.extractEventSummary(query);
    const start = dateTime;
    const end = new Date(new Date(dateTime).getTime() + 60 * 60 * 1000).toISOString();
    const event = await this.calendar.createEvent({ summary, start, end });
    return { success: true, data: `일정 추가됨: ${event.summary}\n시간: ${event.start} ~ ${event.end}` };
  }

  private async handleCalendarUpdate(query: string): Promise<RouteResult> {
    return { success: false, error: '일정 수정: 이벤트 ID와 변경 내용을 알려주세요.' };
  }

  private async handleCalendarDelete(query: string): Promise<RouteResult> {
    return { success: false, error: '일정 삭제: 이벤트 ID를 알려주세요.' };
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  private classifySubIntent(text: string): GoogleSubIntent {
    const lower = text.toLowerCase();
    let bestMatch: GoogleSubIntent = 'gmail_search';
    let bestScore = 0;

    for (const [intent, keywords] of Object.entries(SUB_INTENT_KEYWORDS)) {
      const score = keywords.filter((kw) => lower.includes(kw.toLowerCase())).length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = intent as GoogleSubIntent;
      }
    }
    return bestMatch;
  }

  private extractSearchQuery(text: string, stopWords: string[]): string {
    let result = text;
    for (const word of stopWords) {
      result = result.replace(new RegExp(word, 'gi'), '');
    }
    return result.replace(/\s+/g, ' ').trim() || text;
  }

  private parseMailCommand(text: string): { to: string; subject: string; body: string } | null {
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (!emailMatch) return null;
    const to = emailMatch[1];
    const afterEmail = text.slice(text.indexOf(to) + to.length).trim();
    const parts = afterEmail.split(/\s+/);
    const subject = parts.slice(0, 3).join(' ') || '(제목 없음)';
    const body = parts.slice(3).join(' ') || afterEmail;
    return { to, subject, body };
  }

  private extractEventSummary(text: string): string {
    const cleaned = text
      .replace(/내일|오늘|이번\s*주|다음\s*주/g, '')
      .replace(/(오전|오후)?\s*\d{1,2}시\s*(\d{1,2}분)?/g, '')
      .replace(/일정\s*(추가|만들|생성)/g, '')
      .replace(/에$|해줘$|해$|추가해줘$|만들어줘$/g, '')
      .trim();
    return cleaned || '새 일정';
  }

  private formatCalendarEvents(events: import('../services/google-types.js').CalendarEvent[]): RouteResult {
    if (events.length === 0) {
      return { success: true, data: '해당 기간에 일정이 없습니다.' };
    }
    const formatted = events
      .map((e, i) => `${i + 1}. ${e.summary}\n   ${e.start} ~ ${e.end}${e.location ? `\n   장소: ${e.location}` : ''}`)
      .join('\n\n');
    return { success: true, data: `일정 목록:\n\n${formatted}` };
  }
}
