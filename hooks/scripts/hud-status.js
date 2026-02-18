#!/usr/bin/env node
/**
 * HUD Status Manager
 * 실시간 상태 시각화 (Claude Code statusline 연동)
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// 상태 저장 경로
const STATE_DIR = path.join(os.homedir(), '.claude', '.vibe-hud');
const STATE_FILE = path.join(STATE_DIR, 'state.json');

// 기본 상태
const DEFAULT_STATE = {
  mode: 'idle',           // idle | ultrawork | spec | review
  feature: null,
  phase: { current: 0, total: 0, name: '' },
  agents: [],             // 실행 중인 에이전트들
  context: { used: 0, total: 200000 }, // 컨텍스트 사용량
  lastUpdate: null,
};

// 상태 아이콘
const MODE_ICONS = {
  idle: '💤',
  ultrawork: '🚀',
  spec: '📝',
  review: '🔍',
  implementing: '🔨',
  testing: '🧪',
  error: '❌',
};

// 건강 상태 색상 (ANSI)
const HEALTH_COLORS = {
  good: '\x1b[32m',    // 녹색
  warning: '\x1b[33m', // 노란색
  critical: '\x1b[31m', // 빨간색
  reset: '\x1b[0m',
};

/**
 * 상태 디렉토리 초기화
 */
function ensureStateDir() {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

/**
 * 현재 상태 로드
 */
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch {
    // 무시
  }
  return { ...DEFAULT_STATE };
}

/**
 * 상태 저장
 */
function saveState(state) {
  ensureStateDir();
  state.lastUpdate = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * 상태 업데이트
 */
function updateState(updates) {
  const state = loadState();
  Object.assign(state, updates);
  saveState(state);
  return state;
}

/**
 * 컨텍스트 건강 상태
 */
function getContextHealth(used, total) {
  const percentage = (used / total) * 100;
  if (percentage >= 90) return 'critical';
  if (percentage >= 70) return 'warning';
  return 'good';
}

/**
 * 상태 라인 포맷 (minimal)
 */
function formatMinimal(state) {
  const icon = MODE_ICONS[state.mode] || '💤';
  const phase = state.phase.total > 0
    ? `${state.phase.current}/${state.phase.total}`
    : '';
  return `${icon} ${state.mode}${phase ? ` [${phase}]` : ''}`;
}

/**
 * 상태 라인 포맷 (focused - default)
 */
function formatFocused(state) {
  const icon = MODE_ICONS[state.mode] || '💤';
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
 * 상태 라인 포맷 (full)
 */
function formatFull(state) {
  const lines = [];
  const icon = MODE_ICONS[state.mode] || '💤';

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
  lines.push(`Context: ${contextColor}${contextPct}%${HEALTH_COLORS.reset} (${state.context.used}/${state.context.total})`);

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  return lines.join('\n');
}

/**
 * 프로그레스 바 생성
 */
function createProgressBar(percentage, width = 20) {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

/**
 * CLI 명령 처리
 */
function handleCommand(args) {
  const command = args[0];
  const params = args.slice(1);

  switch (command) {
    case 'show':
    case 'status': {
      const format = params[0] || 'focused';
      const state = loadState();
      if (format === 'minimal') console.log(formatMinimal(state));
      else if (format === 'full') console.log(formatFull(state));
      else console.log(formatFocused(state));
      break;
    }

    case 'set': {
      const key = params[0];
      const value = params[1];
      if (key && value !== undefined) {
        const updates = {};
        // 중첩 키 처리 (예: phase.current)
        if (key.includes('.')) {
          const [parent, child] = key.split('.');
          const state = loadState();
          updates[parent] = { ...(state[parent] || {}), [child]: isNaN(value) ? value : Number(value) };
        } else {
          updates[key] = isNaN(value) ? value : Number(value);
        }
        updateState(updates);
        console.log(`✓ Updated ${key}`);
      }
      break;
    }

    case 'start': {
      const mode = params[0] || 'ultrawork';
      const feature = params[1] || null;
      updateState({
        mode,
        feature,
        phase: { current: 0, total: 0, name: '' },
        agents: [],
      });
      console.log(`🚀 Started ${mode}${feature ? `: ${feature}` : ''}`);
      break;
    }

    case 'phase': {
      const current = parseInt(params[0], 10) || 1;
      const total = parseInt(params[1], 10) || current;
      const name = params.slice(2).join(' ') || '';
      updateState({ phase: { current, total, name } });
      console.log(`📍 Phase ${current}/${total}${name ? `: ${name}` : ''}`);
      break;
    }

    case 'agent': {
      const action = params[0]; // add | remove | clear
      const state = loadState();
      if (action === 'add') {
        const name = params[1];
        const model = params[2] || 'sonnet';
        state.agents.push({ name, model, startTime: Date.now() });
        saveState(state);
        console.log(`🤖 Agent added: ${name} (${model})`);
      } else if (action === 'remove') {
        const name = params[1];
        state.agents = state.agents.filter(a => a.name !== name);
        saveState(state);
        console.log(`🤖 Agent removed: ${name}`);
      } else if (action === 'clear') {
        state.agents = [];
        saveState(state);
        console.log(`🤖 All agents cleared`);
      }
      break;
    }

    case 'context': {
      const used = parseInt(params[0], 10) || 0;
      const total = parseInt(params[1], 10) || 200000;
      updateState({ context: { used, total } });
      const pct = Math.round((used / total) * 100);
      console.log(`📊 Context: ${pct}%`);
      break;
    }

    case 'done':
    case 'reset': {
      saveState({ ...DEFAULT_STATE });
      console.log(`💤 HUD reset`);
      break;
    }

    default:
      console.log(`
VIBE HUD - Real-time status visualization

Commands:
  show [format]     Show current status (minimal|focused|full)
  start [mode] [feature]  Start tracking (ultrawork|spec|review)
  phase <current> <total> [name]  Update phase progress
  agent add|remove|clear [name] [model]  Manage agents
  context <used> [total]  Update context usage
  set <key> <value>  Set arbitrary state value
  done|reset        Reset to idle state

Examples:
  node hud-status.js show full
  node hud-status.js start ultrawork "login-feature"
  node hud-status.js phase 2 5 "Implementing core"
  node hud-status.js agent add "explore-1" haiku
      `);
  }
}

// 메인 실행
const args = process.argv.slice(2);
handleCommand(args);
