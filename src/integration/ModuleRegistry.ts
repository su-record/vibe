/**
 * Module Registry — Phase 6-1
 *
 * Register, manage, and health-check PC control modules.
 * Supports lazy loading and graceful degradation.
 */

import type {
  ModuleName,
  ModuleState,
  ModuleInfo,
  ModuleHandlers,
  IntegrationLogger,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

const HEALTH_CHECK_INTERVAL_MS = 30_000;
const MAX_HEALTH_FAILURES = 3;

const MODULE_INIT_ORDER: ModuleName[] = [
  'sandbox', 'browser', 'google', 'voice', 'vision',
];

// ============================================================================
// Module Registry
// ============================================================================

export class ModuleRegistry {
  private modules = new Map<ModuleName, ModuleInfo>();
  private handlers = new Map<ModuleName, ModuleHandlers>();
  private healthTimer: NodeJS.Timeout | null = null;
  private logger: IntegrationLogger;
  private onModuleDisabled?: (name: ModuleName, reason: string) => void;

  constructor(logger: IntegrationLogger) {
    this.logger = logger;
  }

  /** Register a module with its lifecycle handlers */
  register(name: ModuleName, handlers: ModuleHandlers): void {
    this.modules.set(name, {
      name,
      state: 'disabled',
      healthFailCount: 0,
      lastHealthCheck: null,
    });
    this.handlers.set(name, handlers);
  }

  /** Initialize all registered modules in order */
  async initAll(enabledModules: ModuleName[]): Promise<void> {
    for (const name of MODULE_INIT_ORDER) {
      if (!enabledModules.includes(name)) continue;
      if (!this.handlers.has(name)) continue;
      await this.initModule(name);
    }
    this.startHealthCheck();
  }

  /** Initialize a single module with error isolation */
  async initModule(name: ModuleName): Promise<boolean> {
    const handlers = this.handlers.get(name);
    const info = this.modules.get(name);
    if (!handlers || !info) return false;

    info.state = 'initializing';
    try {
      await handlers.init();
      info.state = 'enabled';
      this.logger('info', `Module ${name} initialized`);
      return true;
    } catch (err) {
      info.state = 'error';
      info.errorMessage = err instanceof Error ? err.message : String(err);
      this.logger('warn', `Module ${name} init failed: ${info.errorMessage}`);
      return false;
    }
  }

  /** Shutdown all modules in reverse order */
  async shutdownAll(): Promise<void> {
    this.stopHealthCheck();
    const reversed = [...MODULE_INIT_ORDER].reverse();
    for (const name of reversed) {
      const handlers = this.handlers.get(name);
      const info = this.modules.get(name);
      if (!handlers || !info || info.state === 'disabled') continue;
      try {
        await handlers.shutdown();
        info.state = 'disabled';
      } catch (err) {
        this.logger('warn', `Module ${name} shutdown error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  /** Get module info */
  get(name: ModuleName): ModuleInfo | undefined {
    return this.modules.get(name);
  }

  /** Check if module is enabled */
  isEnabled(name: ModuleName): boolean {
    return this.modules.get(name)?.state === 'enabled';
  }

  /** Get all module infos */
  getAll(): ModuleInfo[] {
    return Array.from(this.modules.values());
  }

  /** Get enabled module names */
  getEnabledModules(): ModuleName[] {
    return this.getAll()
      .filter(m => m.state === 'enabled')
      .map(m => m.name);
  }

  /** Set callback for module disable events */
  onDisabled(callback: (name: ModuleName, reason: string) => void): void {
    this.onModuleDisabled = callback;
  }

  /** Run health check on all enabled modules */
  async runHealthCheck(): Promise<Map<ModuleName, boolean>> {
    const results = new Map<ModuleName, boolean>();
    for (const [name, info] of this.modules) {
      if (info.state !== 'enabled') continue;
      const handlers = this.handlers.get(name);
      if (!handlers) continue;

      const healthy = await this.checkModuleHealth(name, handlers, info);
      results.set(name, healthy);
    }
    return results;
  }

  // ============================================================================
  // Private
  // ============================================================================

  private async checkModuleHealth(
    name: ModuleName,
    handlers: ModuleHandlers,
    info: ModuleInfo,
  ): Promise<boolean> {
    try {
      const ok = await handlers.healthCheck();
      info.lastHealthCheck = new Date().toISOString();
      if (ok) {
        info.healthFailCount = 0;
        return true;
      }
      return this.handleHealthFailure(name, info, 'Health check returned false');
    } catch (err) {
      return this.handleHealthFailure(name, info,
        err instanceof Error ? err.message : String(err));
    }
  }

  private handleHealthFailure(name: ModuleName, info: ModuleInfo, reason: string): boolean {
    info.healthFailCount++;
    this.logger('warn', `Module ${name} health fail #${info.healthFailCount}: ${reason}`);
    if (info.healthFailCount >= MAX_HEALTH_FAILURES) {
      info.state = 'error';
      info.errorMessage = `Health check ${MAX_HEALTH_FAILURES}회 연속 실패`;
      this.onModuleDisabled?.(name, info.errorMessage);
    }
    return false;
  }

  private startHealthCheck(): void {
    this.healthTimer = setInterval(() => {
      this.runHealthCheck().catch(err => {
        this.logger('error', `Health check error: ${err instanceof Error ? err.message : String(err)}`);
      });
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  private stopHealthCheck(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }
}
