/**
 * GeminiLive Unit Tests
 * Phase 3: External Interface (Vision)
 */

import { describe, it, expect } from 'vitest';
import { GeminiLive } from './GeminiLive.js';

describe('GeminiLive', () => {
  it('should validate image size limit (5MB)', async () => {
    const live = new GeminiLive('test-key');
    // Base64 is 4/3 of binary size, so to exceed 5MB binary we need >6.67MB base64
    const oversizedImage = 'a'.repeat(Math.ceil((5 * 1024 * 1024 * 4) / 3) + 1000);
    await expect(live.sendImage(oversizedImage, 'image/jpeg', 'describe')).rejects.toThrow('5MB');
  });

  it('should validate message size limit (10MB)', async () => {
    const live = new GeminiLive('test-key');
    const oversizedText = 'b'.repeat(10 * 1024 * 1024 + 1);
    await expect(live.sendText(oversizedText)).rejects.toThrow('10MB');
  });

  it('should report not connected initially', () => {
    const live = new GeminiLive('test-key');
    expect(live.isConnected()).toBe(false);
  });

  it('should throw error when sending without connection', async () => {
    const live = new GeminiLive('test-key');
    await expect(live.sendText('hello')).rejects.toThrow('Not connected');
  });

  it('should throw error when sending image without connection', async () => {
    const live = new GeminiLive('test-key');
    await expect(
      live.sendImage('base64data', 'image/jpeg', 'describe')
    ).rejects.toThrow('Not connected');
  });

  it('should calculate image size correctly (base64 overhead)', async () => {
    const live = new GeminiLive('test-key');
    // Base64 is ~33% larger: 5MB binary = 6.67MB base64
    // So 5MB * 4/3 = 6.67MB base64 should fail
    const exactLimit = Math.ceil((5 * 1024 * 1024 * 4) / 3);
    const oversized = 'a'.repeat(exactLimit + 100);
    await expect(live.sendImage(oversized, 'image/jpeg', 'test')).rejects.toThrow('5MB');
  });
});
