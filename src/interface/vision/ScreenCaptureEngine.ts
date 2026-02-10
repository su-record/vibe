/**
 * Screen Capture Engine — Phase 4-1
 *
 * Multi-source capture: Local (screenshot-desktop), CDP, Remote (stub).
 * Downscale full screen to 1280x720. WebP compression via Sharp.
 */

import type {
  CaptureMode,
  CaptureRegion,
  CaptureResult,
  ICaptureSource,
  VisionLogger,
} from './types.js';
import { createVisionError } from './types.js';

const FULL_SCREEN_WIDTH = 1280;
const FULL_SCREEN_HEIGHT = 720;
const MAX_WEBP_QUALITY = 80;

// ============================================================================
// Sharp dynamic import shape
// ============================================================================

interface SharpInstance {
  resize(width: number, height: number, opts?: { fit?: string }): SharpInstance;
  extract(region: { left: number; top: number; width: number; height: number }): SharpInstance;
  webp(opts?: { quality?: number }): SharpInstance;
  toBuffer(): Promise<Buffer>;
  metadata(): Promise<{ width?: number; height?: number }>;
}

type SharpFactory = (input: Buffer) => SharpInstance;

async function loadSharp(): Promise<SharpFactory> {
  try {
    const mod = 'sharp';
    const imported = (await import(mod)) as { default: SharpFactory };
    return imported.default;
  } catch {
    throw createVisionError('CAPTURE_FAILED', 'sharp 패키지가 설치되지 않았습니다. npm install sharp');
  }
}

// ============================================================================
// Local Capture Source (screenshot-desktop)
// ============================================================================

interface ScreenshotDesktopFn {
  (opts?: { format?: string }): Promise<Buffer>;
  listDisplays(): Promise<Array<{ id: unknown; name?: string }>>;
}

export class LocalCaptureSource implements ICaptureSource {
  readonly type = 'local' as const;
  private logger: VisionLogger;

  constructor(logger: VisionLogger) {
    this.logger = logger;
  }

  isAvailable(): boolean {
    return process.platform === 'win32' || process.platform === 'darwin' || process.platform === 'linux';
  }

  async captureFullScreen(): Promise<CaptureResult> {
    const screenshotFn = await this.loadScreenshotDesktop();
    const buffer = await screenshotFn({ format: 'png' });
    return this.buildResult(buffer, 'full');
  }

  async captureRegion(region: CaptureRegion): Promise<CaptureResult> {
    this.validateRegion(region);
    const screenshotFn = await this.loadScreenshotDesktop();
    const fullBuffer = await screenshotFn({ format: 'png' });
    const sharp = await loadSharp();
    const cropped = await sharp(fullBuffer)
      .extract({ left: region.x, top: region.y, width: region.width, height: region.height })
      .toBuffer();
    return this.buildResult(cropped, 'region');
  }

  async captureWindow(_windowId: string): Promise<CaptureResult> {
    // On desktop, capture full screen — window isolation requires OS-specific APIs
    this.logger('warn', 'Window capture falls back to full screen on local source');
    return this.captureFullScreen();
  }

  private async loadScreenshotDesktop(): Promise<ScreenshotDesktopFn> {
    try {
      const mod = 'screenshot-desktop';
      const imported = (await import(mod)) as { default: ScreenshotDesktopFn };
      return imported.default;
    } catch {
      throw createVisionError('CAPTURE_FAILED', 'screenshot-desktop 패키지가 설치되지 않았습니다.');
    }
  }

  private validateRegion(region: CaptureRegion): void {
    if (region.width < 100 || region.height < 100) {
      throw createVisionError('REGION_INVALID', '최소 캡처 영역은 100x100px입니다.');
    }
    if (region.x < 0 || region.y < 0) {
      throw createVisionError('REGION_INVALID', '음수 좌표는 지원되지 않습니다.');
    }
  }

  private buildResult(buffer: Buffer, mode: CaptureMode): CaptureResult {
    return {
      buffer,
      width: 0,
      height: 0,
      format: 'png',
      sizeBytes: buffer.length,
      capturedAt: new Date().toISOString(),
      mode,
    };
  }
}

// ============================================================================
// CDP Capture Source (Chrome DevTools Protocol)
// ============================================================================

interface CDPSession {
  send(method: string, params?: Record<string, unknown>): Promise<{ data: string }>;
}

export class CDPCaptureSource implements ICaptureSource {
  readonly type = 'cdp' as const;
  private session: CDPSession | null = null;
  private logger: VisionLogger;

  constructor(logger: VisionLogger) {
    this.logger = logger;
  }

  setSession(session: CDPSession): void {
    this.session = session;
  }

  isAvailable(): boolean {
    return this.session !== null;
  }

  async captureFullScreen(): Promise<CaptureResult> {
    const buffer = await this.cdpCapture();
    return this.buildResult(buffer, 'full');
  }

  async captureRegion(region: CaptureRegion): Promise<CaptureResult> {
    const buffer = await this.cdpCapture({
      clip: { x: region.x, y: region.y, width: region.width, height: region.height, scale: 1 },
    });
    return this.buildResult(buffer, 'region');
  }

  async captureWindow(_windowId: string): Promise<CaptureResult> {
    return this.captureFullScreen();
  }

  private async cdpCapture(params?: Record<string, unknown>): Promise<Buffer> {
    if (!this.session) {
      throw createVisionError('CAPTURE_FAILED', 'CDP 세션이 연결되지 않았습니다.');
    }
    const result = await this.session.send('Page.captureScreenshot', {
      format: 'png',
      ...params,
    });
    return Buffer.from(result.data, 'base64');
  }

  private buildResult(buffer: Buffer, mode: CaptureMode): CaptureResult {
    return {
      buffer,
      width: 0,
      height: 0,
      format: 'png',
      sizeBytes: buffer.length,
      capturedAt: new Date().toISOString(),
      mode,
    };
  }
}

// ============================================================================
// Remote Capture Source (PWA stub — Phase 6)
// ============================================================================

export class RemoteCaptureSource implements ICaptureSource {
  readonly type = 'remote' as const;

  isAvailable(): boolean {
    return false;
  }

  async captureFullScreen(): Promise<CaptureResult> {
    throw createVisionError('CAPTURE_FAILED', 'RemoteCaptureSource는 Phase 6에서 구현됩니다.');
  }

  async captureRegion(_region: CaptureRegion): Promise<CaptureResult> {
    throw createVisionError('CAPTURE_FAILED', 'RemoteCaptureSource는 Phase 6에서 구현됩니다.');
  }

  async captureWindow(_windowId: string): Promise<CaptureResult> {
    throw createVisionError('CAPTURE_FAILED', 'RemoteCaptureSource는 Phase 6에서 구현됩니다.');
  }
}

// ============================================================================
// Screen Capture Engine (orchestrator + resize + compress)
// ============================================================================

export class ScreenCaptureEngine {
  private sources: ICaptureSource[];
  private logger: VisionLogger;

  constructor(sources: ICaptureSource[], logger: VisionLogger) {
    this.sources = sources;
    this.logger = logger;
  }

  async capture(mode: CaptureMode, region?: CaptureRegion, windowId?: string): Promise<CaptureResult> {
    const source = this.findAvailableSource();

    let result: CaptureResult;
    switch (mode) {
      case 'full':
        result = await source.captureFullScreen();
        result = await this.downscale(result, FULL_SCREEN_WIDTH, FULL_SCREEN_HEIGHT);
        break;
      case 'region':
        if (!region) throw createVisionError('REGION_INVALID', 'Region 좌표가 필요합니다.');
        result = await source.captureRegion(region);
        break;
      case 'window':
        if (!windowId) throw createVisionError('WINDOW_NOT_FOUND', '윈도우 ID가 필요합니다.');
        result = await source.captureWindow(windowId);
        break;
    }

    return this.compress(result);
  }

  private findAvailableSource(): ICaptureSource {
    for (const src of this.sources) {
      if (src.isAvailable()) return src;
    }
    throw createVisionError('ALL_SOURCES_FAILED', '사용 가능한 캡처 소스가 없습니다.');
  }

  private async downscale(result: CaptureResult, width: number, height: number): Promise<CaptureResult> {
    try {
      const sharp = await loadSharp();
      const resized = await sharp(result.buffer)
        .resize(width, height, { fit: 'inside' })
        .toBuffer();
      const meta = await sharp(resized).metadata();
      return {
        ...result,
        buffer: resized,
        width: meta.width ?? width,
        height: meta.height ?? height,
        sizeBytes: resized.length,
      };
    } catch (err) {
      this.logger('warn', `Downscale 실패, 원본 사용: ${err instanceof Error ? err.message : String(err)}`);
      return result;
    }
  }

  private async compress(result: CaptureResult): Promise<CaptureResult> {
    try {
      const sharp = await loadSharp();
      const webpBuf = await sharp(result.buffer)
        .webp({ quality: MAX_WEBP_QUALITY })
        .toBuffer();
      return {
        ...result,
        buffer: webpBuf,
        format: 'webp',
        sizeBytes: webpBuf.length,
      };
    } catch (err) {
      this.logger('warn', `WebP 압축 실패, PNG 유지: ${err instanceof Error ? err.message : String(err)}`);
      return result;
    }
  }
}
