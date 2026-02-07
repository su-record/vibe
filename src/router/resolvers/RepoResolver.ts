/**
 * RepoResolver - 3-stage project path resolution
 * 1. Alias matching (from config)
 * 2. WorkSpace scanning (basePaths)
 * 3. Absolute path (direct)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { InterfaceLogger } from '../../interface/types.js';
import { RepoConfig } from '../types.js';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  resolvedPath: string;
  cachedAt: number;
}

export class RepoResolver {
  private logger: InterfaceLogger;
  private config: RepoConfig;
  private cache: Map<string, CacheEntry> = new Map();

  constructor(logger: InterfaceLogger, config: RepoConfig) {
    this.logger = logger;
    this.config = config;
  }

  /** Update config (e.g., after reload) */
  updateConfig(config: RepoConfig): void {
    this.config = config;
    this.cache.clear();
  }

  /** Resolve a project name/path to an absolute path */
  resolve(query: string): string | null {
    // Check cache
    const cached = this.getFromCache(query);
    if (cached) return cached;

    // Stage 1: Alias matching
    const aliasResult = this.matchAlias(query);
    if (aliasResult) return this.cacheAndReturn(query, aliasResult);

    // Stage 2: WorkSpace scan
    const scanResult = this.scanBasePaths(query);
    if (scanResult) return this.cacheAndReturn(query, scanResult);

    // Stage 3: Absolute path
    const absResult = this.checkAbsolutePath(query);
    if (absResult) return this.cacheAndReturn(query, absResult);

    this.logger('warn', `RepoResolver: could not resolve "${query}"`);
    return null;
  }

  /** Stage 1: Match alias from config */
  private matchAlias(query: string): string | null {
    const lower = query.toLowerCase();
    for (const [alias, repoPath] of Object.entries(this.config.aliases)) {
      if (alias.toLowerCase() === lower) {
        const resolved = path.resolve(repoPath);
        if (fs.existsSync(resolved)) return resolved;
        this.logger('warn', `Alias "${alias}" points to non-existent path: ${repoPath}`);
      }
    }
    return null;
  }

  /** Stage 2: Scan base paths for matching directory */
  private scanBasePaths(query: string): string | null {
    const lower = query.toLowerCase();
    for (const basePath of this.config.basePaths) {
      const resolved = path.resolve(basePath);
      if (!fs.existsSync(resolved)) continue;

      try {
        const entries = fs.readdirSync(resolved, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          if (entry.name.toLowerCase().includes(lower)) {
            return path.join(resolved, entry.name);
          }
        }
      } catch {
        this.logger('warn', `Failed to scan base path: ${basePath}`);
      }
    }
    return null;
  }

  /** Stage 3: Check if query is an absolute path */
  private checkAbsolutePath(query: string): string | null {
    const resolved = path.resolve(query);
    if (fs.existsSync(resolved)) return resolved;
    return null;
  }

  /** Get from cache (with TTL check) */
  private getFromCache(query: string): string | null {
    const entry = this.cache.get(query);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
      this.cache.delete(query);
      return null;
    }
    return entry.resolvedPath;
  }

  /** Cache and return */
  private cacheAndReturn(query: string, resolvedPath: string): string {
    this.cache.set(query, { resolvedPath, cachedAt: Date.now() });
    this.logger('debug', `Resolved "${query}" → ${resolvedPath}`);
    return resolvedPath;
  }
}
