/**
 * PolicyStore - Load and manage policies
 * Phase 3: Policy Engine
 *
 * Priority: project > user > built-in
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as url from 'node:url';
import { Policy, PolicyFile } from './types.js';
import { LogLevel } from '../daemon/types.js';

const VIBE_DIR = path.join(os.homedir(), '.vibe');
const USER_POLICIES_DIR = path.join(VIBE_DIR, 'policies');

export class PolicyStore {
  private policies: Map<string, PolicyFile> = new Map();
  private disabledPolicies: Set<string> = new Set();
  private logger: (level: LogLevel, message: string, data?: unknown) => void;

  constructor(logger: (level: LogLevel, message: string, data?: unknown) => void) {
    this.logger = logger;
  }

  /** Load all policies in order: builtin → user → project */
  loadAll(projectPath?: string): void {
    this.policies.clear();

    // 1. Built-in policies
    this.loadBuiltinPolicies();

    // 2. User policies (~/.vibe/policies/)
    this.loadPoliciesFromDir(USER_POLICIES_DIR, 'user');

    // 3. Project policies (.vibe/policies/)
    if (projectPath) {
      const projectPoliciesDir = path.join(projectPath, '.vibe', 'policies');
      this.loadPoliciesFromDir(projectPoliciesDir, 'project');
    }

    this.logger('info', `Loaded ${this.policies.size} policies`);
  }

  /** Get all loaded policies */
  getAll(): PolicyFile[] {
    return Array.from(this.policies.values());
  }

  /** Get active policies (enabled + not disabled by user) */
  getActive(): PolicyFile[] {
    return Array.from(this.policies.values()).filter(
      (p) => p.enabled && !this.disabledPolicies.has(p.name)
    );
  }

  /** Get safety policies (cannot be disabled) */
  getSafetyPolicies(): PolicyFile[] {
    return Array.from(this.policies.values()).filter((p) => p.type === 'safety');
  }

  /** Get configuration policies */
  getConfigPolicies(): PolicyFile[] {
    return this.getActive().filter((p) => p.type === 'configuration');
  }

  /** Get policy by name */
  getPolicy(name: string): PolicyFile | undefined {
    return this.policies.get(name);
  }

  /** Disable a policy (config only, safety cannot be disabled) */
  disablePolicy(name: string): boolean {
    const policy = this.policies.get(name);
    if (!policy) return false;
    if (policy.type === 'safety') {
      this.logger('warn', `Cannot disable safety policy: ${name}`);
      return false;
    }
    this.disabledPolicies.add(name);
    return true;
  }

  /** Enable a previously disabled policy */
  enablePolicy(name: string): boolean {
    return this.disabledPolicies.delete(name);
  }

  /** Check if a policy is enabled */
  isEnabled(name: string): boolean {
    const policy = this.policies.get(name);
    if (!policy) return false;
    if (policy.type === 'safety') return true; // Always enabled
    return policy.enabled && !this.disabledPolicies.has(name);
  }

  // ========================================================================
  // Private
  // ========================================================================

  private loadBuiltinPolicies(): void {
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const builtinDir = path.join(__dirname, 'builtin');

    if (!fs.existsSync(builtinDir)) {
      // In dist/: look relative to compiled location
      const altDir = path.join(__dirname, '..', '..', 'src', 'policy', 'builtin');
      if (fs.existsSync(altDir)) {
        this.loadPoliciesFromDir(altDir, 'builtin');
        return;
      }
      this.logger('warn', 'Built-in policies directory not found');
      return;
    }

    this.loadPoliciesFromDir(builtinDir, 'builtin');
  }

  private loadPoliciesFromDir(dir: string, source: PolicyFile['source']): void {
    if (!fs.existsSync(dir)) return;

    try {
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));

      for (const file of files) {
        const filePath = path.join(dir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const policy = JSON.parse(content) as Policy;

          if (!this.validatePolicy(policy, filePath)) {
            continue;
          }

          const policyFile: PolicyFile = {
            ...policy,
            filePath,
            source,
          };

          // Higher priority source overwrites lower
          this.policies.set(policy.name, policyFile);
          this.logger('debug', `Loaded policy: ${policy.name} (${source})`);
        } catch (err) {
          this.logger('warn', `Failed to load policy file: ${filePath}`, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (err) {
      this.logger('warn', `Failed to read policy directory: ${dir}`, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private validatePolicy(policy: unknown, filePath: string): boolean {
    if (!policy || typeof policy !== 'object') {
      this.logger('warn', `Invalid policy format: ${filePath}`);
      return false;
    }

    const p = policy as Record<string, unknown>;

    if (typeof p.name !== 'string' || !p.name) {
      this.logger('warn', `Policy missing name: ${filePath}`);
      return false;
    }

    if (!Array.isArray(p.rules)) {
      this.logger('warn', `Policy missing rules array: ${filePath}`);
      return false;
    }

    const validEffects = ['approve', 'warn', 'reject', 'ignore'];
    for (const rule of p.rules as Array<Record<string, unknown>>) {
      if (typeof rule.id !== 'string') {
        this.logger('warn', `Rule missing id in ${filePath}`);
        return false;
      }
      if (typeof rule.effect !== 'string' || !validEffects.includes(rule.effect as string)) {
        this.logger('warn', `Invalid effect "${rule.effect}" in rule ${rule.id} of ${filePath}`);
        return false;
      }
    }

    return true;
  }
}
