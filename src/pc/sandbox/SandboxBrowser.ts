/**
 * Sandbox Browser — Phase 5-2
 *
 * Container-based Chromium with CDP port mapping.
 * Independent browser instance per user.
 */

import type { SandboxLogger } from './types.js';
import { createSandboxError } from './types.js';
import { ContainerManager } from './ContainerManager.js';

const SANDBOX_BROWSER_IMAGE = 'vibe-sandbox-browser:latest';
const CDP_INTERNAL_PORT = 9222;

export interface SandboxBrowserInfo {
  containerId: string;
  userId: string;
  cdpPort: number;
  cdpUrl: string;
  state: string;
}

export class SandboxBrowser {
  private manager: ContainerManager;
  private logger: SandboxLogger;
  private browsers = new Map<string, SandboxBrowserInfo>();
  private nextPort = 19222;

  constructor(manager: ContainerManager, logger: SandboxLogger) {
    this.manager = manager;
    this.logger = logger;
  }

  async create(userId: string): Promise<SandboxBrowserInfo> {
    const existing = this.browsers.get(userId);
    if (existing) {
      return existing;
    }

    const cdpPort = this.allocatePort();
    const info = await this.manager.create(userId, {
      scope: 'user',
      image: SANDBOX_BROWSER_IMAGE,
      labels: {
        'vibe-type': 'browser',
        'vibe-cdp-port': String(cdpPort),
      },
    });

    await this.manager.start(info.containerId);

    const browserInfo: SandboxBrowserInfo = {
      containerId: info.containerId,
      userId,
      cdpPort,
      cdpUrl: `http://127.0.0.1:${cdpPort}`,
      state: 'running',
    };

    this.browsers.set(userId, browserInfo);
    this.logger('info', `Sandbox browser created for ${userId} on port ${cdpPort}`);
    return browserInfo;
  }

  async destroy(userId: string): Promise<void> {
    const browser = this.browsers.get(userId);
    if (!browser) return;

    try {
      await this.manager.stop(browser.containerId);
      await this.manager.remove(browser.containerId);
    } catch (err) {
      this.logger('warn', `Failed to destroy sandbox browser: ${err instanceof Error ? err.message : String(err)}`);
    }

    this.browsers.delete(userId);
  }

  get(userId: string): SandboxBrowserInfo | undefined {
    return this.browsers.get(userId);
  }

  getAll(): SandboxBrowserInfo[] {
    return Array.from(this.browsers.values());
  }

  async destroyAll(): Promise<void> {
    for (const userId of this.browsers.keys()) {
      await this.destroy(userId);
    }
  }

  private allocatePort(): number {
    return this.nextPort++;
  }
}
