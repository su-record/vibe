/**
 * Exec Allowlist — Phase 5-3
 *
 * Command execution allowlist with pattern matching.
 * Blocks dangerous patterns: redirections, subshells, etc.
 */

import type {
  AllowlistEntry,
  ApprovalRequest,
  ApprovalStatus,
  SandboxLogger,
} from './types.js';
import { createSandboxError } from './types.js';

// ============================================================================
// Default safe binaries
// ============================================================================

const DEFAULT_SAFE_BINS: AllowlistEntry[] = [
  { pattern: '/usr/bin/git', description: 'Git version control', addedAt: '', addedBy: 'default' },
  { pattern: '/usr/bin/node', description: 'Node.js runtime', addedAt: '', addedBy: 'default' },
  { pattern: '/usr/bin/npm', description: 'npm package manager', addedAt: '', addedBy: 'default' },
  { pattern: '/usr/local/bin/pnpm', description: 'pnpm package manager', addedAt: '', addedBy: 'default' },
  { pattern: '/usr/bin/grep', description: 'Text search', addedAt: '', addedBy: 'default' },
  { pattern: '/usr/bin/jq', description: 'JSON processor', addedAt: '', addedBy: 'default' },
  { pattern: '/usr/bin/curl', description: 'HTTP client', addedAt: '', addedBy: 'default' },
  { pattern: '/usr/bin/cat', description: 'File concatenation', addedAt: '', addedBy: 'default' },
  { pattern: '/usr/bin/ls', description: 'List directory', addedAt: '', addedBy: 'default' },
  { pattern: '/usr/bin/find', description: 'Find files', addedAt: '', addedBy: 'default' },
];

// ============================================================================
// Dangerous patterns
// ============================================================================

const DANGEROUS_PATTERNS = [
  /\0/, // Null byte injection
  /[>|]/, // Redirections and pipes
  /\$\(/, // Command substitution
  /`/, // Backtick substitution
  /;\s*/, // Command chaining with semicolons
  /&&/, // Logical AND chaining
  /\|\|/, // Logical OR chaining
  /\brm\b.*-[rR]f/, // Recursive force delete
  /\bkill\b.*-9/, // Force kill
  /\bchmod\b.*777/, // World-writable permissions
  /\bdd\b/, // Disk destroyer
  /\bmkfs\b/, // Filesystem creation
  /\bformat\b/, // Format command
  /\/dev\//, // Device access
  /\/proc\//, // Proc filesystem
  /\/sys\//, // Sys filesystem
];

// ============================================================================
// Exec Allowlist
// ============================================================================

export class ExecAllowlist {
  private entries: AllowlistEntry[];
  private pendingApprovals = new Map<string, ApprovalRequest>();
  private logger: SandboxLogger;

  constructor(logger: SandboxLogger, customEntries?: AllowlistEntry[]) {
    this.logger = logger;
    this.entries = [
      ...DEFAULT_SAFE_BINS.map(e => ({ ...e, addedAt: new Date().toISOString() })),
      ...(customEntries ?? []),
    ];
  }

  /**
   * Check if a command is allowed.
   * Returns: 'allowed' | 'denied' | 'ask'
   */
  check(command: string): 'allowed' | 'denied' | 'ask' {
    // Check dangerous patterns first
    if (this.isDangerous(command)) {
      this.logger('warn', `Dangerous command blocked: ${command}`);
      return 'denied';
    }

    // Parse command to get binary
    const argv = this.parseCommand(command);
    if (argv.length === 0) return 'denied';

    const binary = argv[0];

    // Check allowlist
    if (this.isInAllowlist(binary)) {
      return 'allowed';
    }

    // Not in allowlist → ask for approval
    return 'ask';
  }

  /** Check if command contains dangerous patterns */
  isDangerous(command: string): boolean {
    return DANGEROUS_PATTERNS.some(pattern => pattern.test(command));
  }

  /** Parse command string into argv (simple split) */
  parseCommand(command: string): string[] {
    return command.trim().split(/\s+/).filter(Boolean);
  }

  /** Check if binary is in the allowlist */
  isInAllowlist(binary: string): boolean {
    return this.entries.some(entry => {
      if (entry.pattern.includes('*')) {
        const regex = new RegExp('^' + entry.pattern.replace(/\*/g, '.*') + '$');
        return regex.test(binary);
      }
      // Match by full path or basename
      const basename = binary.split('/').pop() ?? binary;
      const entryBasename = entry.pattern.split('/').pop() ?? entry.pattern;
      return entry.pattern === binary || entryBasename === basename;
    });
  }

  /** Add a new entry to the allowlist */
  addEntry(pattern: string, description?: string, addedBy: 'user' | 'auto' = 'user'): void {
    this.entries.push({
      pattern,
      description,
      addedAt: new Date().toISOString(),
      addedBy,
    });
  }

  /** Create an approval request for review */
  createApproval(command: string, userId: string): ApprovalRequest {
    const request: ApprovalRequest = {
      requestId: `approval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      command,
      userId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      alwaysAllow: false,
    };
    this.pendingApprovals.set(request.requestId, request);
    return request;
  }

  /** Resolve an approval request */
  resolveApproval(requestId: string, status: 'approved' | 'denied', alwaysAllow?: boolean): ApprovalRequest | undefined {
    const request = this.pendingApprovals.get(requestId);
    if (!request) return undefined;

    request.status = status;
    request.respondedAt = new Date().toISOString();
    request.alwaysAllow = alwaysAllow ?? false;

    if (status === 'approved' && alwaysAllow) {
      const argv = this.parseCommand(request.command);
      if (argv.length > 0) {
        this.addEntry(argv[0], `Auto-added from approval: ${request.command}`, 'auto');
      }
    }

    this.pendingApprovals.delete(requestId);
    return request;
  }

  /** Get all entries */
  getEntries(): AllowlistEntry[] {
    return [...this.entries];
  }

  /** Get pending approvals */
  getPendingApprovals(): ApprovalRequest[] {
    return Array.from(this.pendingApprovals.values());
  }
}
