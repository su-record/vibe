#!/usr/bin/env node
/**
 * Multi-Line HUD Visualization
 * Tree-based status display with overflow handling
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// State file
const STATE_DIR = path.join(os.homedir(), '.claude', '.vibe-hud');
const STATE_FILE = path.join(STATE_DIR, 'state.json');

// Tree characters
const TREE = {
  branch: '├─',
  last: '└─',
  vertical: '│ ',
  space: '  ',
};

// ANSI colors
const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// Status icons
const ICONS = {
  running: '🔄',
  success: '✅',
  error: '❌',
  warning: '⚠️',
  pending: '⏳',
  agent: '🤖',
  phase: '📍',
  context: '📊',
  task: '📋',
};

/**
 * Load current state
 */
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch {
    // Ignore
  }
  return {
    mode: 'idle',
    feature: null,
    phase: { current: 0, total: 0, name: '' },
    agents: [],
    tasks: [],
    context: { used: 0, total: 200000 },
  };
}

/**
 * Create progress bar
 */
function createProgressBar(current, total, width = 20) {
  const percentage = total > 0 ? current / total : 0;
  const filled = Math.round(percentage * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

/**
 * Format context health
 */
function formatContextHealth(used, total) {
  const percentage = Math.round((used / total) * 100);
  let color = COLORS.green;
  let icon = ICONS.success;

  if (percentage >= 90) {
    color = COLORS.red;
    icon = ICONS.error;
  } else if (percentage >= 70) {
    color = COLORS.yellow;
    icon = ICONS.warning;
  }

  return `${color}${icon} ${percentage}%${COLORS.reset}`;
}

/**
 * Multi-line render with tree structure
 */
function renderMultiLine(state, maxLines = 10) {
  const lines = [];
  const modeIcon = state.mode === 'ultrawork' ? '🚀' :
                   state.mode === 'spec' ? '📝' :
                   state.mode === 'review' ? '🔍' :
                   state.mode === 'implementing' ? '🔨' : '💤';

  // Header line
  const header = `${modeIcon} ${COLORS.bold}VIBE${COLORS.reset} ${state.mode.toUpperCase()}`;
  lines.push(header);

  // Feature name
  if (state.feature) {
    lines.push(`${TREE.branch} Feature: ${COLORS.cyan}${state.feature}${COLORS.reset}`);
  }

  // Phase progress
  if (state.phase.total > 0) {
    const phaseBar = createProgressBar(state.phase.current, state.phase.total, 15);
    const phaseName = state.phase.name ? ` - ${state.phase.name}` : '';
    lines.push(`${TREE.branch} ${ICONS.phase} Phase ${state.phase.current}/${state.phase.total}${phaseName}`);
    lines.push(`${TREE.vertical}   ${phaseBar}`);
  }

  // Active agents
  if (state.agents && state.agents.length > 0) {
    lines.push(`${TREE.branch} ${ICONS.agent} Agents (${state.agents.length})`);
    const displayAgents = state.agents.slice(0, 3);
    const remaining = state.agents.length - displayAgents.length;

    displayAgents.forEach((agent, i) => {
      const isLast = i === displayAgents.length - 1 && remaining === 0;
      const prefix = isLast ? TREE.last : TREE.branch;
      const modelColor = agent.model === 'opus' ? COLORS.magenta :
                         agent.model === 'sonnet' ? COLORS.blue : COLORS.green;
      lines.push(`${TREE.vertical} ${prefix} ${agent.name} ${modelColor}(${agent.model})${COLORS.reset}`);
    });

    if (remaining > 0) {
      lines.push(`${TREE.vertical} ${TREE.last} +${remaining} more...`);
    }
  }

  // Active tasks
  if (state.tasks && state.tasks.length > 0) {
    lines.push(`${TREE.branch} ${ICONS.task} Tasks (${state.tasks.length})`);
    const displayTasks = state.tasks.slice(0, 3);
    const remaining = state.tasks.length - displayTasks.length;

    displayTasks.forEach((task, i) => {
      const isLast = i === displayTasks.length - 1 && remaining === 0;
      const prefix = isLast ? TREE.last : TREE.branch;
      const statusIcon = task.status === 'completed' ? ICONS.success :
                         task.status === 'failed' ? ICONS.error :
                         task.status === 'running' ? ICONS.running : ICONS.pending;
      lines.push(`${TREE.vertical} ${prefix} ${statusIcon} ${task.name}`);
    });

    if (remaining > 0) {
      lines.push(`${TREE.vertical} ${TREE.last} +${remaining} more...`);
    }
  }

  // Context usage
  const contextHealth = formatContextHealth(state.context.used, state.context.total);
  lines.push(`${TREE.last} ${ICONS.context} Context: ${contextHealth}`);

  // Truncate if too many lines
  if (lines.length > maxLines) {
    const truncated = lines.slice(0, maxLines - 1);
    truncated.push(`${COLORS.dim}... (${lines.length - maxLines + 1} more lines)${COLORS.reset}`);
    return truncated;
  }

  return lines;
}

/**
 * Render single-line summary
 */
function renderSingleLine(state) {
  const modeIcon = state.mode === 'ultrawork' ? '🚀' :
                   state.mode === 'spec' ? '📝' :
                   state.mode === 'review' ? '🔍' :
                   state.mode === 'implementing' ? '🔨' : '💤';

  const parts = [modeIcon, state.mode];

  if (state.feature) {
    parts.push(`[${state.feature}]`);
  }

  if (state.phase.total > 0) {
    parts.push(`P:${state.phase.current}/${state.phase.total}`);
  }

  if (state.agents && state.agents.length > 0) {
    parts.push(`A:${state.agents.length}`);
  }

  const contextPct = Math.round((state.context.used / state.context.total) * 100);
  parts.push(`C:${contextPct}%`);

  return parts.join(' ');
}

/**
 * Render compact view
 */
function renderCompact(state) {
  const lines = [];
  const modeIcon = state.mode === 'ultrawork' ? '🚀' :
                   state.mode === 'spec' ? '📝' :
                   state.mode === 'review' ? '🔍' :
                   state.mode === 'implementing' ? '🔨' : '💤';

  // Line 1: Mode + Feature
  let line1 = `${modeIcon} ${state.mode}`;
  if (state.feature) line1 += `: ${state.feature}`;
  lines.push(line1);

  // Line 2: Phase + Agents + Context
  const parts = [];
  if (state.phase.total > 0) {
    parts.push(`P:${state.phase.current}/${state.phase.total}`);
  }
  if (state.agents && state.agents.length > 0) {
    parts.push(`A:${state.agents.length}`);
  }
  const contextPct = Math.round((state.context.used / state.context.total) * 100);
  const contextColor = contextPct >= 90 ? COLORS.red :
                       contextPct >= 70 ? COLORS.yellow : COLORS.green;
  parts.push(`${contextColor}C:${contextPct}%${COLORS.reset}`);

  lines.push(`  ${parts.join(' | ')}`);

  return lines;
}

/**
 * CLI handler
 */
const command = process.argv[2] || 'multi';
const state = loadState();

switch (command) {
  case 'single':
    console.log(renderSingleLine(state));
    break;

  case 'compact':
    console.log(renderCompact(state).join('\n'));
    break;

  case 'multi':
  case 'full':
  default:
    const maxLines = parseInt(process.argv[3], 10) || 10;
    console.log(renderMultiLine(state, maxLines).join('\n'));
    break;
}
