/**
 * BrowserActions — 상호작용 액션 (click, type, scroll, navigate, screenshot)
 *
 * 모든 액션은 ref 기반으로 동작. 타임아웃 기본 8초, 에러 → JSON 결과.
 */

import type { Page, Locator } from 'playwright';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as crypto from 'node:crypto';
import { RefLocator } from './RefLocator.js';
import type { BrowserService } from './BrowserService.js';
import type {
  BrowserActionResult,
  ClickOptions,
  TypeOptions,
  FormField,
  ScrollOptions,
  ScreenshotOptions,
  NavigateOptions,
  PageState,
  BrowserError,
} from './types.js';
import { ALLOWED_SCHEMES, BLOCKED_HOSTNAMES, BLOCKED_IP_PATTERNS } from './types.js';

const refLocator = new RefLocator();

/** 타임아웃 정규화: [500ms, 60s], 기본 8s */
function normalizeTimeout(timeoutMs?: number, defaultMs = 8000): number {
  return Math.max(500, Math.min(60_000, timeoutMs ?? defaultMs));
}

/** URL 보안 검증 (SSRF 방지) */
function validateUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw createActionError('NAVIGATION_BLOCKED', `Invalid URL: ${url}`);
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    throw createActionError('NAVIGATION_BLOCKED',
      `Blocked scheme "${parsed.protocol}". Only http/https allowed.`);
  }

  const hostname = parsed.hostname;
  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) {
    throw createActionError('NAVIGATION_BLOCKED',
      `Blocked hostname: ${hostname}`);
  }
  for (const pattern of BLOCKED_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      throw createActionError('NAVIGATION_BLOCKED',
        `Blocked private/metadata IP: ${hostname}`);
    }
  }
}

/** 에러 생성 헬퍼 */
function createActionError(
  code: BrowserError['error'],
  message: string,
  extra?: Partial<BrowserError>,
): BrowserError & Error {
  const error = new Error(message) as BrowserError & Error;
  error.error = code;
  error.message = message;
  if (extra?.timeout) error.timeout = extra.timeout;
  if (extra?.retries) error.retries = extra.retries;
  return error;
}

/** 액션 실행 래퍼 (타이밍 + 에러 핸들링) */
async function executeAction(
  action: string,
  fn: () => Promise<unknown>,
): Promise<BrowserActionResult> {
  const start = Date.now();
  try {
    const data = await fn();
    return {
      success: true,
      action,
      data,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const browserErr = err instanceof Error ? err as BrowserError & Error : null;
    return {
      success: false,
      action,
      error: {
        error: browserErr?.error ?? 'UNKNOWN_ERROR',
        message: browserErr?.message ?? String(err),
        timeout: browserErr?.timeout,
      },
      durationMs: Date.now() - start,
    };
  }
}

// ============================================================================
// Actions
// ============================================================================

/** 클릭 액션 */
export async function click(
  page: Page,
  ref: string,
  state: PageState,
  options?: ClickOptions,
  timeoutMs?: number,
): Promise<BrowserActionResult> {
  return executeAction('click', async () => {
    const locator = refLocator.resolve(page, ref, state);
    const timeout = normalizeTimeout(timeoutMs);

    if (options?.clickCount === 2) {
      await locator.dblclick({
        button: options.button,
        modifiers: options.modifiers,
        timeout,
      });
    } else {
      await locator.click({
        button: options?.button,
        clickCount: options?.clickCount,
        modifiers: options?.modifiers,
        timeout,
      });
    }
  });
}

/** 텍스트 입력 액션 */
export async function type(
  page: Page,
  ref: string,
  text: string,
  state: PageState,
  options?: TypeOptions,
  timeoutMs?: number,
): Promise<BrowserActionResult> {
  return executeAction('type', async () => {
    const locator = refLocator.resolve(page, ref, state);
    const timeout = normalizeTimeout(timeoutMs);

    if (options?.slowly) {
      await locator.pressSequentially(text, { delay: 75, timeout });
    } else {
      await locator.fill(text, { timeout });
    }

    if (options?.submit) {
      await page.keyboard.press('Enter');
    }
  });
}

/** 다중 필드 일괄 입력 */
export async function fillForm(
  page: Page,
  fields: FormField[],
  state: PageState,
  timeoutMs?: number,
): Promise<BrowserActionResult> {
  return executeAction('fillForm', async () => {
    const timeout = normalizeTimeout(timeoutMs);
    const results: Array<{ ref: string; success: boolean }> = [];

    for (const field of fields) {
      const locator = refLocator.resolve(page, field.ref, state);

      switch (field.type) {
        case 'checkbox':
          if (field.value === 'true') {
            await locator.check({ timeout });
          } else {
            await locator.uncheck({ timeout });
          }
          break;
        case 'radio':
          await locator.check({ timeout });
          break;
        case 'select':
          await locator.selectOption(field.value, { timeout });
          break;
        default:
          await locator.fill(field.value, { timeout });
      }
      results.push({ ref: field.ref, success: true });
    }

    return { fieldsProcessed: results.length, results };
  });
}

/** 스크롤 액션 */
export async function scroll(
  page: Page,
  direction: ScrollOptions['direction'],
  amount?: number,
  timeoutMs?: number,
): Promise<BrowserActionResult> {
  return executeAction('scroll', async () => {
    const scrollAmount = amount ?? 300;
    const deltaX = direction === 'left' ? -scrollAmount : direction === 'right' ? scrollAmount : 0;
    const deltaY = direction === 'up' ? -scrollAmount : direction === 'down' ? scrollAmount : 0;
    await page.mouse.wheel(deltaX, deltaY);
  });
}

/** 키보드 입력 */
export async function pressKey(
  page: Page,
  key: string,
  modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>,
): Promise<BrowserActionResult> {
  return executeAction('pressKey', async () => {
    const combo = modifiers?.length
      ? `${modifiers.join('+')}+${key}`
      : key;
    await page.keyboard.press(combo);
  });
}

/** URL 이동 */
export async function navigate(
  page: Page,
  url: string,
  options?: NavigateOptions,
  timeoutMs?: number,
): Promise<BrowserActionResult> {
  validateUrl(url);

  return executeAction('navigate', async () => {
    const timeout = normalizeTimeout(timeoutMs, 15_000);
    const response = await page.goto(url, {
      waitUntil: options?.waitUntil ?? 'domcontentloaded',
      timeout,
    });
    return {
      url: page.url(),
      status: response?.status(),
      title: await page.title(),
    };
  });
}

/** 스크린샷 캡처 */
export async function screenshot(
  page: Page,
  screenshotDir: string,
  tenantId: string,
  options?: ScreenshotOptions,
  state?: PageState,
): Promise<BrowserActionResult> {
  return executeAction('screenshot', async () => {
    // 테넌트별 격리 디렉토리 (path.relative 기반 — prefix collision 방지)
    const baseDir = path.resolve(screenshotDir);
    const safeDir = path.resolve(baseDir, tenantId);
    const relative = path.relative(baseDir, safeDir);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw createActionError('SCREENSHOT_FAILED', 'Path traversal blocked');
    }

    await fs.promises.mkdir(safeDir, { recursive: true });

    // 랜덤 파일명
    const filename = `screenshot-${crypto.randomBytes(8).toString('hex')}.png`;
    const filePath = path.join(safeDir, filename);

    let buffer: Buffer;
    if (options?.ref && state) {
      // 요소 스크린샷
      const locator = refLocator.resolve(page, options.ref, state);
      buffer = await locator.screenshot({ timeout: 8000 });
    } else if (options?.ref) {
      // ref 지정됐지만 state 없음 → 에러
      throw createActionError('REF_STALE', 'Snapshot state required for element screenshot. Call core_browser_snapshot first.');
    } else {
      // 페이지 스크린샷
      buffer = await page.screenshot({
        fullPage: options?.fullPage ?? false,
      });
    }

    // 5MB 제한 확인
    const MAX_SIZE = 5 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      throw createActionError('SCREENSHOT_FAILED',
        `Screenshot exceeds 5MB limit (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
    }

    await fs.promises.writeFile(filePath, buffer);

    return {
      filePath,
      sizeBytes: buffer.length,
      fullPage: options?.fullPage ?? false,
    };
  });
}
