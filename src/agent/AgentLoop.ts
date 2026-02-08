/**
 * AgentLoop - 메인 에이전트 루프
 * Phase 2: Agent Core Loop
 *
 * 파이프라인:
 * message → system prompt + tools → HeadModel.chat()
 * → [tool_call → execute → result]* → final response → Telegram
 *
 * 기능:
 * - Max iterations: 10 (무한 루프 방지)
 * - Idempotency: tool_call.id 기반 중복 실행 방지
 * - HeadModel 호출 timeout: 10초, 1회 재시도
 * - 잘못된 tool_call: 에러 피드백 → 최대 2회 재시도 후 에러
 * - Circuit breaker 연동 (HeadModelSelector)
 */

import type { ExternalMessage } from '../interface/types.js';
import type { RouteServices } from '../router/types.js';
import type { AgentMessage, AgentProgressEvent, HeadModelProvider, HeadModelResponse, ToolCall } from './types.js';
import type { HeadModelSelector } from './HeadModelSelector.js';
import type { ToolRegistry } from './ToolRegistry.js';
import { ConversationState } from './ConversationState.js';
import { ToolExecutor, type AgentLogger } from './ToolExecutor.js';
import { buildSystemPrompt, type SystemPromptConfig } from './SystemPrompt.js';
import { MediaPreprocessor, type MediaPreprocessorConfig } from './preprocessors/MediaPreprocessor.js';
import { bindSendTelegram, unbindSendTelegram, runInChatContext } from './tools/send-telegram.js';

const MAX_ITERATIONS = 10;
const HEAD_MODEL_TIMEOUT_MS = 10_000;
const MAX_INVALID_TOOL_RETRIES = 2;
const MAX_IDEMPOTENCY_CACHE_SIZE = 500;

// === Error Messages ===

const ERROR_MESSAGES = {
  headModelFailure: 'AI 모델 연결에 실패했습니다. 잠시 후 다시 시도해주세요.',
  maxIterations: '처리 한도(10회)를 초과했습니다. 요청을 더 구체적으로 해주세요.',
  sessionExpired: '세션이 만료되었습니다. 새 대화를 시작합니다.',
} as const;

// === AgentLoop ===

export type OnProgressCallback = (event: AgentProgressEvent) => void;

export interface AgentLoopDeps {
  headSelector: HeadModelSelector;
  toolRegistry: ToolRegistry;
  systemPromptConfig?: SystemPromptConfig;
  mediaPreprocessorConfig?: MediaPreprocessorConfig;
  onProgress?: OnProgressCallback;
}

export class AgentLoop {
  private headSelector: HeadModelSelector;
  private toolRegistry: ToolRegistry;
  private conversationState = new ConversationState();
  private toolExecutor: ToolExecutor;
  private executedToolCalls = new Map<string, string>(); // idempotency cache
  private systemPromptConfig: SystemPromptConfig | undefined;
  private mediaPreprocessor: MediaPreprocessor;
  private onProgress: OnProgressCallback | undefined;

  constructor(deps: AgentLoopDeps) {
    this.headSelector = deps.headSelector;
    this.toolRegistry = deps.toolRegistry;
    this.systemPromptConfig = deps.systemPromptConfig;
    this.toolExecutor = new ToolExecutor((_level, _msg) => {});
    this.mediaPreprocessor = new MediaPreprocessor(deps.mediaPreprocessorConfig);
    this.onProgress = deps.onProgress;
  }

  setOnProgress(callback: OnProgressCallback | undefined): void {
    this.onProgress = callback;
  }

  setLogger(logger: AgentLogger): void {
    this.toolExecutor = new ToolExecutor(logger);
  }

  async process(message: ExternalMessage, services: RouteServices): Promise<void> {
    const { chatId } = message;
    const jobId = message.id;

    // Check session expiry
    if (this.conversationState.isSessionExpired(chatId)) {
      this.conversationState.resetSession(chatId);
    }

    // Emit job:created
    this.emitProgress({
      type: 'job:created',
      jobId,
      data: { kind: 'created', chatId, content: message.content },
      timestamp: new Date().toISOString(),
    });

    // Media preprocessing (voice/image/file)
    let content = message.content;
    if (message.type === 'voice' || message.type === 'file') {
      const sendFn = (cid: string, text: string): Promise<void> =>
        services.sendTelegram(cid, text);
      const result = await this.mediaPreprocessor.preprocess(message, sendFn);

      if (!result.success) {
        this.emitProgress({
          type: 'job:error',
          jobId,
          data: { kind: 'error', message: result.error ?? '미디어 처리 실패' },
          timestamp: new Date().toISOString(),
        });
        await services.sendTelegram(chatId, result.error ?? '미디어 처리 실패');
        return;
      }
      if (result.transcribedText) {
        content = result.transcribedText;
      }
    }

    // Add user message to conversation
    this.conversationState.addMessage(chatId, {
      role: 'user',
      content,
    });

    // Bind send_telegram tool to current chat (Map에 sendFn 등록)
    bindSendTelegram(chatId, services.sendTelegram);

    // Select head model
    const headModel = await this.headSelector.selectHead();

    // AsyncLocalStorage로 chatId를 요청 스코프에 바인딩
    await runInChatContext(chatId, async () => {
      try {
        await this.runLoop(chatId, headModel, services, jobId);
      } catch (err) {
        this.headSelector.reportFailure(headModel, err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        services.logger('error', `AgentLoop error: ${errorMsg}`);
        this.emitProgress({
          type: 'job:error',
          jobId,
          data: { kind: 'error', message: errorMsg },
          timestamp: new Date().toISOString(),
        });
        await services.sendTelegram(chatId, ERROR_MESSAGES.headModelFailure);
      } finally {
        unbindSendTelegram(chatId);
      }
    });
  }

  getConversationState(): ConversationState {
    return this.conversationState;
  }

  private async runLoop(
    chatId: string,
    headModel: HeadModelProvider,
    services: RouteServices,
    jobId?: string,
  ): Promise<void> {
    const tools = this.toolRegistry.list();
    let invalidToolRetries = 0;
    const jid = jobId ?? chatId;

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      // Build messages: system prompt + conversation history
      const systemPrompt = buildSystemPrompt(tools, this.systemPromptConfig);
      const historyMessages = this.conversationState.getMessages(
        chatId,
        headModel.provider,
      );
      const allMessages = [systemPrompt, ...historyMessages];

      // Call HeadModel with timeout + retry
      const response = await this.callHeadModelWithRetry(headModel, allMessages);

      // Report success to circuit breaker
      this.headSelector.reportSuccess(headModel);

      // No tool calls → final text response
      if (!response.toolCalls?.length) {
        this.conversationState.addMessage(chatId, {
          role: 'assistant',
          content: response.content,
        });
        this.emitProgress({
          type: 'job:complete',
          jobId: jid,
          data: { kind: 'complete', content: response.content, model: response.model },
          timestamp: new Date().toISOString(),
        });
        await services.sendTelegram(chatId, response.content, { format: 'markdown' });
        return;
      }

      // Emit chunk for assistant content (if any)
      if (response.content) {
        this.emitProgress({
          type: 'job:chunk',
          jobId: jid,
          data: { kind: 'chunk', content: response.content },
          timestamp: new Date().toISOString(),
        });
      }

      // Has tool calls → execute them
      this.conversationState.addMessage(chatId, {
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls,
      });

      const hasInvalidTool = await this.executeToolCalls(
        chatId,
        response.toolCalls,
        services,
        jid,
      );

      if (hasInvalidTool) {
        invalidToolRetries++;
        if (invalidToolRetries > MAX_INVALID_TOOL_RETRIES) {
          await services.sendTelegram(chatId, ERROR_MESSAGES.headModelFailure);
          return;
        }
      }
    }

    // Max iterations reached
    await services.sendTelegram(chatId, ERROR_MESSAGES.maxIterations);
  }

  private async executeToolCalls(
    chatId: string,
    toolCalls: ToolCall[],
    services: RouteServices,
    jobId?: string,
  ): Promise<boolean> {
    let hasInvalidTool = false;
    const jid = jobId ?? chatId;

    for (const toolCall of toolCalls) {
      // Idempotency: check if already executed
      const cached = this.executedToolCalls.get(toolCall.id);
      if (cached) {
        this.conversationState.addMessage(chatId, {
          role: 'tool',
          content: cached,
          toolCallId: toolCall.id,
        });
        continue;
      }

      // Emit tool start progress
      this.emitProgress({
        type: 'job:progress',
        jobId: jid,
        data: { kind: 'tool_start', toolName: toolCall.name, toolCallId: toolCall.id },
        timestamp: new Date().toISOString(),
      });

      const result = await this.toolExecutor.execute(toolCall, this.toolRegistry);

      // Emit tool end progress
      this.emitProgress({
        type: 'job:progress',
        jobId: jid,
        data: {
          kind: 'tool_end',
          toolName: toolCall.name,
          toolCallId: toolCall.id,
          status: result.status,
          latencyMs: result.latencyMs,
        },
        timestamp: new Date().toISOString(),
      });

      if (result.status === 'error' && result.content.includes('not found')) {
        hasInvalidTool = true;
      }

      // Cache result for idempotency (with size limit)
      if (this.executedToolCalls.size >= MAX_IDEMPOTENCY_CACHE_SIZE) {
        const firstKey = this.executedToolCalls.keys().next().value;
        if (firstKey !== undefined) this.executedToolCalls.delete(firstKey);
      }
      this.executedToolCalls.set(toolCall.id, result.content);

      this.conversationState.addMessage(chatId, {
        role: 'tool',
        content: result.content,
        toolCallId: toolCall.id,
      });

      services.logger('info', `Tool ${toolCall.name}: ${result.status} (${result.latencyMs}ms)`);
    }

    return hasInvalidTool;
  }

  private emitProgress(event: AgentProgressEvent): void {
    try {
      this.onProgress?.(event);
    } catch {
      // Progress callback errors should not break the agent loop
    }
  }

  private async callHeadModelWithRetry(
    headModel: HeadModelProvider,
    messages: AgentMessage[],
  ): Promise<HeadModelResponse> {
    const tools = this.toolRegistry.list();

    try {
      return await withTimeout(
        headModel.chat(messages, tools),
        HEAD_MODEL_TIMEOUT_MS,
      );
    } catch (firstError) {
      // One retry on failure
      try {
        return await withTimeout(
          headModel.chat(messages, tools),
          HEAD_MODEL_TIMEOUT_MS,
        );
      } catch {
        throw firstError;
      }
    }
  }
}

// === Timeout Helper ===

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`HeadModel call timed out after ${ms}ms`)),
      ms,
    );
    promise
      .then((v) => { clearTimeout(timer); resolve(v); })
      .catch((e) => { clearTimeout(timer); reject(e); });
  });
}
