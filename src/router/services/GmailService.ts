/**
 * GmailService - Gmail API v1 operations
 * Send, search, read emails via REST API
 */

import { InterfaceLogger } from '../../interface/types.js';
import { GoogleAuthManager } from './GoogleAuthManager.js';
import {
  SendMailOptions,
  MailContent,
  MailSearchResult,
  MailSummary,
  GmailMessageListResponse,
  GmailMessageResponse,
  GmailPayload,
  MailAttachmentInfo,
} from './google-types.js';

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25MB API limit

export class GmailService {
  private auth: GoogleAuthManager;
  private logger: InterfaceLogger;

  constructor(auth: GoogleAuthManager, logger: InterfaceLogger) {
    this.auth = auth;
    this.logger = logger;
  }

  /** Send an email */
  async sendMail(options: SendMailOptions): Promise<string> {
    this.validateAttachments(options);
    const raw = this.buildRawEmail(options);
    const res = await this.auth.fetchApi(`${GMAIL_BASE}/messages/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) {
      throw new Error(`메일 전송 실패: ${await res.text()}`);
    }
    const data = (await res.json()) as { id: string };
    this.logger('info', `메일 전송 완료: ${data.id}`);
    return data.id;
  }

  /** Search emails by Gmail query syntax */
  async searchMail(query: string, maxResults: number = 10): Promise<MailSearchResult> {
    const params = new URLSearchParams({
      q: query,
      maxResults: String(maxResults),
    });
    const res = await this.auth.fetchApi(`${GMAIL_BASE}/messages?${params}`);
    if (!res.ok) {
      throw new Error(`메일 검색 실패: ${await res.text()}`);
    }
    const data = (await res.json()) as GmailMessageListResponse;
    if (!data.messages?.length) {
      return { messages: [], total: 0 };
    }
    const summaries = await this.fetchMessageSummaries(data.messages);
    return { messages: summaries, total: data.resultSizeEstimate ?? summaries.length };
  }

  /** Read a specific email */
  async getMail(messageId: string): Promise<MailContent> {
    const res = await this.auth.fetchApi(
      `${GMAIL_BASE}/messages/${messageId}?format=full`,
    );
    if (!res.ok) {
      throw new Error(`메일 읽기 실패: ${await res.text()}`);
    }
    const msg = (await res.json()) as GmailMessageResponse;
    return this.parseFullMessage(msg);
  }

  private async fetchMessageSummaries(
    messages: Array<{ id: string; threadId: string }>,
  ): Promise<MailSummary[]> {
    const results: MailSummary[] = [];
    for (const { id, threadId } of messages.slice(0, 10)) {
      const res = await this.auth.fetchApi(
        `${GMAIL_BASE}/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
      );
      if (!res.ok) continue;
      const msg = (await res.json()) as GmailMessageResponse;
      results.push({
        id,
        threadId,
        subject: this.getHeader(msg.payload, 'Subject'),
        from: this.getHeader(msg.payload, 'From'),
        date: this.getHeader(msg.payload, 'Date'),
        snippet: msg.snippet,
      });
    }
    return results;
  }

  private parseFullMessage(msg: GmailMessageResponse): MailContent {
    const body = this.extractBody(msg.payload);
    const attachments = this.extractAttachments(msg.payload);
    return {
      id: msg.id,
      threadId: msg.threadId,
      from: this.getHeader(msg.payload, 'From'),
      to: this.getHeader(msg.payload, 'To'),
      subject: this.getHeader(msg.payload, 'Subject'),
      body,
      date: this.getHeader(msg.payload, 'Date'),
      attachments,
    };
  }

  private extractBody(payload: GmailPayload): string {
    if (payload.body?.data) {
      return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
    }
    if (payload.parts) {
      const textPart = payload.parts.find((p) => p.mimeType === 'text/plain');
      const htmlPart = payload.parts.find((p) => p.mimeType === 'text/html');
      const part = textPart ?? htmlPart;
      if (part?.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8');
      }
    }
    return '';
  }

  private extractAttachments(payload: GmailPayload): MailAttachmentInfo[] {
    if (!payload.parts) return [];
    return payload.parts
      .filter((p) => p.body && p.body.size > 0 && this.getPartFilename(p))
      .map((p) => ({
        filename: this.getPartFilename(p),
        mimeType: p.mimeType,
        size: p.body!.size,
        attachmentId: p.body!.data ?? '',
      }));
  }

  private getPartFilename(part: GmailPayload): string {
    const disp = part.headers.find((h) => h.name.toLowerCase() === 'content-disposition');
    if (!disp) return '';
    const match = disp.value.match(/filename="?([^";\n]+)"?/);
    return match?.[1] ?? '';
  }

  private getHeader(payload: GmailPayload, name: string): string {
    const header = payload.headers.find(
      (h) => h.name.toLowerCase() === name.toLowerCase(),
    );
    return header?.value ?? '';
  }

  private buildRawEmail(options: SendMailOptions): string {
    const boundary = `boundary_${Date.now()}`;
    const hasAttachments = options.attachments && options.attachments.length > 0;
    const contentType = hasAttachments
      ? `multipart/mixed; boundary="${boundary}"`
      : 'text/plain; charset=utf-8';

    let email = [
      `To: ${options.to}`,
      `Subject: ${options.subject}`,
      `Content-Type: ${contentType}`,
      'MIME-Version: 1.0',
      '',
    ].join('\r\n');

    if (hasAttachments) {
      email += this.buildMultipartBody(options, boundary);
    } else {
      email += options.html ?? options.body;
    }

    return Buffer.from(email).toString('base64url');
  }

  private buildMultipartBody(options: SendMailOptions, boundary: string): string {
    let body = `--${boundary}\r\n`;
    body += `Content-Type: ${options.html ? 'text/html' : 'text/plain'}; charset=utf-8\r\n\r\n`;
    body += `${options.html ?? options.body}\r\n`;

    for (const att of options.attachments ?? []) {
      body += `--${boundary}\r\n`;
      body += `Content-Type: ${att.mimeType}; name="${att.filename}"\r\n`;
      body += `Content-Disposition: attachment; filename="${att.filename}"\r\n`;
      body += `Content-Transfer-Encoding: base64\r\n\r\n`;
      body += `${att.data}\r\n`;
    }
    body += `--${boundary}--`;
    return body;
  }

  private validateAttachments(options: SendMailOptions): void {
    if (!options.attachments) return;
    const totalSize = options.attachments.reduce(
      (sum, att) => sum + Buffer.from(att.data, 'base64').length,
      0,
    );
    if (totalSize > MAX_ATTACHMENT_SIZE) {
      throw new Error('첨부파일 크기가 25MB를 초과합니다. Drive 링크를 사용해주세요.');
    }
  }
}
