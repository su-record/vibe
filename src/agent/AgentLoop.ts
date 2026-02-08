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
import type { AgentMessage, HeadModelProvider, HeadModelResponse, ToolCall } from './types.js';
import type { HeadModelSelector } from './HeadModelSelector.js';
import type { ToolRegistry } from './ToolRegistry.js';
import { ConversationState } from './ConversationState.js';
import { ToolExecutor, type AgentLogger } from './ToolExecutor.js';
import { buildSystemPrompt, type SystemPromptConfig } from './SystemPrompt.js';
import { MediaPreprocessor, type MediaPreprocessorConfig } from './preprocessors/MediaPreprocessor.js';
import { bindSendTelegram, unbindSendTelegram } from './tools/send-telegram.js';

const MAX_ITERATIONS = 10;
const HEAD_MODEL_TIMEOUT_MS = 10_000;
const MAX_INVALID_TOOL_RETRIES = 2;

// === Error Messages ===

const ERROR_MESSAGES = {
  headModelFailure: 'AI 모델 연결에 실패했습니다. 잠시 후 다시 시도해주세요.',
  maxIterations: '처리 한도(10회)를 초과했습니다. 요청을 더 구체적으로 해주세요.',
  sessionExpired: '세션이 만료되었습니다. 새 대화를 시작합니다.',
} as const;

// === AgentLoop ===

export interface AgentLoopDeps {
  headSelector: HeadModelSelector;
  toolRegistry: ToolRegistry;
  systemPromptConfig?: SystemPromptConfig;
  mediaPreprocessorConfig?: MediaPreprocessorConfig;
}

export class AgentLoop {
  private headSelector: HeadModelSelector;
  private toolRegistry: ToolRegistry;
  private conversationState = new ConversationState();
  private toolExecutor: ToolExecutor;
  private executedToolCalls = new Map<string, string>(); // idempotency cache
  private systemPromptConfig: SystemPromptConfig | undefined;
  private mediaPreprocessor: MediaPreprocessor;

  constructor(deps: AgentLoopDeps) {
    this.headSelector = deps.headSelector;
    this.toolRegistry = deps.toolRegistry;
    this.systemPromptConfig = deps.systemPromptConfig;
    this.toolExecutor = new ToolExecutor((_level, _msg) => {});
    this.mediaPreprocessor = new MediaPreprocessor(deps.mediaPreprocessorConfig);
  }

  setLogger(logger: AgentLogger): void {
    this.toolExecutor = new ToolExecutor(logger);
  }

  async process(message: ExternalMessage, services: RouteServices): Promise<void> {
    const { chatId } = message;

    // Check session expiry
    if (this.conversationState.isSessionExpired(chatId)) {
      this.conversationState.resetSession(chatId);
    }

    // Media preprocessing (voice/image/file)
    let content = message.content;
    if (message.type === 'voice' || message.type === 'file') {
      const sendFn = (cid: string, text: string): Promise<void> =>
        services.sendTelegram(cid, text);
      const result = await this.mediaPreprocessor.preprocess(message, sendFn);

      if (!result.success) {
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

    // Bind send_telegram tool to current chat
    bindSendTelegram(chatId, services.sendTelegram);

    // Select head model
    const headModel = await this.headSelector.selectHead();

    try {
      await this.runLoop(chatId, headModel, services);
    } catch (err) {
      this.headSelector.reportFailure(headModel, err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      services.logger('error', `AgentLoop error: ${errorMsg}`);
      await services.sendTelegram(chatId, ERROR_MESSAGES.headModelFailure);
    } finally {
      unbindSendTelegram();
    }
  }

  getConversationState(): ConversationState {
    return this.conversationState;
  }

  private async runLoop(
    chatId: string,
    headModel: HeadModelProvider,
    services: RouteServices,
  ): Promise<void> {
    const tools = this.toolRegistry.list();
    let invalidToolRetries = 0;

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
        await services.sendTelegram(chatId, response.content, { format: 'markdown' });
        return;
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
  ): Promise<boolean> {
    let hasInvalidTool = false;

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

      const result = await this.toolExecutor.execute(toolCall, this.toolRegistry);

      if (result.status === 'error' && result.content.includes('not found')) {
        hasInvalidTool = true;
      }

      // Cache result for idempotency
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
