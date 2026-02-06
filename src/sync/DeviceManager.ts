/**
 * DeviceManager - Manage synced devices
 * Phase 5: Sync & Portability
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';
import { Device } from './types.js';
import { LogLevel } from '../daemon/types.js';

const VIBE_DIR = path.join(os.homedir(), '.vibe');
const DEVICES_FILE = path.join(VIBE_DIR, 'devices.json');
const DEVICE_ID_FILE = path.join(VIBE_DIR, 'device-id');

export class DeviceManager {
  private logger: (level: LogLevel, message: string, data?: unknown) => void;
  private deviceId: string;
  private devices: Map<string, Device> = new Map();

  constructor(logger: (level: LogLevel, message: string, data?: unknown) => void) {
    this.logger = logger;
    this.deviceId = this.getOrCreateDeviceId();
    this.loadDevices();
    this.ensureCurrentDevice();
  }

  /** Get current device ID */
  getDeviceId(): string {
    return this.deviceId;
  }

  /** Get current device */
  getCurrentDevice(): Device {
    const device = this.devices.get(this.deviceId);
    if (!device) {
      throw new Error(`Current device not found: ${this.deviceId}`);
    }
    return device;
  }

  /** Get all known devices */
  listDevices(): Device[] {
    return Array.from(this.devices.values());
  }

  /** Rename current device */
  renameDevice(name: string): void {
    const device = this.devices.get(this.deviceId);
    if (device) {
      device.name = name;
      this.saveDevices();
      this.logger('info', `Device renamed to "${name}"`);
    }
  }

  /** Remove a device */
  removeDevice(deviceId: string): boolean {
    if (deviceId === this.deviceId) {
      this.logger('warn', 'Cannot remove current device');
      return false;
    }

    const result = this.devices.delete(deviceId);
    if (result) {
      this.saveDevices();
    }
    return result;
  }

  /** Update last sync time for a device */
  updateLastSync(deviceId?: string): void {
    const id = deviceId || this.deviceId;
    const device = this.devices.get(id);
    if (device) {
      device.lastSyncAt = new Date().toISOString();
      this.saveDevices();
    }
  }

  /** Add a remote device (from sync data) */
  addRemoteDevice(device: Device): void {
    if (!this.devices.has(device.id)) {
      this.devices.set(device.id, device);
      this.saveDevices();
    }
  }

  // ========================================================================
  // Private
  // ========================================================================

  private getOrCreateDeviceId(): string {
    try {
      if (fs.existsSync(DEVICE_ID_FILE)) {
        return fs.readFileSync(DEVICE_ID_FILE, 'utf-8').trim();
      }
    } catch {
      // Generate new
    }

    const id = crypto.randomUUID();
    try {
      if (!fs.existsSync(VIBE_DIR)) {
        fs.mkdirSync(VIBE_DIR, { recursive: true, mode: 0o700 });
      }
      fs.writeFileSync(DEVICE_ID_FILE, id);
    } catch {
      // Non-fatal
    }
    return id;
  }

  private ensureCurrentDevice(): void {
    if (!this.devices.has(this.deviceId)) {
      const device: Device = {
        id: this.deviceId,
        name: os.hostname(),
        platform: `${os.platform()}-${os.arch()}`,
        createdAt: new Date().toISOString(),
      };
      this.devices.set(this.deviceId, device);
      this.saveDevices();
    }
  }

  private loadDevices(): void {
    try {
      if (fs.existsSync(DEVICES_FILE)) {
        const data = JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf-8')) as Device[];
        for (const device of data) {
          this.devices.set(device.id, device);
        }
      }
    } catch (err) {
      this.logger('warn', 'Failed to load devices', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private saveDevices(): void {
    try {
      if (!fs.existsSync(VIBE_DIR)) {
        fs.mkdirSync(VIBE_DIR, { recursive: true, mode: 0o700 });
      }
      const data = Array.from(this.devices.values());
      fs.writeFileSync(DEVICES_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
      this.logger('warn', 'Failed to save devices', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
