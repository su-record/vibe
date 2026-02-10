/**
 * Sandbox MCP Tools — Phase 5-4
 *
 * - core_sandbox_status: 샌드박스 상태 조회
 * - core_sandbox_exec: 샌드박스 내 명령 실행
 * - core_sandbox_browser: 샌드박스 브라우저 제어
 */

import type { ToolResult, ToolDefinition } from '../../core/types/tool.js';
import type { SandboxLogger } from '../../pc/sandbox/types.js';
import { ContainerManager } from '../../pc/sandbox/ContainerManager.js';
import { SandboxBrowser } from '../../pc/sandbox/SandboxBrowser.js';
import { ExecAllowlist } from '../../pc/sandbox/ExecAllowlist.js';
import { ToolPolicyEvaluator, getDefaultSaaSPolicy, getDefaultLocalPolicy } from '../../pc/sandbox/ToolPolicy.js';

// ============================================================================
// Singleton
// ============================================================================

let containerManager: ContainerManager | null = null;
let sandboxBrowser: SandboxBrowser | null = null;
let execAllowlist: ExecAllowlist | null = null;
let policyEvaluator: ToolPolicyEvaluator | null = null;
let initialized = false;

function getLogger(): SandboxLogger {
  return (level, message) => {
    if (level === 'error') {
      console.error(`[sandbox] ${message}`);
    }
  };
}

async function ensureManager(): Promise<ContainerManager> {
  if (!containerManager) {
    const logger = getLogger();
    containerManager = new ContainerManager(logger);
    await containerManager.init();
    initialized = true;
  }
  return containerManager;
}

function ensureAllowlist(): ExecAllowlist {
  if (!execAllowlist) {
    execAllowlist = new ExecAllowlist(getLogger());
  }
  return execAllowlist;
}

function ensurePolicy(): ToolPolicyEvaluator {
  if (!policyEvaluator) {
    const logger = getLogger();
    policyEvaluator = new ToolPolicyEvaluator(logger);
    const isSaaS = process.env.VIBE_MODE === 'saas';
    const layers = isSaaS ? getDefaultSaaSPolicy() : getDefaultLocalPolicy();
    policyEvaluator.setLayers(layers);
  }
  return policyEvaluator;
}

async function ensureBrowser(): Promise<SandboxBrowser> {
  if (!sandboxBrowser) {
    const manager = await ensureManager();
    sandboxBrowser = new SandboxBrowser(manager, getLogger());
  }
  return sandboxBrowser;
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

export const sandboxStatusDefinition: ToolDefinition = {
  name: 'core_sandbox_status',
  description: 'sandbox status - Show sandbox container status',
  inputSchema: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: 'Filter by user ID' },
    },
  },
  annotations: {
    title: 'Sandbox Status',
    audience: ['assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export const sandboxExecDefinition: ToolDefinition = {
  name: 'core_sandbox_exec',
  description: 'sandbox exec - Execute command in sandbox container',
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Command to execute' },
      userId: { type: 'string', description: 'User ID (default: local)' },
    },
    required: ['command'],
  },
  annotations: {
    title: 'Sandbox Exec',
    audience: ['assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
};

export const sandboxBrowserDefinition: ToolDefinition = {
  name: 'core_sandbox_browser',
  description: 'sandbox browser - Manage sandbox browser instance',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['create', 'destroy', 'status'], description: 'Action' },
      userId: { type: 'string', description: 'User ID (default: local)' },
    },
    required: ['action'],
  },
  annotations: {
    title: 'Sandbox Browser',
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

export async function sandboxStatus(
  args: { userId?: string },
): Promise<ToolResult> {
  try {
    const manager = await ensureManager();
    const containers = args.userId
      ? manager.getUserContainers(args.userId)
      : manager.getContainers();

    return successResult({
      total: containers.length,
      containers: containers.map(c => ({
        containerId: c.containerId.slice(0, 12),
        userId: c.userId,
        scope: c.scope,
        state: c.state,
        cpu: c.cpuLimit,
        memoryMb: c.memoryLimitMb,
        createdAt: c.createdAt,
        lastActivity: c.lastActivityAt,
      })),
    });
  } catch (err) {
    return errorResult(err);
  }
}

export async function sandboxExec(
  args: { command: string; userId?: string },
): Promise<ToolResult> {
  try {
    // P1: Validate non-empty command
    const command = args.command?.trim();
    if (!command) {
      return errorResult({ message: '명령이 비어있습니다.' });
    }

    const userId = args.userId ?? 'local';
    const allowlist = ensureAllowlist();

    // Check allowlist first
    const check = allowlist.check(command);
    if (check === 'denied') {
      return errorResult({ message: '허용되지 않는 명령입니다.', command });
    }

    // Check tool policy
    const policy = ensurePolicy();
    const policyResult = policy.evaluate('core_sandbox_exec');
    if (!policyResult.allowed && policyResult.action === 'deny') {
      return errorResult({ message: policyResult.reason ?? '정책에 의해 거부되었습니다.' });
    }

    const manager = await ensureManager();

    // Get or create container for user
    const containers = manager.getUserContainers(userId);
    let containerId: string;

    if (containers.length === 0) {
      const info = await manager.create(userId);
      await manager.start(info.containerId);
      containerId = info.containerId;
    } else {
      containerId = containers[0].containerId;
    }

    // Parse command into argv
    const argv = command.split(/\s+/).filter(Boolean);
    const result = await manager.exec(containerId, argv);

    if (check === 'ask') {
      return successResult({
        warning: '이 명령은 Allowlist에 없습니다. 허용 목록에 추가하시겠습니까?',
        command,
        ...result,
      });
    }

    return successResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export async function sandboxBrowserTool(
  args: { action: string; userId?: string },
): Promise<ToolResult> {
  try {
    const userId = args.userId ?? 'local';
    const browser = await ensureBrowser();

    switch (args.action) {
      case 'create': {
        const info = await browser.create(userId);
        return successResult({
          containerId: info.containerId.slice(0, 12),
          cdpUrl: info.cdpUrl,
          cdpPort: info.cdpPort,
          state: info.state,
          message: '샌드박스 브라우저가 생성되었습니다.',
        });
      }
      case 'destroy': {
        await browser.destroy(userId);
        return successResult({ message: '샌드박스 브라우저가 삭제되었습니다.' });
      }
      case 'status': {
        const info = browser.get(userId);
        if (!info) {
          return successResult({ message: '활성 샌드박스 브라우저가 없습니다.' });
        }
        return successResult({
          containerId: info.containerId.slice(0, 12),
          cdpUrl: info.cdpUrl,
          cdpPort: info.cdpPort,
          state: info.state,
        });
      }
      default:
        return errorResult({ message: `알 수 없는 액션: ${args.action}` });
    }
  } catch (err) {
    return errorResult(err);
  }
}

/** 서비스 종료 */
export async function shutdownSandboxService(): Promise<void> {
  if (sandboxBrowser) {
    await sandboxBrowser.destroyAll();
    sandboxBrowser = null;
  }
  if (containerManager) {
    await containerManager.shutdown();
    containerManager = null;
  }
  execAllowlist = null;
  policyEvaluator = null;
  initialized = false;
}
