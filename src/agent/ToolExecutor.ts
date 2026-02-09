/**
 * ToolExecutor - Tool 실행 엔진
 * Phase 2: Agent Core Loop
 *
 * 기능:
 * - Tool lookup via Map<name, ToolDefinition>
 * - 개별 tool timeout: 30초
 * - 결과 크기 제한: >10KB → 앞/뒤 1KB + truncate 마커
 * - 에러 메시지 템플릿 기반 변환
 * - 감사 로깅 (민감 필드 마스킹)
 */

import type { ToolCall, ToolAuditEntry, ToolExecutionResult, ToolDefinition } from './types.js';

const TOOL_TIMEOUT_MS = 30_000;
const MAX_RESULT_SIZE = 10 * 1024; // 10KB
const KEEP_SIZE = 1024; // 1KB each for head/tail
const SENSITIVE_KEYS = ['key', 'token', 'secret', 'password', 'auth'];
const MAX_AUDIT_LOG_SIZE = 1000;

export type AgentLogger = (level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown) => void;

export class ToolExecutor {
  private auditLog: ToolAuditEntry[] = [];
  private logger: AgentLogger;
  private toolMap: Map<string, ToolDefinition>;

  constructor(logger: AgentLogger, tools: ToolDefinition[] = []) {
    this.logger = logger;
    this.toolMap = new Map(tools.map((t) => [t.name, t]));
  }

  /** Update the tool map (e.g. when tools change) */
  setTools(tools: ToolDefinition[]): void {
    this.toolMap = new Map(tools.map((t) => [t.name, t]));
  }

  async execute(toolCall: ToolCall): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    // Validate tool exists
    const tool = this.toolMap.get(toolCall.name);
    if (!tool) {
      return this.buildError(
        toolCall.name,
        startTime,
        `Tool '${toolCall.name}' not found`,
        'not_found',
      );
    }

    // Execute with timeout (handler receives raw args directly)
    try {
      const rawResult = await withTimeout(
        tool.handler(toolCall.arguments),
        TOOL_TIMEOUT_MS,
        toolCall.name,
      );

      const content = truncateResult(rawResult);
      const latencyMs = Date.now() - startTime;

      this.recordAudit(toolCall, latencyMs, true);
      return { status: 'success', content, latencyMs, toolName: toolCall.name };
    } catch (err) {
      return this.handleExecutionError(toolCall, startTime, err);
    }
  }

  getAuditLog(): readonly ToolAuditEntry[] {
    return this.auditLog;
  }

  private handleExecutionError(
    toolCall: ToolCall,
    startTime: number,
    err: unknown,
  ): ToolExecutionResult {
    const latencyMs = Date.now() - startTime;
    const isTimeout = err instanceof ToolTimeoutError;
    const errorType = isTimeout ? 'timeout' : 'execution';
    const errorMsg = err instanceof Error ? err.message : String(err);

    this.recordAudit(toolCall, latencyMs, false, errorType);
    this.logger('error', `Tool execution failed: ${toolCall.name}`, { error: errorMsg });

    return {
      status: isTimeout ? 'timeout' : 'error',
      content: `도구 실행 중 오류가 발생했습니다: ${toolCall.name} - ${errorMsg}`,
      latencyMs,
      toolName: toolCall.name,
    };
  }

  private buildError(
    toolName: string,
    startTime: number,
    message: string,
    errorType: string,
  ): ToolExecutionResult {
    const latencyMs = Date.now() - startTime;
    this.logger('warn', `Tool error: ${toolName} - ${message}`);
    this.recordAudit(
      { id: '', name: toolName, arguments: {} },
      latencyMs,
      false,
      errorType,
    );
    return { status: 'error', content: message, latencyMs, toolName };
  }

  private recordAudit(
    toolCall: ToolCall,
    latencyMs: number,
    success: boolean,
    errorType?: string,
  ): void {
    if (this.auditLog.length >= MAX_AUDIT_LOG_SIZE) {
      this.auditLog.splice(0, Math.floor(MAX_AUDIT_LOG_SIZE / 4));
    }
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      toolName: toolCall.name,
      args: maskSensitiveFields(toolCall.arguments),
      latencyMs,
      success,
      errorType,
    });
  }
}

// === Timeout Helper ===

class ToolTimeoutError extends Error {
  constructor(toolName: string, timeoutMs: number) {
    super(`Tool '${toolName}' timed out after ${timeoutMs}ms`);
    this.name = 'ToolTimeoutError';
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  toolName: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new ToolTimeoutError(toolName, ms)),
      ms,
    );
    promise
      .then((v) => { clearTimeout(timer); resolve(v); })
      .catch((e) => { clearTimeout(timer); reject(e); });
  });
}

// === Result Truncation ===

function truncateResult(result: string): string {
  if (result.length <= MAX_RESULT_SIZE) return result;

  const sizeKB = (result.length / 1024).toFixed(1);
  const head = result.substring(0, KEEP_SIZE);
  const tail = result.substring(result.length - KEEP_SIZE);
  return `${head}\n\n[...truncated ${sizeKB}KB...]\n\n${tail}`;
}

// === Sensitive Field Masking ===

function maskSensitiveFields(
  args: Record<string, unknown>,
): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    const isSensitive = SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s));
    masked[key] = isSensitive ? '***' : value;
  }
  return masked;
}

export { ToolTimeoutError, truncateResult, maskSensitiveFields };
