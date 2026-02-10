/**
 * CLI Commands: vibe policy <subcommand>
 * Phase 3: Policy Engine
 */

import { PolicyStore } from '../../infra/policy/PolicyStore.js';
import { LogLevel } from '../../daemon/types.js';

const noopLogger = (_l: LogLevel, _m: string, _d?: unknown): void => {};

export function policyList(): void {
  const store = new PolicyStore(noopLogger);
  store.loadAll(process.cwd());

  const policies = store.getAll();

  if (policies.length === 0) {
    console.log('ℹ️  No policies loaded');
    return;
  }

  console.log(`
📋 Policies (${policies.length})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  for (const p of policies) {
    const status = store.isEnabled(p.name) ? '✅' : '❌';
    const type = p.type === 'safety' ? '🔒' : '⚙️';
    console.log(`  ${status} ${type} ${p.name.padEnd(20)} │ ${p.source.padEnd(8)} │ ${p.rules.length} rules │ v${p.version}`);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

export function policyEnable(name: string): void {
  if (!name) {
    console.log('Usage: vibe policy enable <policy-name>');
    return;
  }

  const store = new PolicyStore(noopLogger);
  store.loadAll(process.cwd());

  if (store.enablePolicy(name)) {
    console.log(`✅ Policy "${name}" enabled`);
  } else {
    console.log(`ℹ️  Policy "${name}" is already enabled or not found`);
  }
}

export function policyDisable(name: string): void {
  if (!name) {
    console.log('Usage: vibe policy disable <policy-name>');
    return;
  }

  const store = new PolicyStore(noopLogger);
  store.loadAll(process.cwd());

  if (store.disablePolicy(name)) {
    console.log(`✅ Policy "${name}" disabled`);
  } else {
    const policy = store.getPolicy(name);
    if (policy?.type === 'safety') {
      console.log(`❌ Cannot disable safety policy "${name}"`);
    } else {
      console.log(`❌ Policy "${name}" not found`);
    }
  }
}

export function policySet(key: string, value: string): void {
  console.log(`ℹ️  Policy setting: ${key} = ${value}`);
  console.log('   (Policy settings will be persisted in future updates)');
}

export function policyHelp(): void {
  console.log(`
Vibe Policy Commands:
  vibe policy list                 List all policies
  vibe policy enable <name>        Enable a policy
  vibe policy disable <name>       Disable a configuration policy
  vibe policy set <key> <value>    Set policy option
  vibe policy help                 Show this help

Note: Safety policies (file-safety, command-safety) cannot be disabled.
  `);
}
