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

import * as crypto from 'node:crypto';
import type { ExternalMessage } from '../interface/types.js';
import type { RouteServices } from '../router/types.js';
import type { AgentMessage, AgentProgressEvent, AgentToolDefinition, HeadModelProvider, HeadModelResponse, ToolCall, ToolDefinition } from './types.js';
import type { HeadModelSelector } from './HeadModelSelector.js';
import type { PolicyEngine } from '../infra/policy/PolicyEngine.js';
import type { EvalContext } from '../infra/policy/types.js';
import type { RateLimiter } from './RateLimiter.js';
import type { ConversationStore } from './ConversationStore.js';
import { ConversationState } from './ConversationState.js';
import { ToolExecutor, type AgentLogger } from './ToolExecutor.js';
import { buildSystemPrompt, formatConversationHistoryBlock, isExternalChannel, truncateInput, wrapUserMessage, type SystemPromptConfig } from './SystemPrompt.js';
import { MediaPreprocessor, type MediaPreprocessorConfig } from './preprocessors/MediaPreprocessor.js';
import { bindSendTelegram, unbindSendTelegram, runInChatContext } from './tools/send-telegram.js';
import { bindSendSlack, unbindSendSlack, runInSlackContext } from './tools/send-slack.js';

type ChannelSendFn = (chatId: string, text: string, options?: { format?: 'text' | 'markdown' | 'html' }) => Promise<void>;

const MAX_ITERATIONS = 10;
const HEAD_MODEL_TIMEOUT_MS = 10_000;
const MAX_INVALID_TOOL_RETRIES = 2;
const MAX_IDEMPOTENCY_CACHE_SIZE = 500;
// sonolbot-v2: Import from centralized constants
import { MESSAGING } from '../infra/lib/constants.js';
const MAX_DRAIN_INJECTIONS = MESSAGING.MAX_INJECTION_PER_PROCESS;
const MAX_INJECTION_CHARS = MESSAGING.MAX_INJECTION_CHARS;

// === Error Messages ===

const ERROR_MESSAGES = {
  headModelFailure: 'AI 모델 연결에 실패했습니다. 잠시 후 다시 시도해주세요.',
  maxIterations: '처리 한도(10회)를 초과했습니다. 요청을 더 구체적으로 해주세요.',
  sessionExpired: '세션이 만료되었습니다. 새 대화를 시작합니다.',
} as const;

// === AgentLoop ===

export type OnProgressCallback = (event: AgentProgressEvent) => void;

/** Callback to drain pending instructions from SessionPool (Phase 4) */
export type PendingInstructionsProvider = () => string | null;

/** Callback to drain pending messages for mid-task injection (sonolbot-v2 Phase 2) */
export type DrainPendingFn = () => ExternalMessage[];

/** Phase 5: Conversation history callbacks */
export type ConversationHistoryGetter = (chatId: string) => Array<{ role: string; content: string; timestamp: string }>;
export type ConversationEntrySaver = (chatId: string, role: 'user' | 'assistant', content: string) => void;

export interface AgentLoopDeps {
  headSelector: HeadModelSelector;
  tools: ToolDefinition[];
  systemPromptConfig?: SystemPromptConfig;
  mediaPreprocessorConfig?: MediaPreprocessorConfig;
  onProgress?: OnProgressCallback;
  policyEngine?: PolicyEngine;
  rateLimiter?: RateLimiter;
  conversationStore?: ConversationStore;
}

const MAX_INJECTIONS_PER_SESSION = 3;

/** Phase 7: Response style configuration */
export interface ResponseStyleConfig {
  format: 'text' | 'markdown' | 'html';
  useEmoji: boolean;
  tone: 'conversational' | 'formal';
  allowMarkdownForCode: boolean;
}

const DEFAULT_RESPONSE_STYLE: ResponseStyleConfig = {
  format: 'text',
  useEmoji: true,
  tone: 'conversational',
  allowMarkdownForCode: true,
};

/** Determine format for a response: markdown if code block detected + allowed */
function resolveFormat(
  content: string,
  channel: string | undefined,
  style: ResponseStyleConfig,
): 'text' | 'markdown' | 'html' {
  // CLI channel always uses markdown
  if (!isExternalChannel(channel)) return 'markdown';
  // Dynamic: code blocks → markdown if allowed
  if (style.allowMarkdownForCode && content.includes('```')) return 'markdown';
  return style.format;
}

export class AgentLoop {
  private headSelector: HeadModelSelector;
  private tools: ToolDefinition[];
  private conversationState = new ConversationState();
  private conversationStore: ConversationStore | undefined;
  private toolExecutor: ToolExecutor;
  private executedToolCalls = new Map<string, string>(); // idempotency cache
  private systemPromptConfig: SystemPromptConfig | undefined;
  private mediaPreprocessor: MediaPreprocessor;
  private onProgress: OnProgressCallback | undefined;
  private policyEngine: PolicyEngine | undefined;
  private rateLimiter: RateLimiter | undefined;
  private pendingInstructionsProvider: PendingInstructionsProvider | undefined;
  private conversationHistoryGetter: ConversationHistoryGetter | undefined;
  private conversationEntrySaver: ConversationEntrySaver | undefined;
  private responseStyle: ResponseStyleConfig = { ...DEFAULT_RESPONSE_STYLE };

  constructor(deps: AgentLoopDeps) {
    this.headSelector = deps.headSelector;
    this.tools = deps.tools;
    this.systemPromptConfig = deps.systemPromptConfig;
    this.toolExecutor = new ToolExecutor((_level, _msg) => {}, deps.tools);
    this.mediaPreprocessor = new MediaPreprocessor(deps.mediaPreprocessorConfig);
    this.onProgress = deps.onProgress;
    this.policyEngine = deps.policyEngine;
    this.rateLimiter = deps.rateLimiter;
    this.conversationStore = deps.conversationStore;
  }

  setOnProgress(callback: OnProgressCallback | undefined): void {
    this.onProgress = callback;
  }

  /** Phase 7: Set response style config */
  setResponseStyle(style: Partial<ResponseStyleConfig>): void {
    this.responseStyle = { ...DEFAULT_RESPONSE_STYLE, ...style };
  }

  setLogger(logger: AgentLogger): void {
    this.toolExecutor = new ToolExecutor(logger, this.tools);
  }

  /** Set provider for mid-task instruction injection (Phase 4) */
  setPendingInstructionsProvider(provider: PendingInstructionsProvider): void {
    this.pendingInstructionsProvider = provider;
  }

  /** Set conversation history callbacks (Phase 5) */
  setConversationHistoryCallbacks(
    getter: ConversationHistoryGetter,
    saver: ConversationEntrySaver,
  ): void {
    this.conversationHistoryGetter = getter;
    this.conversationEntrySaver = saver;
  }

  /** Get MediaPreprocessor for external use (Phase 2: pending message preprocessing) */
  getMediaPreprocessor(): MediaPreprocessor {
    return this.mediaPreprocessor;
  }

  async process(
    message: ExternalMessage,
    services: RouteServices,
    drainPendingFn?: DrainPendingFn,
  ): Promise<void> {
    const { chatId, channel } = message;
    const jobId = message.id;

    // Check session expiry
    const backend = this.getConvBackend();
    if (backend.isSessionExpired(chatId)) {
      backend.resetSession(chatId);
    }

    // Emit job:created
    this.emitProgress({
      type: 'job:created',
      jobId,
      data: { kind: 'created', chatId, content: message.content },
      timestamp: new Date().toISOString(),
    });

    // Channel-agnostic send function
    const sendFn: ChannelSendFn = async (cid, text, options) => {
      if (channel === 'telegram') {
        if (options) {
          await services.sendTelegram(cid, text, options);
        } else {
          await services.sendTelegram(cid, text);
        }
      } else if (services.sendToChannel) {
        if (options) {
          await services.sendToChannel(channel, cid, text, options);
        } else {
          await services.sendToChannel(channel, cid, text);
        }
      } else {
        services.logger('error', `No send function for channel: ${channel}`);
      }
    };

    // Media preprocessing (voice/image/file)
    let content = message.content;
    if (message.type === 'voice' || message.type === 'file') {
      const result = await this.mediaPreprocessor.preprocess(message, sendFn);

      if (!result.success) {
        this.emitProgress({
          type: 'job:error',
          jobId,
          data: { kind: 'error', message: result.error ?? '미디어 처리 실패' },
          timestamp: new Date().toISOString(),
        });
        await sendFn(chatId, result.error ?? '미디어 처리 실패');
        return;
      }
      if (result.transcribedText) {
        content = result.transcribedText;
      }
    }

    // Apply input truncation and wrapping for prompt injection defense
    content = truncateInput(content);

    // Add user message to conversation with wrapped content
    this.getConvBackend().addMessage(chatId, {
      role: 'user',
      content: wrapUserMessage(content),
    });

    // Phase 5: Auto-save user message to conversation history
    if (this.conversationEntrySaver) {
      try { this.conversationEntrySaver(chatId, 'user', content); } catch { /* ignore */ }
    }

    // Bind channel-specific send tool
    this.bindChannelTool(channel, chatId, message, services);

    // Select head model
    const headModel = await this.headSelector.selectHead();

    // Run in channel-specific AsyncLocalStorage context
    const runInContext = channel === 'slack' ? runInSlackContext
      : runInChatContext;

    await runInContext(chatId, async () => {
      try {
        await this.runLoop(chatId, headModel, services, sendFn, jobId, channel, drainPendingFn);
      } catch (err) {
        this.headSelector.reportFailure(headModel, err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        services.logger('error', `AgentLoop error: ${errorMsg}`);

        // Immediate fallback to Claude when GPT fails
        if (headModel.provider === 'gpt') {
          services.logger('info', 'Falling back to Claude head model...');
          const claudeModel = this.headSelector.getClaudeProvider();
          try {
            await this.runLoop(chatId, claudeModel, services, sendFn, jobId, channel, drainPendingFn);
            return;
          } catch (fallbackErr) {
            const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
            services.logger('error', `Claude fallback error: ${fallbackMsg}`);
          }
        }

        this.emitProgress({
          type: 'job:error',
          jobId,
          data: { kind: 'error', message: errorMsg },
          timestamp: new Date().toISOString(),
        });
        await sendFn(chatId, ERROR_MESSAGES.headModelFailure);
      } finally {
        this.unbindChannelTool(channel, chatId);
      }
    });
  }

  private bindChannelTool(
    channel: string,
    chatId: string,
    message: ExternalMessage,
    services: RouteServices,
  ): void {
    switch (channel) {
      case 'slack':
        if (services.sendToChannel) {
          const slackSendFn = (cid: string, text: string, opts?: { thread_ts?: string }): Promise<void> =>
            services.sendToChannel!(channel, cid, text, { threadId: opts?.thread_ts });
          const allowedChannelIds = (message.metadata?.allowedChannelIds as string[]) ?? [chatId];
          bindSendSlack(chatId, slackSendFn, allowedChannelIds);
        }
        break;
      default:
        bindSendTelegram(chatId, services.sendTelegram);
        break;
    }
  }

  private unbindChannelTool(channel: string, chatId: string): void {
    switch (channel) {
      case 'slack':
        unbindSendSlack(chatId);
        break;
      default:
        unbindSendTelegram(chatId);
        break;
    }
  }

  getConversationState(): ConversationState {
    return this.conversationState;
  }

  /**
   * Get conversation backend (store or state)
   * If conversationStore is provided, use it; otherwise use in-memory conversationState
   */
  private getConvBackend(): ConversationStore | ConversationState {
    return this.conversationStore ?? this.conversationState;
  }

  private async runLoop(
    chatId: string,
    headModel: HeadModelProvider,
    services: RouteServices,
    sendFn: ChannelSendFn,
    jobId?: string,
    channel?: string,
    drainPendingFn?: DrainPendingFn,
  ): Promise<void> {
    const tools: AgentToolDefinition[] = this.tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      scope: t.scope,
    }));
    let invalidToolRetries = 0;
    let injectionCount = 0;
    let drainInjectionCount = 0;
    const jid = jobId ?? chatId;

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      // sonolbot-v2 Phase 2: Drain pending messages for mid-task injection
      if (drainPendingFn && drainInjectionCount < MAX_DRAIN_INJECTIONS) {
        const pendingMsgs = drainPendingFn();
        if (pendingMsgs.length > 0) {
          let injectedCount = 0;
          for (const msg of pendingMsgs) {
            if (drainInjectionCount >= MAX_DRAIN_INJECTIONS) break;
            drainInjectionCount++;
            injectedCount++;
            const requestId = crypto.randomUUID();
            let content = msg.content;
            if (content.length > MAX_INJECTION_CHARS) {
              content = content.slice(0, MAX_INJECTION_CHARS) + '[...truncated]';
            }
            this.getConvBackend().addMessage(chatId, {
              role: 'user',
              content: wrapUserMessage(
                `[ADDITIONAL_REQUEST:${requestId}]\n${content}\n[/ADDITIONAL_REQUEST]\n위 요청을 현재 작업에 반영하세요.`,
              ),
            });
          }
          if (injectedCount > 0) {
            await sendFn(chatId, `✅ 새로운 요청 ${injectedCount}개 반영`);
          }
        }
      }

      // Phase 4: Mid-task instruction injection
      if (injectionCount < MAX_INJECTIONS_PER_SESSION && this.pendingInstructionsProvider) {
        const pending = this.pendingInstructionsProvider();
        if (pending) {
          injectionCount++;
          this.getConvBackend().addMessage(chatId, {
            role: 'user',
            content: wrapUserMessage(`⚠️ [새로운 지시사항]\n${pending}\n[지시사항 끝]`),
          });
          await sendFn(chatId, `✅ 새로운 요청 ${injectionCount}개 확인`);
        }
      }

      // Build messages: system prompt + conversation history
      const systemPrompt = buildSystemPrompt(tools, this.systemPromptConfig);

      // Phase 5: Inject 24h conversation history into system prompt (first iteration only)
      if (iteration === 0 && this.conversationHistoryGetter) {
        const recentHistory = this.conversationHistoryGetter(chatId);
        const historyBlock = formatConversationHistoryBlock(recentHistory);
        if (historyBlock) {
          systemPrompt.content += historyBlock;
        }
      }

      const backend = this.getConvBackend();
      const historyMessages = backend.getMessages(
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
        this.getConvBackend().addMessage(chatId, {
          role: 'assistant',
          content: response.content,
        });
        this.emitProgress({
          type: 'job:complete',
          jobId: jid,
          data: { kind: 'complete', content: response.content, model: response.model },
          timestamp: new Date().toISOString(),
        });
        const fmt = resolveFormat(response.content, channel, this.responseStyle);
        await sendFn(chatId, response.content, { format: fmt });

        // Phase 5: Auto-save assistant response to conversation history
        if (this.conversationEntrySaver) {
          try { this.conversationEntrySaver(chatId, 'assistant', response.content); } catch { /* ignore */ }
        }
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
      this.getConvBackend().addMessage(chatId, {
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
          await sendFn(chatId, ERROR_MESSAGES.headModelFailure);
          return;
        }
      }
    }

    // Max iterations reached
    await sendFn(chatId, ERROR_MESSAGES.maxIterations);
  }

  private async executeToolCalls(
    chatId: string,
    toolCalls: ToolCall[],
    services: RouteServices,
    jobId?: string,
  ): Promise<boolean> {
    let hasInvalidTool = false;
    const jid = jobId ?? chatId;

    const backend = this.getConvBackend();

    for (const toolCall of toolCalls) {
      // Idempotency: check if already executed
      const cached = this.executedToolCalls.get(toolCall.id);
      if (cached) {
        backend.addMessage(chatId, {
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

      // Rate limit check
      if (this.rateLimiter) {
        const rateCheck = this.rateLimiter.check(chatId, toolCall.name);
        if (!rateCheck.allowed) {
          const rateLimitResult = rateCheck.message ?? `Rate limit exceeded: ${toolCall.name}`;
          backend.addMessage(chatId, {
            role: 'tool',
            content: rateLimitResult,
            toolCallId: toolCall.id,
          });
          this.emitProgress({
            type: 'job:progress',
            jobId: jid,
            data: {
              kind: 'tool_end',
              toolName: toolCall.name,
              toolCallId: toolCall.id,
              status: 'rejected',
              latencyMs: 0,
            },
            timestamp: new Date().toISOString(),
          });
          continue;
        }
        this.rateLimiter.record(chatId, toolCall.name);
      }

      // Policy check
      if (this.policyEngine) {
        const evalContext: EvalContext = {
          actions: [{
            type: 'tool_call',
            target: toolCall.name,
            command: JSON.stringify(toolCall.arguments),
          }],
          projectPath: '',
          riskLevel: 'none',
        };

        try {
          const policyResult = this.policyEngine.evaluate(evalContext, jid);

          if (policyResult.decision === 'reject') {
            const rejectMsg = policyResult.reasons.length > 0
              ? policyResult.reasons[0].message
              : '도구 실행이 보안 정책에 의해 차단되었습니다';
            backend.addMessage(chatId, {
              role: 'tool',
              content: rejectMsg,
              toolCallId: toolCall.id,
            });
            this.emitProgress({
              type: 'job:progress',
              jobId: jid,
              data: {
                kind: 'tool_end',
                toolName: toolCall.name,
                toolCallId: toolCall.id,
                status: 'rejected',
                latencyMs: 0,
              },
              timestamp: new Date().toISOString(),
            });
            continue;
          }

          if (policyResult.decision === 'warn') {
            services.logger('warn', `Policy warning for ${toolCall.name}: ${policyResult.reasons.map(r => r.message).join(', ')}`);
          }
        } catch (err) {
          // PolicyEngine error → fail-closed (block tool execution)
          services.logger('error', `PolicyEngine error: ${err instanceof Error ? err.message : String(err)}`);
          backend.addMessage(chatId, {
            role: 'tool',
            content: '정책 엔진 오류로 도구 실행이 차단되었습니다.',
            toolCallId: toolCall.id,
          });
          this.emitProgress({
            type: 'job:progress',
            jobId: jid,
            data: {
              kind: 'tool_end',
              toolName: toolCall.name,
              toolCallId: toolCall.id,
              status: 'rejected',
              latencyMs: 0,
            },
            timestamp: new Date().toISOString(),
          });
          continue;
        }
      }

      const result = await this.toolExecutor.execute(toolCall);

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

      backend.addMessage(chatId, {
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
    const tools: AgentToolDefinition[] = this.tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
      scope: t.scope,
    }));

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
