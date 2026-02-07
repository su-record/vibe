/**
 * ScreenshotService - Web page capture via Playwright
 * Supports full page, viewport, and PDF output
 */

import { InterfaceLogger } from '../../interface/types.js';
import { BrowserPool } from '../browser/BrowserPool.js';

export type CaptureMode = 'viewport' | 'fullpage' | 'pdf';

export interface CaptureResult {
  data: Buffer;
  mimeType: string;
  filename: string;
}

/** Minimal Playwright page interface */
interface PlaywrightPage {
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  screenshot(options?: { fullPage?: boolean; type?: string }): Promise<Buffer>;
  pdf(options?: { format?: string }): Promise<Buffer>;
  close(): Promise<void>;
}

/** Minimal Playwright context interface */
interface PlaywrightContext {
  newPage(): Promise<PlaywrightPage>;
  close(): Promise<void>;
  pages(): unknown[];
}

export class ScreenshotService {
  private logger: InterfaceLogger;
  private browserPool: BrowserPool;

  constructor(logger: InterfaceLogger, browserPool: BrowserPool) {
    this.logger = logger;
    this.browserPool = browserPool;
  }

  /** Capture a web page */
  async capture(url: string, mode: CaptureMode = 'viewport'): Promise<CaptureResult> {
    const context = await this.browserPool.acquire() as unknown as PlaywrightContext;
    try {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });

      const result = mode === 'pdf'
        ? await this.capturePdf(page, url)
        : await this.captureImage(page, url, mode === 'fullpage');

      await page.close();
      return result;
    } finally {
      this.browserPool.release(context as unknown as Parameters<BrowserPool['release']>[0]);
    }
  }

  private async captureImage(
    page: PlaywrightPage,
    url: string,
    fullPage: boolean,
  ): Promise<CaptureResult> {
    const data = await page.screenshot({ fullPage, type: 'png' });
    const hostname = new URL(url).hostname.replace(/\./g, '_');
    return { data, mimeType: 'image/png', filename: `screenshot_${hostname}.png` };
  }

  private async capturePdf(page: PlaywrightPage, url: string): Promise<CaptureResult> {
    const data = await page.pdf({ format: 'A4' });
    const hostname = new URL(url).hostname.replace(/\./g, '_');
    return { data, mimeType: 'application/pdf', filename: `page_${hostname}.pdf` };
  }
}
