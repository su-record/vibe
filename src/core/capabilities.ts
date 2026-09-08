import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * One convention for other harnesses: vibe names what it can use when present, the operation it
 * serves and what vibe does alone. A tool is probed once per process; nothing is installed. Alone,
 * vibe already does every operation here — with the tool it does it better, and says so.
 */
export interface Capability {
  tool: string;
  /** How presence is read: a command that must exit 0, or a directory that must exist (home- or project-relative). */
  probe: { command: string[] } | { dirs: string[] };
  /** vibe operations the tool serves. */
  serves: string[];
  /** What vibe does when the tool is absent. */
  fallback: string;
  /** How the user gets it, one line. */
  install: string;
}

export const CAPABILITIES: readonly Capability[] = [
  { tool: 'graft', probe: { command: ['graft', '--version'] }, serves: ['map', 'callers', 'blast'], fallback: 'vibe map — regex lexers, one hop of imports', install: 'npm i -g @nanonets/graft && graft init && graft build' },
  { tool: 'trace', probe: { command: ['trace', '--version'] }, serves: ['blast'], fallback: 'vibe blast — symbols from git hunks and callers by name', install: 'npm i -g trace-mcp && trace init && trace add' },
  { tool: 'claude', probe: { command: ['claude', '--version'] }, serves: ['reader', 'reviewer'], fallback: 'codex, or VIBE_READER_CMD / VIBE_REVIEW_CMD', install: 'npm i -g @anthropic-ai/claude-code' },
  { tool: 'codex', probe: { command: ['codex', '--version'] }, serves: ['reader', 'reviewer'], fallback: 'claude, or VIBE_READER_CMD / VIBE_REVIEW_CMD', install: 'npm i -g @openai/codex' },
  { tool: 'pdftotext', probe: { command: ['pdftotext', '-v'] }, serves: ['read pdf'], fallback: 'the built-in pdf reader', install: 'apt install poppler-utils · brew install poppler' },
  { tool: 'agent-browser', probe: { command: ['agent-browser', '--version'] }, serves: ['screenshot'], fallback: 'the design review judges the source alone', install: 'npm i -g agent-browser' },
  { tool: 'playwright', probe: { command: ['playwright', '--version'] }, serves: ['screenshot'], fallback: 'the design review judges the source alone', install: 'npm i -g playwright && playwright install chromium' },
  { tool: 'last30days', probe: { dirs: ['.claude/skills/last30days', '.codex/skills/last30days', '.agents/skills/last30days'] }, serves: ['research'], fallback: 'vibe research — GitHub, last 30 days', install: 'vibe skill add mvanhorn/last30days-skill --yes' },
];

export interface Detected extends Capability {
  present: boolean;
  detail: string;
}

const cache = new Map<string, { present: boolean; detail: string }>();

function probeCommand(command: string[]): { present: boolean; detail: string } {
  if (process.env['VIBE_NO_TOOLS']) return { present: false, detail: 'VIBE_NO_TOOLS' };
  const [cmd, ...args] = command as [string, ...string[]];
  const r = spawnSync(cmd, args, { encoding: 'utf-8', timeout: 10_000, shell: process.platform === 'win32' });
  const line = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n')[0] ?? '';
  return r.status === 0 ? { present: true, detail: line.slice(0, 60) } : { present: false, detail: 'not on PATH' };
}

function probeDirs(dirs: string[], root: string, home: string): { present: boolean; detail: string } {
  for (const d of dirs) for (const base of [root, home]) if (fs.existsSync(path.join(base, d))) return { present: true, detail: path.join(base, d) };
  return { present: false, detail: 'not installed' };
}

/** Every capability with whether it is present; probes are cached for the life of the process. */
export function detectCapabilities(root: string, home: string = process.env['VIBE_HOME_DIR'] ?? os.homedir()): Detected[] {
  return CAPABILITIES.map((c) => {
    const key = `${c.tool}:${root}`;
    let hit = cache.get(key);
    if (!hit) {
      hit = 'command' in c.probe ? probeCommand(c.probe.command) : probeDirs(c.probe.dirs, root, home);
      cache.set(key, hit);
    }
    return { ...c, ...hit };
  });
}

export function hasTool(tool: string, root: string = process.cwd()): boolean {
  return detectCapabilities(root).find((c) => c.tool === tool)?.present ?? false;
}

/** The tools a project would use but does not have, with the reason — for the scope skill's one-line proposal. */
export function proposeTools(root: string, signals: { files: number; design: boolean }): Array<{ tool: string; why: string; install: string }> {
  const out: Array<{ tool: string; why: string; install: string }> = [];
  const present = new Set(detectCapabilities(root).filter((c) => c.present).map((c) => c.tool));
  if (signals.files > 200 && !present.has('graft') && !present.has('trace')) out.push({ tool: 'graft', why: `${signals.files} source files — a symbol graph makes \`changed\` reviews and \`callers\` symbol-level`, install: CAPABILITIES[0]!.install });
  if (signals.design && !present.has('agent-browser') && !present.has('playwright')) out.push({ tool: 'agent-browser', why: 'a design review with a screenshot lets the art director see the render', install: CAPABILITIES[5]!.install });
  return out;
}

/** The status table: tool · present · serves · fallback. */
export function capabilityLines(root: string): string[] {
  return detectCapabilities(root).map((c) => `  ${c.present ? '✔' : '·'} ${c.tool.padEnd(13)} ${c.serves.join(', ').padEnd(18)} ${c.present ? c.detail : `absent — ${c.fallback}`}`);
}
