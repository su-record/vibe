/**
 * Browser MCP Tools — ARIA Snapshot 기반 브라우저 자동화 도구
 *
 * - core_browser_snapshot: 페이지 ARIA 스냅샷 (AI-friendly 텍스트 + ref)
 * - core_browser_act: 상호작용 (click/type/scroll/pressKey/fillForm)
 * - core_browser_navigate: URL 이동 + 새 탭 열기/닫기
 * - core_browser_screenshot: 스크린샷 캡처
 * - core_browser_status: 브라우저 연결 상태 확인
 */

import type { ToolResult, ToolDefinition } from '../../types/tool.js';
import { BrowserService, LocalBrowserProvider } from '../../browser/BrowserService.js';
import { RoleSnapshotManager } from '../../browser/RoleSnapshotManager.js';
import * as BrowserActions from '../../browser/BrowserActions.js';
import type { BrowserError, PageState, FormField, BrowserActionResult } from '../../browser/types.js';
import * as os from 'node:os';
import * as path from 'node:path';

// ============================================================================
// Runtime Validators (P1: prevent unsafe casting of user input)
// ============================================================================

const VALID_BUTTONS = new Set(['left', 'right', 'middle']);
const VALID_MODIFIERS = new Set(['Alt', 'Control', 'Meta', 'Shift']);
const VALID_DIRECTIONS = new Set(['up', 'down', 'left', 'right']);
const VALID_ACTIONS = new Set(['click', 'type', 'scroll', 'pressKey', 'fillForm']);
const VALID_WAIT_UNTIL = new Set(['load', 'domcontentloaded', 'networkidle']);

function validateButton(v?: string): 'left' | 'right' | 'middle' | undefined {
  if (!v) return undefined;
  return VALID_BUTTONS.has(v) ? v as 'left' | 'right' | 'middle' : undefined;
}

function validateModifiers(v?: string[]): Array<'Alt' | 'Control' | 'Meta' | 'Shift'> | undefined {
  if (!v?.length) return undefined;
  return v.filter(m => VALID_MODIFIERS.has(m)) as Array<'Alt' | 'Control' | 'Meta' | 'Shift'>;
}

function validateDirection(v?: string): 'up' | 'down' | 'left' | 'right' {
  if (v && VALID_DIRECTIONS.has(v)) return v as 'up' | 'down' | 'left' | 'right';
  return 'down';
}

function validateWaitUntil(v?: string): 'load' | 'domcontentloaded' | 'networkidle' | undefined {
  if (!v) return undefined;
  return VALID_WAIT_UNTIL.has(v) ? v as 'load' | 'domcontentloaded' | 'networkidle' : undefined;
}

// ============================================================================
// Singleton Service (lazy init)
// ============================================================================

let browserService: BrowserService | null = null;
const snapshotManager = new RoleSnapshotManager();
const DEFAULT_TENANT = 'local';

function getScreenshotDir(): string {
  return path.join(os.tmpdir(), 'vibe-screenshots');
}

function getLogger(): (level: string, message: string, data?: unknown) => void {
  return (level, message, data) => {
    if (level === 'error') {
      console.error(`[browser] ${message}`, data ?? '');
    }
  };
}

async function getService(): Promise<BrowserService> {
  if (!browserService) {
    browserService = new BrowserService(getLogger(), {
      screenshotDir: getScreenshotDir(),
    });
  }
  if (!browserService.isConnected()) {
    const provider = new LocalBrowserProvider();
    await browserService.connect(provider);
  }
  return browserService;
}

/** 에러 → ToolResult JSON */
function errorResult(err: unknown): ToolResult {
  const browserErr = err instanceof Error ? err as BrowserError & Error : null;
  const errorObj = {
    error: browserErr?.error ?? 'UNKNOWN_ERROR',
    message: browserErr?.message ?? String(err),
    ...(browserErr?.retries !== undefined ? { retries: browserErr.retries } : {}),
    ...(browserErr?.timeout !== undefined ? { timeout: browserErr.timeout } : {}),
  };
  return { content: [{ type: 'text', text: JSON.stringify(errorObj, null, 2) }] };
}

/** BrowserActionResult → ToolResult */
function actionResult(result: BrowserActionResult): ToolResult {
  if (result.success) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          action: result.action,
          data: result.data,
          durationMs: result.durationMs,
        }, null, 2),
      }],
    };
  }
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: false,
        action: result.action,
        error: result.error,
        durationMs: result.durationMs,
      }, null, 2),
    }],
  };
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const browserSnapshotDefinition: ToolDefinition = {
  name: 'core_browser_snapshot',
  description: 'browser snapshot|aria snapshot|page elements - Capture page ARIA snapshot with role-based refs (e1, e2, ...)',
  inputSchema: {
    type: 'object',
    properties: {
      interactive: {
        type: 'boolean',
        description: 'Only include interactive elements (buttons, links, inputs)',
      },
      compact: {
        type: 'boolean',
        description: 'Remove structural elements for compact output',
      },
      maxDepth: {
        type: 'number',
        description: 'Maximum tree depth',
      },
    },
  },
  annotations: {
    title: 'Browser Snapshot',
    audience: ['assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
};

export const browserActDefinition: ToolDefinition = {
  name: 'core_browser_act',
  description: 'browser click|browser type|browser action - Interact with page elements via ref IDs',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['click', 'type', 'scroll', 'pressKey', 'fillForm'],
        description: 'Action to perform',
      },
      ref: {
        type: 'string',
        description: 'Element ref ID (e.g., "e1", "e3")',
      },
      text: {
        type: 'string',
        description: 'Text to type (for type action)',
      },
      key: {
        type: 'string',
        description: 'Key to press (for pressKey action)',
      },
      direction: {
        type: 'string',
        enum: ['up', 'down', 'left', 'right'],
        description: 'Scroll direction',
      },
      fields: {
        type: 'array',
        description: 'Form fields to fill (for fillForm action)',
        items: {
          type: 'object',
          properties: {
            ref: { type: 'string' },
            value: { type: 'string' },
            type: { type: 'string', enum: ['text', 'checkbox', 'radio', 'select'] },
          },
          required: ['ref', 'value'],
        },
      },
      button: {
        type: 'string',
        enum: ['left', 'right', 'middle'],
        description: 'Mouse button (for click)',
      },
      clickCount: { type: 'number', description: 'Click count (2 for double-click)' },
      modifiers: {
        type: 'array',
        items: { type: 'string', enum: ['Alt', 'Control', 'Meta', 'Shift'] },
        description: 'Keyboard modifiers',
      },
      submit: { type: 'boolean', description: 'Press Enter after type' },
      slowly: { type: 'boolean', description: 'Type character by character' },
      amount: { type: 'number', description: 'Scroll amount in pixels' },
    },
    required: ['action'],
  },
  annotations: {
    title: 'Browser Action',
    audience: ['assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
};

export const browserNavigateDefinition: ToolDefinition = {
  name: 'core_browser_navigate',
  description: 'browser go to|open url|navigate - Navigate browser to URL',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to navigate to' },
      waitUntil: {
        type: 'string',
        enum: ['load', 'domcontentloaded', 'networkidle'],
        description: 'Wait condition',
      },
    },
    required: ['url'],
  },
  annotations: {
    title: 'Browser Navigate',
    audience: ['assistant'],
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
};

export const browserScreenshotDefinition: ToolDefinition = {
  name: 'core_browser_screenshot',
  description: 'browser screenshot|capture page|page image - Take page screenshot',
  inputSchema: {
    type: 'object',
    properties: {
      fullPage: { type: 'boolean', description: 'Capture full page (scroll)' },
      ref: { type: 'string', description: 'Capture specific element by ref' },
    },
  },
  annotations: {
    title: 'Browser Screenshot',
    audience: ['assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
};

export const browserStatusDefinition: ToolDefinition = {
  name: 'core_browser_status',
  description: 'browser status|browser connected|is browser running - Check browser connection status',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  annotations: {
    title: 'Browser Status',
    audience: ['user', 'assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

// ============================================================================
// Tool Handlers
// ============================================================================

export async function browserSnapshot(
  args: { interactive?: boolean; compact?: boolean; maxDepth?: number } = {},
): Promise<ToolResult> {
  try {
    const service = await getService();
    const page = await service.getPage(DEFAULT_TENANT);

    const result = await snapshotManager.snapshot(page, {
      interactive: args.interactive,
      compact: args.compact,
      maxDepth: args.maxDepth,
    });

    // 페이지 상태 업데이트
    service.setPageState(page, {
      roleRefs: result.refs,
      snapshotVersion: result.snapshotVersion,
      lastSnapshotAt: new Date().toISOString(),
    });

    return {
      content: [{
        type: 'text',
        text: [
          `ARIA Snapshot (v${result.snapshotVersion})`,
          `Interactive: ${result.interactiveCount} | Total: ${result.totalCount}`,
          `Checksum: ${result.checksum}`,
          '',
          result.tree,
        ].join('\n'),
      }],
    };
  } catch (err) {
    return errorResult(err);
  }
}

export async function browserAct(
  args: {
    action: string;
    ref?: string;
    text?: string;
    key?: string;
    direction?: string;
    fields?: FormField[];
    button?: string;
    clickCount?: number;
    modifiers?: string[];
    submit?: boolean;
    slowly?: boolean;
    amount?: number;
  },
): Promise<ToolResult> {
  try {
    const service = await getService();
    const page = await service.getPage(DEFAULT_TENANT);
    const state = service.getPageState(page);

    if (!state) {
      return errorResult({
        error: 'REF_STALE',
        message: 'No snapshot available. Call core_browser_snapshot first.',
      });
    }

    const timeout = service.actionTimeout;
    let result: BrowserActionResult;

    if (!VALID_ACTIONS.has(args.action)) {
      return errorResult({
        error: 'UNKNOWN_ERROR',
        message: `Unknown action: ${args.action}. Use: click, type, scroll, pressKey, fillForm`,
      });
    }

    switch (args.action) {
      case 'click':
        if (!args.ref) return errorResult({ error: 'REF_NOT_FOUND', message: 'ref is required for click' });
        result = await BrowserActions.click(page, args.ref, state, {
          button: validateButton(args.button),
          clickCount: args.clickCount,
          modifiers: validateModifiers(args.modifiers),
        }, timeout);
        break;

      case 'type':
        if (!args.ref) return errorResult({ error: 'REF_NOT_FOUND', message: 'ref is required for type' });
        if (!args.text) return errorResult({ error: 'REF_NOT_FOUND', message: 'text is required for type' });
        result = await BrowserActions.type(page, args.ref, args.text, state, {
          submit: args.submit,
          slowly: args.slowly,
        }, timeout);
        break;

      case 'scroll':
        result = await BrowserActions.scroll(
          page,
          validateDirection(args.direction),
          args.amount,
          timeout,
        );
        break;

      case 'pressKey':
        if (!args.key) return errorResult({ error: 'REF_NOT_FOUND', message: 'key is required for pressKey' });
        result = await BrowserActions.pressKey(
          page,
          args.key,
          validateModifiers(args.modifiers),
        );
        break;

      case 'fillForm':
        if (!args.fields?.length) return errorResult({ error: 'REF_NOT_FOUND', message: 'fields are required for fillForm' });
        result = await BrowserActions.fillForm(page, args.fields, state, timeout);
        break;

      default:
        return errorResult({
          error: 'UNKNOWN_ERROR',
          message: `Unknown action: ${args.action}`,
        });
    }

    return actionResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export async function browserNavigate(
  args: { url: string; waitUntil?: string },
): Promise<ToolResult> {
  try {
    const service = await getService();
    const page = await service.getPage(DEFAULT_TENANT);

    const result = await BrowserActions.navigate(page, args.url, {
      waitUntil: validateWaitUntil(args.waitUntil),
    });

    return actionResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export async function browserScreenshot(
  args: { fullPage?: boolean; ref?: string } = {},
): Promise<ToolResult> {
  try {
    const service = await getService();
    const page = await service.getPage(DEFAULT_TENANT);
    const state = service.getPageState(page);

    const result = await BrowserActions.screenshot(
      page,
      getScreenshotDir(),
      DEFAULT_TENANT,
      { fullPage: args.fullPage, ref: args.ref },
      state,
    );

    return actionResult(result);
  } catch (err) {
    return errorResult(err);
  }
}

export async function browserStatus(): Promise<ToolResult> {
  const connected = browserService?.isConnected() ?? false;
  const sessions = browserService?.activeSessionCount ?? 0;

  const status = {
    connected,
    activeSessions: sessions,
    provider: connected ? 'local' : 'none',
  };

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(status, null, 2),
    }],
  };
}

/** 서비스 종료 (데몬 stop 시 호출) */
export async function shutdownBrowserService(): Promise<void> {
  if (browserService) {
    await browserService.disconnect();
    browserService = null;
  }
}
