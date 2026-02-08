/**
 * IMessageSender - Send iMessages via AppleScript/JXA
 * Phase 4: External Interface
 *
 * CRITICAL: Command injection prevention - never pass user content via shell arguments.
 * Uses temp files for message content to avoid shell interpretation.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const RATE_LIMIT_MS = 1000; // 1 message per second
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export class IMessageSender {
  private static lastSendTime: number = 0;
  private static phoneRegex = /^\+?[\d\s\-()]{10,20}$/;
  private static emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  static async send(handle: string, message: string): Promise<void> {
    // Validate handle
    if (!this.isValidHandle(handle)) {
      throw new Error(`Invalid iMessage handle format: ${handle}`);
    }

    // Rate limiting
    await this.enforceRateLimit();

    // Retry logic
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.sendWithJXA(handle, message);
        this.lastSendTime = Date.now();
        return;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);

        if (attempt < MAX_RETRIES) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
          continue;
        }

        throw new Error(`Failed to send iMessage after ${MAX_RETRIES} attempts: ${errMsg}`);
      }
    }
  }

  // ========================================================================
  // Private
  // ========================================================================

  private static isValidHandle(handle: string): boolean {
    return this.phoneRegex.test(handle) || this.emailRegex.test(handle);
  }

  private static async enforceRateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastSendTime;
    if (elapsed < RATE_LIMIT_MS) {
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS - elapsed));
    }
  }

  private static async sendWithJXA(handle: string, message: string): Promise<void> {
    const tempFile = path.join('/tmp', `vibe-imsg-${crypto.randomUUID()}.txt`);

    try {
      // Write message to temp file with restrictive permissions
      await fs.writeFile(tempFile, message, { encoding: 'utf-8', mode: 0o600 });

      // Escape handle for JXA (only allow alphanumeric, +, @, ., -, space)
      const escapedHandle = this.escapeForJXA(handle);

      // Build JXA script - CRITICAL: No user content in script itself
      const jxaScript = `
        const app = Application("Messages");
        const fs = $.NSFileManager.defaultManager;
        const data = fs.contentsAtPath("${tempFile}");
        if (!data) {
          throw new Error("Failed to read temp file");
        }
        const text = $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding).js;

        // Find buddy by handle
        const buddies = app.buddies.whose({handle: "${escapedHandle}"});
        if (buddies.length === 0) {
          throw new Error("Buddy not found: ${escapedHandle}");
        }
        const buddy = buddies[0];

        // Get iMessage service
        const services = app.services.whose({serviceType: "iMessage"});
        if (services.length === 0) {
          throw new Error("iMessage service not available");
        }
        const service = services[0];

        // Send message
        app.send(text, {to: buddy});
      `;

      // Execute JXA via osascript - use spawn with explicit args array
      await this.executeOsascript(jxaScript);
    } finally {
      // Clean up temp file
      try {
        await fs.unlink(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  private static escapeForJXA(handle: string): string {
    // Only allow safe characters for JXA string literal
    // This prevents injection even though we're using temp files for message content
    return handle.replace(/[^a-zA-Z0-9+@.\-\s()]/g, '');
  }

  private static executeOsascript(script: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('osascript', ['-l', 'JavaScript', '-e', script], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10000,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on('error', (err) => {
        reject(new Error(`osascript spawn error: ${err.message}`));
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`osascript failed (exit ${code}): ${stderr || stdout}`));
        }
      });
    });
  }
}
