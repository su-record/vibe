import type { EventBus } from './EventBus.js';
import type { SuggestionStore, CreateSuggestionInput } from './SuggestionStore.js';

const DEBOUNCE_MS = 500;

export type AnalysisTrigger = 'file_changed' | 'session_start' | 'build_complete' | 'scheduled' | 'manual';

export interface AnalysisContext {
  trigger: AnalysisTrigger;
  filePath?: string;
  fileContent?: string;
  projectRoot?: string;
}

export interface Suggestion {
  type: CreateSuggestionInput['type'];
  title: string;
  description: string;
  priority: number;
  evidence: Record<string, unknown>;
  suggestedAction?: string;
  riskLevel?: string;
}

export interface AnalysisModule {
  readonly name: string;
  analyze(context: AnalysisContext): Promise<Suggestion[]>;
  shouldRun(trigger: AnalysisTrigger): boolean;
}

// ── SecurityScanner ────────────────────────────

const HARDCODED_SECRET_RE = /\b(api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{8,}["']/gi;
const DYNAMIC_SQL_RE = /\b(query|exec|execute|prepare)\s*\(\s*[`'"].*\$\{/gi;
const XSS_PATTERNS_RE = /\b(innerHTML|dangerouslySetInnerHTML)\s*[=:]/gi;

export class SecurityScanner implements AnalysisModule {
  readonly name = 'SecurityScanner';

  shouldRun(trigger: AnalysisTrigger): boolean {
    return trigger === 'file_changed' || trigger === 'manual';
  }

  async analyze(context: AnalysisContext): Promise<Suggestion[]> {
    if (!context.fileContent) return [];
    const suggestions: Suggestion[] = [];

    if (HARDCODED_SECRET_RE.test(context.fileContent)) {
      HARDCODED_SECRET_RE.lastIndex = 0;
      suggestions.push({
        type: 'security',
        title: `Hardcoded secret detected in ${context.filePath ?? 'unknown'}`,
        description: 'Hardcoded secrets should be moved to environment variables or secret management.',
        priority: 1,
        evidence: { filePath: context.filePath, pattern: 'hardcoded_secret' },
        suggestedAction: 'Move secrets to .env file or secret manager',
        riskLevel: 'HIGH',
      });
    }

    if (DYNAMIC_SQL_RE.test(context.fileContent)) {
      DYNAMIC_SQL_RE.lastIndex = 0;
      suggestions.push({
        type: 'security',
        title: `Dynamic SQL construction in ${context.filePath ?? 'unknown'}`,
        description: 'Dynamic SQL construction is vulnerable to SQL injection. Use parameterized queries.',
        priority: 1,
        evidence: { filePath: context.filePath, pattern: 'dynamic_sql' },
        suggestedAction: 'Use parameterized queries instead',
        riskLevel: 'HIGH',
      });
    }

    if (XSS_PATTERNS_RE.test(context.fileContent)) {
      XSS_PATTERNS_RE.lastIndex = 0;
      suggestions.push({
        type: 'security',
        title: `XSS vulnerability pattern in ${context.filePath ?? 'unknown'}`,
        description: 'Using innerHTML or dangerouslySetInnerHTML can lead to XSS vulnerabilities.',
        priority: 2,
        evidence: { filePath: context.filePath, pattern: 'xss' },
        suggestedAction: 'Use safe rendering methods and sanitize user input',
        riskLevel: 'MEDIUM',
      });
    }

    return suggestions;
  }
}

// ── PerformanceDetector ────────────────────────

export class PerformanceDetector implements AnalysisModule {
  readonly name = 'PerformanceDetector';

  shouldRun(trigger: AnalysisTrigger): boolean {
    return trigger === 'session_start' || trigger === 'manual';
  }

  async analyze(context: AnalysisContext): Promise<Suggestion[]> {
    if (!context.fileContent) return [];
    const suggestions: Suggestion[] = [];

    // Detect N+1 query pattern (loop + query)
    if (/for\s*\(.*\)\s*\{[^}]*\.(query|find|get|select)\s*\(/gs.test(context.fileContent)) {
      suggestions.push({
        type: 'performance',
        title: `Potential N+1 query in ${context.filePath ?? 'unknown'}`,
        description: 'Database query inside a loop may cause N+1 performance issues.',
        priority: 2,
        evidence: { filePath: context.filePath, pattern: 'n_plus_1' },
        suggestedAction: 'Use batch queries or joins instead',
      });
    }

    return suggestions;
  }
}

// ── QualityChecker ──────────────────────────────

const TODO_RE = /\/\/\s*TODO\b/g;
const HIGH_COMPLEXITY_RE = /(?:if|else|for|while|switch|catch|&&|\|\|)/g;

export class QualityChecker implements AnalysisModule {
  readonly name = 'QualityChecker';

  shouldRun(trigger: AnalysisTrigger): boolean {
    return trigger === 'file_changed' || trigger === 'build_complete' || trigger === 'manual';
  }

  async analyze(context: AnalysisContext): Promise<Suggestion[]> {
    if (!context.fileContent) return [];
    const suggestions: Suggestion[] = [];

    // Check for abandoned TODOs
    const todoMatches = context.fileContent.match(TODO_RE);
    if (todoMatches && todoMatches.length > 3) {
      suggestions.push({
        type: 'quality',
        title: `${todoMatches.length} TODOs in ${context.filePath ?? 'unknown'}`,
        description: `Found ${todoMatches.length} TODO comments that may need attention.`,
        priority: 3,
        evidence: { filePath: context.filePath, todoCount: todoMatches.length },
        suggestedAction: 'Review and resolve TODO items',
      });
    }

    // Check complexity (rough heuristic)
    const lines = context.fileContent.split('\n');
    const complexityMatches = context.fileContent.match(HIGH_COMPLEXITY_RE);
    if (complexityMatches && lines.length > 0) {
      const density = complexityMatches.length / lines.length;
      if (density > 0.3) {
        suggestions.push({
          type: 'quality',
          title: `High complexity in ${context.filePath ?? 'unknown'}`,
          description: `Complexity density ${(density * 100).toFixed(0)}% exceeds threshold.`,
          priority: 2,
          evidence: { filePath: context.filePath, complexityDensity: density },
          suggestedAction: 'Consider refactoring to reduce complexity',
        });
      }
    }

    return suggestions;
  }
}

// ── DependencyMonitor ───────────────────────────

export class DependencyMonitor implements AnalysisModule {
  readonly name = 'DependencyMonitor';

  shouldRun(trigger: AnalysisTrigger): boolean {
    return trigger === 'scheduled' || trigger === 'manual';
  }

  async analyze(context: AnalysisContext): Promise<Suggestion[]> {
    if (!context.fileContent) return [];
    // Parse package.json for basic checks
    try {
      const pkg = JSON.parse(context.fileContent) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const suggestions: Suggestion[] = [];
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Check for wildcard versions
      for (const [name, version] of Object.entries(allDeps)) {
        if (version === '*' || version === 'latest') {
          suggestions.push({
            type: 'dependency',
            title: `Unpinned dependency: ${name}`,
            description: `${name} uses '${version}' version which is not pinned.`,
            priority: 2,
            evidence: { package: name, version },
            suggestedAction: `Pin ${name} to a specific version`,
          });
        }
      }

      return suggestions;
    } catch {
      return [];
    }
  }
}

// ── ProactiveAnalyzer (Orchestrator) ────────────

export class ProactiveAnalyzer {
  private readonly modules: AnalysisModule[];
  private readonly store: SuggestionStore;
  private readonly eventBus: EventBus;
  private readonly debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(deps: {
    store: SuggestionStore;
    eventBus: EventBus;
    modules?: AnalysisModule[];
  }) {
    this.store = deps.store;
    this.eventBus = deps.eventBus;
    this.modules = deps.modules ?? [
      new SecurityScanner(),
      new PerformanceDetector(),
      new QualityChecker(),
      new DependencyMonitor(),
    ];
  }

  async analyze(context: AnalysisContext): Promise<Suggestion[]> {
    if (context.filePath && context.trigger === 'file_changed') {
      return this.analyzeDebounced(context);
    }
    return this.runAnalysis(context);
  }

  getModules(): ReadonlyArray<AnalysisModule> {
    return this.modules;
  }

  clearDebounce(): void {
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }

  private analyzeDebounced(context: AnalysisContext): Promise<Suggestion[]> {
    const key = context.filePath!;
    const existing = this.debounceTimers.get(key);
    if (existing) clearTimeout(existing);

    return new Promise<Suggestion[]>((resolve) => {
      this.debounceTimers.set(
        key,
        setTimeout(async () => {
          this.debounceTimers.delete(key);
          const results = await this.runAnalysis(context);
          resolve(results);
        }, DEBOUNCE_MS),
      );
    });
  }

  private async runAnalysis(context: AnalysisContext): Promise<Suggestion[]> {
    const allSuggestions: Suggestion[] = [];

    for (const mod of this.modules) {
      if (!mod.shouldRun(context.trigger)) continue;
      try {
        const suggestions = await mod.analyze(context);
        for (const s of suggestions) {
          this.store.create({
            ...s,
            sourceModule: mod.name,
          });
          allSuggestions.push(s);
        }
      } catch {
        // Module failure should not break analysis
      }
    }

    if (allSuggestions.length > 0) {
      this.emitSuggestionCreated(allSuggestions.length, context.trigger);
    }

    return allSuggestions;
  }

  private emitSuggestionCreated(count: number, trigger: AnalysisTrigger): void {
    try {
      this.eventBus.emit('suggestion_created', {
        eventType: 'suggestion_created',
        payload: { count, trigger },
        sourceAgentId: 'proactive-analyzer',
      });
    } catch {
      // Non-critical
    }
  }
}
