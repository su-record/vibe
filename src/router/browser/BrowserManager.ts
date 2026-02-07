/**
 * BrowserManager - Playwright browser management
 * Supports both dedicated bot profile and user's Chrome profile
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { InterfaceLogger } from '../../interface/types.js';

const DEFAULT_PROFILE_DIR = path.join(
  os.homedir(),
  process.platform === 'win32' ? 'AppData/Roaming/vibe/browser-profile' : '.config/vibe/browser-profile',
);

/** Detect user's Chrome profile directory */
function detectChromeProfileDir(): string | null {
  const home = os.homedir();
  const candidates = process.platform === 'win32'
    ? [
        path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data'),
        path.join(home, 'AppData', 'Local', 'Chromium', 'User Data'),
      ]
    : process.platform === 'darwin'
      ? [
          path.join(home, 'Library', 'Application Support', 'Google', 'Chrome'),
          path.join(home, 'Library', 'Application Support', 'Chromium'),
        ]
      : [
          path.join(home, '.config', 'google-chrome'),
          path.join(home, '.config', 'chromium'),
        ];

  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}

/** Playwright types (dynamic import to avoid hard dependency) */
interface BrowserContext {
  newPage(): Promise<unknown>;
  close(): Promise<void>;
  pages(): unknown[];
}

interface Browser {
  close(): Promise<void>;
}

interface PlaywrightChromium {
  launchPersistentContext(
    userDataDir: string,
    options: Record<string, unknown>,
  ): Promise<BrowserContext>;
}

interface PlaywrightModule {
  chromium: PlaywrightChromium;
}

export interface BrowserManagerOptions {
  profileDir?: string;
  headless?: boolean;
  useUserProfile?: boolean;
}

export class BrowserManager {
  private logger: InterfaceLogger;
  private profileDir: string;
  private headless: boolean;
  private context: BrowserContext | null = null;
  private playwright: PlaywrightModule | null = null;

  constructor(logger: InterfaceLogger, options?: BrowserManagerOptions) {
    this.logger = logger;
    if (options?.useUserProfile) {
      const detected = detectChromeProfileDir();
      this.profileDir = detected ?? DEFAULT_PROFILE_DIR;
      if (detected) this.logger('info', `사용자 Chrome 프로필 감지: ${detected}`);
    } else {
      this.profileDir = options?.profileDir ?? DEFAULT_PROFILE_DIR;
    }
    this.headless = options?.headless ?? false;
    this.ensureProfileDir();
  }

  /** Get profile directory path */
  getProfileDir(): string {
    return this.profileDir;
  }

  /** Get or create persistent browser context */
  async getContext(): Promise<BrowserContext> {
    if (this.context) return this.context;

    const pw = await this.loadPlaywright();
    this.context = await pw.chromium.launchPersistentContext(this.profileDir, {
      headless: this.headless,
      viewport: { width: 1280, height: 720 },
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul',
    });
    this.logger('info', `브라우저 컨텍스트 생성: ${this.profileDir}`);
    return this.context;
  }

  /** Close browser context */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
      this.logger('info', '브라우저 컨텍스트 종료');
    }
  }

  /** Check if Playwright is available */
  async isAvailable(): Promise<boolean> {
    try {
      await this.loadPlaywright();
      return true;
    } catch {
      return false;
    }
  }

  private async loadPlaywright(): Promise<PlaywrightModule> {
    if (this.playwright) return this.playwright;
    try {
      const moduleName = 'playwright';
      this.playwright = (await import(/* webpackIgnore: true */ moduleName)) as unknown as PlaywrightModule;
      return this.playwright;
    } catch {
      throw new Error(
        'Playwright가 설치되어 있지 않습니다. npm install playwright 를 실행해주세요.',
      );
    }
  }

  private ensureProfileDir(): void {
    if (!fs.existsSync(this.profileDir)) {
      fs.mkdirSync(this.profileDir, { recursive: true });
    }
  }
}
