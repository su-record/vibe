/**
 * ConversationState - 대화 이력 관리
 * Phase 2: Agent Core Loop
 *
 * 기능:
 * - chatId별 메시지 배열 관리
 * - 슬라이딩 윈도우: 최근 20개 (System Prompt 제외)
 * - Token counting: 한국어 2chars≈1token, ASCII 4chars≈1token, 20% 마진
 * - 최대 컨텍스트: GPT 32K, Claude 100K
 * - 세션 만료: 30분 비활성
 * - Tool 결과 압축: >4KB 시 truncate
 */

import type {
  AgentMessage,
  ConversationSession,
  HeadModelProviderType,
} from './types.js';

const MAX_WINDOW_SIZE = 20;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30분
const TOOL_RESULT_COMPRESS_THRESHOLD = 4 * 1024; // 4KB
const TOKEN_LIMITS: Record<HeadModelProviderType, number> = {
  gpt: 32_000,
  claude: 100_000,
};

export class ConversationState {
  private sessions = new Map<string, ConversationSession>();

  addMessage(chatId: string, message: AgentMessage): void {
    const session = this.getOrCreateSession(chatId);
    const compressed = this.compressToolResult(message);
    session.messages.push(compressed);
    session.lastActivity = Date.now();
    this.enforceWindowLimit(session);
  }

  getMessages(
    chatId: string,
    providerType: HeadModelProviderType,
  ): AgentMessage[] {
    const session = this.sessions.get(chatId);
    if (!session) return [];

    if (this.isExpired(session)) {
      this.sessions.delete(chatId);
      return [];
    }

    return this.fitToTokenLimit([...session.messages], providerType);
  }

  isSessionExpired(chatId: string): boolean {
    const session = this.sessions.get(chatId);
    if (!session) return true;
    return this.isExpired(session);
  }

  resetSession(chatId: string): void {
    this.sessions.delete(chatId);
  }

  getMessageCount(chatId: string): number {
    return this.sessions.get(chatId)?.messages.length ?? 0;
  }

  private getOrCreateSession(chatId: string): ConversationSession {
    let session = this.sessions.get(chatId);
    if (!session || this.isExpired(session)) {
      session = { chatId, messages: [], lastActivity: Date.now() };
      this.sessions.set(chatId, session);
    }
    return session;
  }

  private isExpired(session: ConversationSession): boolean {
    return Date.now() - session.lastActivity > SESSION_TIMEOUT_MS;
  }

  private enforceWindowLimit(session: ConversationSession): void {
    if (session.messages.length <= MAX_WINDOW_SIZE) return;
    session.messages = session.messages.slice(-MAX_WINDOW_SIZE);
  }

  private fitToTokenLimit(
    messages: AgentMessage[],
    providerType: HeadModelProviderType,
  ): AgentMessage[] {
    const tokenLimit = TOKEN_LIMITS[providerType];
    let totalTokens = this.estimateTokensAll(messages);

    while (totalTokens > tokenLimit && messages.length > 1) {
      messages.shift();
      totalTokens = this.estimateTokensAll(messages);
    }

    return messages;
  }

  private estimateTokensAll(messages: AgentMessage[]): number {
    let total = 0;
    for (const msg of messages) {
      total += this.estimateStringTokens(msg.content);
    }
    return Math.ceil(total * 1.2); // 20% safety margin
  }

  estimateStringTokens(text: string): number {
    let tokens = 0;
    for (const char of text) {
      const code = char.codePointAt(0) ?? 0;
      tokens += code > 127 ? 0.5 : 0.25;
    }
    return Math.ceil(tokens);
  }

  private compressToolResult(message: AgentMessage): AgentMessage {
    if (message.role !== 'tool') return message;
    if (message.content.length <= TOOL_RESULT_COMPRESS_THRESHOLD) return message;

    const sizeKB = (message.content.length / 1024).toFixed(1);
    const first1KB = message.content.substring(0, 1024);
    const last1KB = message.content.substring(message.content.length - 1024);
    const compressed = `${first1KB}\n\n[...결과 축약 ${sizeKB}KB...]\n\n${last1KB}`;

    return { ...message, content: compressed };
  }
}
