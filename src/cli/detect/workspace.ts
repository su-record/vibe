/**
 * Monorepo workspace path discovery.
 * Supports: pnpm-workspace.yaml, package.json workspaces, lerna.json, nx.json, turbo.json.
 */

import path from 'path';
import fs from 'fs';

// ── helpers ────────────────────────────────────────────────────────────────

function readText(filePath: string): string {
  try { return fs.readFileSync(filePath, 'utf-8'); } catch { return ''; }
}

function expandGlobPattern(projectRoot: string, pattern: string, out: Set<string>): void {
  const clean = pattern.replace(/['"]/g, '').trim();
  if (clean.startsWith('!')) return;

  if (!clean.includes('*')) {
    const full = path.join(projectRoot, clean);
    if (fs.existsSync(full) && fs.statSync(full).isDirectory()) out.add(clean);
    return;
  }

  if (clean.endsWith('/*') || clean.endsWith('/*/')) {
    const baseDir = clean.replace(/\/\*+\/?$/, '');
    const basePath = path.join(projectRoot, baseDir);
    if (!fs.existsSync(basePath) || !fs.statSync(basePath).isDirectory()) return;
    try {
      for (const entry of fs.readdirSync(basePath)) {
        if (entry.startsWith('.')) continue;
        const ep = path.join(basePath, entry);
        if (fs.statSync(ep).isDirectory()) out.add(`${baseDir}/${entry}`);
      }
    } catch { /* ignore */ }
  }
}

function expandPatterns(projectRoot: string, patterns: string[], out: Set<string>): void {
  for (const p of patterns) expandGlobPattern(projectRoot, p, out);
}

// ── readers ────────────────────────────────────────────────────────────────

function readPnpmWorkspace(projectRoot: string, out: Set<string>): void {
  const content = readText(path.join(projectRoot, 'pnpm-workspace.yaml'));
  if (!content) return;
  const match = content.match(/packages:\s*\n((?:\s*-\s*.+\n?)+)/);
  if (!match) return;
  for (const line of match[1].split('\n')) {
    const m = line.match(/^\s*-\s*['"]?([^'"#\n]+)['"]?\s*$/);
    if (m) expandGlobPattern(projectRoot, m[1].trim(), out);
  }
}

function readPackageJsonWorkspaces(projectRoot: string, out: Set<string>): void {
  try {
    const raw = readText(path.join(projectRoot, 'package.json'));
    if (!raw) return;
    const pkg = JSON.parse(raw);
    const ws = pkg.workspaces;
    if (Array.isArray(ws)) { expandPatterns(projectRoot, ws, out); return; }
    if (ws?.packages && Array.isArray(ws.packages)) expandPatterns(projectRoot, ws.packages, out);
  } catch { /* ignore */ }
}

function readLerna(projectRoot: string, out: Set<string>): void {
  try {
    const raw = readText(path.join(projectRoot, 'lerna.json'));
    if (!raw) return;
    const lerna = JSON.parse(raw);
    expandPatterns(projectRoot, lerna.packages ?? ['packages/*'], out);
  } catch { /* ignore */ }
}

function readNx(projectRoot: string, out: Set<string>): void {
  if (!fs.existsSync(path.join(projectRoot, 'nx.json'))) return;
  for (const dir of ['apps', 'libs', 'packages']) {
    expandGlobPattern(projectRoot, `${dir}/*`, out);
  }
}

function readTurbo(projectRoot: string, out: Set<string>): void {
  if (!fs.existsSync(path.join(projectRoot, 'turbo.json'))) return;
  for (const dir of ['apps', 'packages']) {
    expandGlobPattern(projectRoot, `${dir}/*`, out);
  }
}

// ── public API ─────────────────────────────────────────────────────────────

/** Return relative paths of monorepo workspace package directories. */
export function detectWorkspacePaths(projectRoot: string): string[] {
  const out = new Set<string>();
  readPnpmWorkspace(projectRoot, out);
  readPackageJsonWorkspaces(projectRoot, out);
  readLerna(projectRoot, out);
  readNx(projectRoot, out);
  readTurbo(projectRoot, out);
  return [...out];
}
