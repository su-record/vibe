import type { ProactiveAnalyzer, AnalysisTrigger, AnalysisContext } from './ProactiveAnalyzer.js';

const MAX_CONCURRENT = 2;
const ANALYSIS_TIMEOUT_MS = 5000;
const DEPENDENCY_CHECK_INTERVAL_MS = 86_400_000; // 24 hours

interface ModuleStatus {
  name: string;
  lastRunAt: string | null;
  lastRunDuration: number | null;
  runCount: number;
  errorCount: number;
}

export class BackgroundMonitor {
  private readonly analyzer: ProactiveAnalyzer;
  private readonly enabled: boolean;
  private running = 0;
  private readonly queue: Array<{ context: AnalysisContext; resolve: () => void }> = [];
  private readonly moduleStatus = new Map<string, ModuleStatus>();
  private dependencyTimerId: ReturnType<typeof setInterval> | null = null;
  private started = false;

  constructor(deps: { analyzer: ProactiveAnalyzer; enabled?: boolean }) {
    this.analyzer = deps.analyzer;
    this.enabled = deps.enabled !== false;

    for (const mod of this.analyzer.getModules()) {
      this.moduleStatus.set(mod.name, {
        name: mod.name,
        lastRunAt: null,
        lastRunDuration: null,
        runCount: 0,
        errorCount: 0,
      });
    }
  }

  start(): void {
    if (!this.enabled || this.started) return;
    this.started = true;

    // Run session_start analysis
    this.triggerAnalysis({ trigger: 'session_start' });

    // Schedule dependency monitoring
    this.dependencyTimerId = setInterval(() => {
      this.triggerAnalysis({ trigger: 'scheduled' });
    }, DEPENDENCY_CHECK_INTERVAL_MS);
  }

  stop(): void {
    this.started = false;
    this.analyzer.clearDebounce();
    if (this.dependencyTimerId) {
      clearInterval(this.dependencyTimerId);
      this.dependencyTimerId = null;
    }
    for (const item of this.queue) {
      item.resolve();
    }
    this.queue.length = 0;
  }

  async onFileChanged(filePath: string, content: string): Promise<void> {
    if (!this.enabled || !this.started) return;
    if (!/\.(ts|js|tsx|jsx)$/.test(filePath)) return;
    await this.triggerAnalysis({
      trigger: 'file_changed',
      filePath,
      fileContent: content,
    });
  }

  async onBuildComplete(): Promise<void> {
    if (!this.enabled || !this.started) return;
    await this.triggerAnalysis({ trigger: 'build_complete' });
  }

  async runAll(fileContent?: string, filePath?: string): Promise<void> {
    await this.triggerAnalysis({
      trigger: 'manual',
      fileContent,
      filePath,
    });
  }

  getStatus(): ReadonlyArray<ModuleStatus> {
    return Array.from(this.moduleStatus.values());
  }

  isStarted(): boolean {
    return this.started;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getRunningCount(): number {
    return this.running;
  }

  private async triggerAnalysis(context: AnalysisContext): Promise<void> {
    if (this.running >= MAX_CONCURRENT) {
      await new Promise<void>((resolve) => {
        this.queue.push({ context, resolve });
      });
      if (!this.started) return;
    }

    this.running++;
    const start = performance.now();

    try {
      await Promise.race([
        this.analyzer.analyze(context),
        this.createTimeout(),
      ]);
      this.updateModuleStatus(context.trigger, performance.now() - start, false);
    } catch {
      this.updateModuleStatus(context.trigger, performance.now() - start, true);
    } finally {
      this.running--;
      this.processQueue();
    }
  }

  private createTimeout(): Promise<never> {
    return new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Analysis timeout'));
      }, ANALYSIS_TIMEOUT_MS);
    });
  }

  private processQueue(): void {
    if (this.queue.length > 0 && this.running < MAX_CONCURRENT) {
      const next = this.queue.shift();
      if (next) {
        next.resolve();
      }
    }
  }

  private updateModuleStatus(trigger: AnalysisTrigger, duration: number, error: boolean): void {
    for (const mod of this.analyzer.getModules()) {
      if (mod.shouldRun(trigger)) {
        const status = this.moduleStatus.get(mod.name);
        if (status) {
          status.lastRunAt = new Date().toISOString();
          status.lastRunDuration = duration;
          status.runCount++;
          if (error) status.errorCount++;
        }
      }
    }
  }
}
