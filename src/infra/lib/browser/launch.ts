/**
 * Puppeteer 브라우저 관리
 *
 * headless Chrome 런치, 페이지 관리, 정리.
 * 싱글턴 패턴으로 세션 내 브라우저 재사용.
 */

import type { BrowserLaunchOptions } from './types.js';

const DEFAULT_VIEWPORT = { width: 1920, height: 1080 };

let browserInstance: unknown = null;

/** Puppeteer 동적 import (optional dependency) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- puppeteer is optional peer dep
async function loadPuppeteer(): Promise<Record<string, any>> {
  try {
    // @ts-expect-error -- puppeteer is optional peer dependency, may not have type declarations
    return await import('puppeteer') as Record<string, any>;
  } catch {
    throw new Error(
      'puppeteer is not installed. Run: npm install puppeteer\n' +
      'Required for UI verification (vibe.figma Phase 4, design-audit, etc.)',
    );
  }
}

/** headless Chrome 브라우저 시작 */
export async function launchBrowser(options: BrowserLaunchOptions = {}): Promise<unknown> {
  if (browserInstance) return browserInstance;

  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.launch({
    headless: options.headless !== false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
    ...(options.executablePath ? { executablePath: options.executablePath } : {}),
  });

  browserInstance = browser;
  return browser;
}

/** 새 페이지 열고 URL 로드 */
export async function openPage(
  browser: unknown,
  url: string,
  viewport?: { width: number; height: number },
): Promise<unknown> {
  const b = browser as { newPage: () => Promise<unknown> };
  const page = await b.newPage() as {
    setViewport: (v: { width: number; height: number }) => Promise<void>;
    goto: (u: string, o: Record<string, string>) => Promise<void>;
  };

  await page.setViewport(viewport ?? DEFAULT_VIEWPORT);
  await page.goto(url, { waitUntil: 'networkidle0' });

  return page;
}

/** 브라우저 종료 */
export async function closeBrowser(): Promise<void> {
  if (!browserInstance) return;

  const b = browserInstance as { close: () => Promise<void> };
  await b.close();
  browserInstance = null;
}

/** 현재 브라우저 인스턴스 반환 (없으면 null) */
export function getBrowser(): unknown {
  return browserInstance;
}
