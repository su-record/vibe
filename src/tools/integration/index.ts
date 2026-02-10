/**
 * Integration MCP Tools — Phase 6-5
 *
 * - core_pc_status: 전체 모듈 상태
 * - core_pc_command: 자연어 통합 명령 실행
 * - core_pc_modules: 모듈 활성화/비활성화
 */

import type { ToolResult, ToolDefinition } from '../../core/types/tool.js';
import type { IntegrationLogger, ModuleName } from '../../pc/types.js';
import { ModuleRegistry } from '../../pc/ModuleRegistry.js';
import { CommandDispatcher } from '../../pc/CommandDispatcher.js';
import { SessionContextManager } from '../../pc/SessionContext.js';
import { SecurityGate } from '../../pc/SecurityGate.js';
import { ResultFormatter } from '../../pc/ResultFormatter.js';

// ============================================================================
// Singleton
// ============================================================================

let registry: ModuleRegistry | null = null;
let dispatcher: CommandDispatcher | null = null;
let sessionContext: SessionContextManager | null = null;
let securityGate: SecurityGate | null = null;
let resultFormatter: ResultFormatter | null = null;

function getLogger(): IntegrationLogger {
  return (level, message) => {
    if (level === 'error') {
      console.error(`[integration] ${message}`);
    }
  };
}

function ensureRegistry(): ModuleRegistry {
  if (!registry) {
    registry = new ModuleRegistry(getLogger());
  }
  return registry;
}

function ensureDispatcher(): CommandDispatcher {
  if (!dispatcher) {
    const reg = ensureRegistry();
    const ctx = ensureSessionContext();
    dispatcher = new CommandDispatcher(reg, ctx, getLogger());
  }
  return dispatcher;
}

function ensureSessionContext(): SessionContextManager {
  if (!sessionContext) {
    sessionContext = new SessionContextManager(getLogger());
  }
  return sessionContext;
}

function ensureSecurityGate(): SecurityGate {
  if (!securityGate) {
    securityGate = new SecurityGate(getLogger());
  }
  return securityGate;
}

function ensureResultFormatter(): ResultFormatter {
  if (!resultFormatter) {
    resultFormatter = new ResultFormatter(getLogger());
  }
  return resultFormatter;
}

function successResult(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function errorResult(err: unknown): ToolResult {
  const msg = err instanceof Error ? err.message : String(err);
  return { content: [{ type: 'text', text: JSON.stringify({ error: msg }, null, 2) }] };
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const pcStatusDefinition: ToolDefinition = {
  name: 'core_pc_status',
  description: 'pc status - Show all PC control module status',
  inputSchema: { type: 'object', properties: {} },
  annotations: {
    title: 'PC Status',
    audience: ['assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export const pcCommandDefinition: ToolDefinition = {
  name: 'core_pc_command',
  description: 'pc command - Execute natural language PC control command',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Natural language command' },
      userId: { type: 'string', description: 'User ID' },
      channel: { type: 'string', description: 'Source channel (telegram/slack/web)' },
    },
    required: ['command'],
  },
  annotations: {
    title: 'PC Command',
    audience: ['assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
};

export const pcModulesDefinition: ToolDefinition = {
  name: 'core_pc_modules',
  description: 'pc modules - List and manage PC control modules',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'enable', 'disable'], description: 'Action' },
      module: { type: 'string', description: 'Module name for enable/disable' },
    },
  },
  annotations: {
    title: 'PC Modules',
    audience: ['assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

// ============================================================================
// Tool Handlers
// ============================================================================

export async function pcStatus(): Promise<ToolResult> {
  try {
    const reg = ensureRegistry();
    const modules = reg.getAll();
    const ctx = ensureSessionContext();

    return successResult({
      modules: modules.map(m => ({
        name: m.name,
        state: m.state,
        healthFailCount: m.healthFailCount,
        lastHealthCheck: m.lastHealthCheck,
        error: m.errorMessage,
      })),
      activeSessions: ctx.getActiveCount(),
    });
  } catch (err) {
    return errorResult(err);
  }
}

export async function pcCommand(
  args: { command: string; userId?: string; channel?: string },
): Promise<ToolResult> {
  try {
    const command = args.command?.trim();
    if (!command) {
      return errorResult({ message: '명령이 비어있습니다.' });
    }
    if (command.length > 10_000) {
      return errorResult({ message: '명령이 너무 깁니다. (최대 10,000자)' });
    }

    const userId = args.userId ?? 'local';
    const channel = args.channel ?? 'web';
    const gate = ensureSecurityGate();

    // Security check
    const check = gate.check(userId, channel, command);
    if (!check.allowed) {
      return errorResult({ message: check.reason });
    }

    const disp = ensureDispatcher();
    const start = Date.now();

    let result;
    if (disp.isCompound(command)) {
      result = await disp.dispatchCompound(command, userId, channel);
      gate.logExecution(userId, channel, command, 'compound',
        result.steps.every(s => s.success) ? 'success' : 'error',
        Date.now() - start);
      return successResult(result);
    }

    const singleResult = await disp.dispatch(command, userId, channel);
    gate.logExecution(userId, channel, command, singleResult.module,
      singleResult.success ? 'success' : 'error',
      singleResult.durationMs);

    const fmt = ensureResultFormatter();
    const formatted = fmt.format(singleResult, channel as 'telegram' | 'slack' | 'voice' | 'web');

    return successResult({ result: singleResult, formatted });
  } catch (err) {
    return errorResult(err);
  }
}

export async function pcModules(
  args: { action?: string; module?: string },
): Promise<ToolResult> {
  try {
    const reg = ensureRegistry();
    const action = args.action ?? 'list';

    if (action === 'list') {
      return successResult({
        modules: reg.getAll().map(m => ({
          name: m.name,
          state: m.state,
        })),
      });
    }

    if ((action === 'enable' || action === 'disable') && args.module) {
      const validModules: ModuleName[] = ['browser', 'google', 'voice', 'vision', 'sandbox'];
      if (!validModules.includes(args.module as ModuleName)) {
        return errorResult({ message: `알 수 없는 모듈: ${args.module}` });
      }

      if (action === 'enable') {
        const ok = await reg.initModule(args.module as ModuleName);
        return successResult({ module: args.module, enabled: ok });
      }
      // disable handled by shutdown
      return successResult({ module: args.module, message: 'disable는 데몬 재시작 필요' });
    }

    return errorResult({ message: `알 수 없는 액션: ${action}` });
  } catch (err) {
    return errorResult(err);
  }
}

/** 서비스 종료 */
export async function shutdownIntegrationService(): Promise<void> {
  if (registry) {
    await registry.shutdownAll();
    registry = null;
  }
  sessionContext?.shutdown();
  sessionContext = null;
  dispatcher = null;
  securityGate = null;
  resultFormatter = null;
}
