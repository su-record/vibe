/**
 * HUD (Heads-Up Display) CLI Module
 * Real-time status visualization for vibe operations
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// State storage path
const STATE_DIR = path.join(os.homedir(), '.claude', '.vibe-hud');
const STATE_FILE = path.join(STATE_DIR, 'state.json');

// Default state
interface HudAgent {
  name: string;
  model: string;
  startTime: number;
}

interface HudState {
  mode: 'idle' | 'ultrawork' | 'spec' | 'review' | 'implementing' | 'testing' | 'error';
  feature: string | null;
  phase: { current: number; total: number; name: string };
  agents: HudAgent[];
  context: { used: number; total: number };
  lastUpdate: string | null;
}

const DEFAULT_STATE: HudState = {
  mode: 'idle',
  feature: null,
  phase: { current: 0, total: 0, name: '' },
  agents: [],
  context: { used: 0, total: 200000 },
  lastUpdate: null,
};

// Mode icons
const MODE_ICONS: Record<string, string> = {
  idle: '\u{1F4A4}',           // 💤
  ultrawork: '\u{1F680}',      // 🚀
  spec: '\u{1F4DD}',           // 📝
  review: '\u{1F50D}',         // 🔍
  implementing: '\u{1F528}',   // 🔨
  testing: '\u{1F9EA}',        // 🧪
  error: '\u{274C}',           // ❌
};

// Health colors (ANSI)
const HEALTH_COLORS = {
  good: '\x1b[32m',      // green
  warning: '\x1b[33m',   // yellow
  critical: '\x1b[31m',  // red
  reset: '\x1b[0m',
};

/**
 * Ensure state directory exists
 */
function ensureStateDir(): void {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

/**
 * Load current state
 */
function loadState(): HudState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch {
    // Ignore parse errors
  }
  return { ...DEFAULT_STATE };
}

/**
 * Save state
 */
function saveState(state: HudState): void {
  ensureStateDir();
  state.lastUpdate = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Get context health status
 */
function getContextHealth(used: number, total: number): 'good' | 'warning' | 'critical' {
  const percentage = (used / total) * 100;
  if (percentage >= 90) return 'critical';
  if (percentage >= 70) return 'warning';
  return 'good';
}

/**
 * Create progress bar
 */
function createProgressBar(percentage: number, width: number = 20): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

/**
 * Format minimal status line
 */
function formatMinimal(state: HudState): string {
  const icon = MODE_ICONS[state.mode] || MODE_ICONS.idle;
  const phase = state.phase.total > 0
    ? `${state.phase.current}/${state.phase.total}`
    : '';
  return `${icon} ${state.mode}${phase ? ` [${phase}]` : ''}`;
}

/**
 * Format focused status line (default)
 */
function formatFocused(state: HudState): string {
  const icon = MODE_ICONS[state.mode] || MODE_ICONS.idle;
  const feature = state.feature ? `: ${state.feature}` : '';
  const phase = state.phase.total > 0
    ? ` [Phase ${state.phase.current}/${state.phase.total}]`
    : '';

  const contextPct = Math.round((state.context.used / state.context.total) * 100);
  const contextHealth = getContextHealth(state.context.used, state.context.total);
  const contextColor = HEALTH_COLORS[contextHealth];

  return `${icon} ${state.mode}${feature}${phase} | ${contextColor}CTX: ${contextPct}%${HEALTH_COLORS.reset}`;
}

/**
 * Format full status display
 */
function formatFull(state: HudState): string {
  const lines: string[] = [];
  const icon = MODE_ICONS[state.mode] || MODE_ICONS.idle;

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`${icon} VIBE HUD`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  lines.push(`Mode:    ${state.mode}`);
  if (state.feature) {
    lines.push(`Feature: ${state.feature}`);
  }

  if (state.phase.total > 0) {
    const progress = Math.round((state.phase.current / state.phase.total) * 100);
    const bar = createProgressBar(progress);
    lines.push(`Phase:   ${state.phase.current}/${state.phase.total} ${state.phase.name}`);
    lines.push(`         ${bar} ${progress}%`);
  }

  if (state.agents.length > 0) {
    lines.push(`Agents:  ${state.agents.map(a => `${a.name}(${a.model})`).join(', ')}`);
  }

  const contextPct = Math.round((state.context.used / state.context.total) * 100);
  const contextHealth = getContextHealth(state.context.used, state.context.total);
  const contextColor = HEALTH_COLORS[contextHealth];
  lines.push(`Context: ${contextColor}${contextPct}%${HEALTH_COLORS.reset} (${state.context.used.toLocaleString()}/${state.context.total.toLocaleString()})`);

  if (state.lastUpdate) {
    lines.push(`Updated: ${new Date(state.lastUpdate).toLocaleString()}`);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  return lines.join('\n');
}

/**
 * Show HUD status
 */
export function showHud(format: string = 'focused'): void {
  const state = loadState();
  if (format === 'minimal') {
    console.log(formatMinimal(state));
  } else if (format === 'full') {
    console.log(formatFull(state));
  } else {
    console.log(formatFocused(state));
  }
}

/**
 * Start HUD tracking
 */
export function startHud(mode: string = 'ultrawork', feature?: string): void {
  const state = loadState();
  state.mode = mode as HudState['mode'];
  state.feature = feature || null;
  state.phase = { current: 0, total: 0, name: '' };
  state.agents = [];
  saveState(state);
  console.log(`\u{1F680} Started ${mode}${feature ? `: ${feature}` : ''}`);
}

/**
 * Update HUD phase
 */
export function updateHudPhase(current: number, total: number, name?: string): void {
  const state = loadState();
  state.phase = { current, total, name: name || '' };
  saveState(state);
  console.log(`\u{1F4CD} Phase ${current}/${total}${name ? `: ${name}` : ''}`);
}

/**
 * Manage HUD agents
 */
export function manageHudAgent(action: 'add' | 'remove' | 'clear', name?: string, model?: string): void {
  const state = loadState();

  switch (action) {
    case 'add':
      if (name) {
        state.agents.push({ name, model: model || 'sonnet', startTime: Date.now() });
        saveState(state);
        console.log(`\u{1F916} Agent added: ${name} (${model || 'sonnet'})`);
      }
      break;
    case 'remove':
      if (name) {
        state.agents = state.agents.filter(a => a.name !== name);
        saveState(state);
        console.log(`\u{1F916} Agent removed: ${name}`);
      }
      break;
    case 'clear':
      state.agents = [];
      saveState(state);
      console.log(`\u{1F916} All agents cleared`);
      break;
  }
}

/**
 * Update HUD context usage
 */
export function updateHudContext(used: number, total: number = 200000): void {
  const state = loadState();
  state.context = { used, total };
  saveState(state);
  const pct = Math.round((used / total) * 100);
  console.log(`\u{1F4CA} Context: ${pct}%`);
}

/**
 * Reset HUD to idle state
 */
export function resetHud(): void {
  saveState({ ...DEFAULT_STATE });
  console.log(`\u{1F4A4} HUD reset`);
}

/**
 * Show HUD help
 */
export function showHudHelp(): void {
  console.log(`
VIBE HUD - Real-time status visualization

Commands:
  vibe hud                      Show current status (focused)
  vibe hud show [format]        Show status (minimal|focused|full)
  vibe hud start [mode] [name]  Start tracking (ultrawork|spec|review)
  vibe hud phase <cur> <tot> [name]  Update phase progress
  vibe hud agent add <name> [model]  Add agent
  vibe hud agent remove <name>       Remove agent
  vibe hud agent clear               Clear all agents
  vibe hud context <used> [total]    Update context usage
  vibe hud reset                     Reset to idle state

Examples:
  vibe hud show full
  vibe hud start ultrawork "login-feature"
  vibe hud phase 2 5 "Implementing core"
  vibe hud agent add "explorer-1" haiku
  vibe hud context 50000 200000
  `);
}
