/**
 * CLI Commands: vibe interface <subcommand>
 * Phase 4: External Interface
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const VIBE_DIR = path.join(os.homedir(), '.vibe');
const INTERFACE_CONFIG = path.join(VIBE_DIR, 'interfaces.json');

interface InterfaceState {
  [name: string]: { enabled: boolean; lastUpdated: string };
}

function loadState(): InterfaceState {
  try {
    if (!fs.existsSync(INTERFACE_CONFIG)) return {};
    return JSON.parse(fs.readFileSync(INTERFACE_CONFIG, 'utf-8')) as InterfaceState;
  } catch {
    return {};
  }
}

function saveState(state: InterfaceState): void {
  if (!fs.existsSync(VIBE_DIR)) {
    fs.mkdirSync(VIBE_DIR, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(INTERFACE_CONFIG, JSON.stringify(state, null, 2));
}

export function interfaceList(): void {
  const state = loadState();
  const interfaces = ['telegram', 'web', 'webhook'];

  console.log(`
Active Interfaces:
${'━'.repeat(40)}`);

  for (const name of interfaces) {
    const info = state[name];
    const status = info?.enabled ? 'enabled' : 'disabled';
    const icon = info?.enabled ? '✅' : '❌';
    console.log(`  ${icon} ${name.padEnd(12)} ${status}`);
  }

  console.log('━'.repeat(40));
}

export function interfaceEnable(name: string): void {
  if (!name) {
    console.log('Usage: vibe interface enable <name>');
    return;
  }

  const valid = ['telegram', 'web', 'webhook'];
  if (!valid.includes(name)) {
    console.log(`Unknown interface: ${name}. Available: ${valid.join(', ')}`);
    return;
  }

  const state = loadState();
  state[name] = { enabled: true, lastUpdated: new Date().toISOString() };
  saveState(state);
  console.log(`Interface "${name}" enabled`);
}

export function interfaceDisable(name: string): void {
  if (!name) {
    console.log('Usage: vibe interface disable <name>');
    return;
  }

  const state = loadState();
  state[name] = { enabled: false, lastUpdated: new Date().toISOString() };
  saveState(state);
  console.log(`Interface "${name}" disabled`);
}

export function interfaceHelp(): void {
  console.log(`
Vibe Interface Commands:
  vibe interface list                List active interfaces
  vibe interface enable <name>       Enable an interface
  vibe interface disable <name>      Disable an interface
  vibe interface help                Show this help

Interfaces: telegram, web, webhook
  `);
}
