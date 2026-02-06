/**
 * CLI Commands: vibe device <subcommand>
 * Phase 5: Sync & Portability
 */

import { DeviceManager } from '../../sync/DeviceManager.js';
import { LogLevel } from '../../daemon/types.js';

const noopLogger = (_l: LogLevel, _m: string, _d?: unknown): void => {};

export function deviceList(): void {
  const manager = new DeviceManager(noopLogger);
  const devices = manager.listDevices();
  const currentId = manager.getDeviceId();

  if (devices.length === 0) {
    console.log('No devices registered');
    return;
  }

  console.log(`
Devices (${devices.length}):
${'━'.repeat(60)}`);

  for (const d of devices) {
    const current = d.id === currentId ? ' (this device)' : '';
    const lastSync = d.lastSyncAt ? ` | Last sync: ${d.lastSyncAt.split('T')[0]}` : '';
    console.log(`  ${d.name.padEnd(20)} ${d.platform.padEnd(15)}${lastSync}${current}`);
  }

  console.log('━'.repeat(60));
}

export function deviceRename(name: string): void {
  if (!name) {
    console.log('Usage: vibe device rename <name>');
    return;
  }

  const manager = new DeviceManager(noopLogger);
  manager.renameDevice(name);
  console.log(`Device renamed to "${name}"`);
}

export function deviceRemove(deviceId: string): void {
  if (!deviceId) {
    console.log('Usage: vibe device remove <device-id>');
    return;
  }

  const manager = new DeviceManager(noopLogger);
  if (manager.removeDevice(deviceId)) {
    console.log(`Device "${deviceId}" removed`);
  } else {
    console.log(`Cannot remove device "${deviceId}" (current device or not found)`);
  }
}

export function deviceHelp(): void {
  console.log(`
Vibe Device Commands:
  vibe device list                 List all synced devices
  vibe device rename <name>        Rename current device
  vibe device remove <device-id>   Remove a device
  vibe device help                 Show this help
  `);
}
