/**
 * Preflight Check Tests
 * Phase 1: Task 4.3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runPreflight } from './preflight.js';

describe('Preflight', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Disable all channels by default for testing
    delete process.env.VIBE_TELEGRAM_ENABLED;
    delete process.env.VIBE_SLACK_ENABLED;
    delete process.env.VIBE_VISION_ENABLED;
    delete process.env.VIBE_WEB_ENABLED;
    delete process.env.VIBE_BROWSER_ENABLED;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should pass with default config (no channels enabled)', async () => {
    const result = await runPreflight();
    // Should pass (no errors) though may have warnings
    expect(result.passed).toBe(true);
  });

  it('should warn when GPT auth is missing or pass when configured', async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await runPreflight();
    const gptWarning = result.warnings.find((w) => w.check === 'head-model-api-key');
    // If GPT auth files exist at the global config dir, no warning should appear.
    // If no auth files exist, the warning should appear with proper resolution text.
    if (gptWarning) {
      expect(gptWarning.resolution).toContain('vibe gpt');
    }
    // Either way, preflight should pass (GPT missing is a warning, not error)
    expect(result.passed).toBe(true);
  });

  it('should error when Slack enabled without tokens', async () => {
    process.env.VIBE_SLACK_ENABLED = 'true';
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_APP_TOKEN;
    const result = await runPreflight();
    expect(result.passed).toBe(false);
    const slackErrors = result.errors.filter((e) => e.check.startsWith('slack'));
    expect(slackErrors.length).toBeGreaterThan(0);
  });

  it('should complete within 2 seconds', async () => {
    const start = Date.now();
    await runPreflight();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(2000);
  });

  describe('macOS Permissions (OpenClaw pattern)', () => {
    it('should skip macOS checks when channels are disabled', async () => {
      const result = await runPreflight();
      const macChecks = [...result.errors, ...result.warnings].filter(
        (item) => ['accessibility', 'playwright', 'playwright-chromium'].includes(item.check),
      );
      expect(macChecks).toHaveLength(0);
    });

    it('should not warn screen recording for vision (Gemini Live = WebSocket, no TCC)', async () => {
      if (process.platform !== 'darwin') return;
      process.env.VIBE_VISION_ENABLED = 'true';
      process.env.GEMINI_API_KEY = 'test-key';
      const result = await runPreflight();
      const srWarning = result.warnings.find((w) => w.check === 'screen-recording');
      expect(srWarning).toBeUndefined();
    });

    it('should warn accessibility when browser enabled', async () => {
      if (process.platform !== 'darwin') return;
      process.env.VIBE_BROWSER_ENABLED = 'true';
      const result = await runPreflight();
      const accWarning = result.warnings.find((w) => w.check === 'accessibility');
      expect(accWarning).toBeDefined();
      expect(accWarning?.resolution).toContain('x-apple.systempreferences');
    });

    it('should check playwright via filesystem, not execSync', async () => {
      if (process.platform !== 'darwin') return;
      process.env.VIBE_BROWSER_ENABLED = 'true';
      const result = await runPreflight();
      const pwItems = [...result.errors, ...result.warnings].filter(
        (item) => item.check.startsWith('playwright'),
      );
      expect(pwItems.length).toBeGreaterThan(0);
      expect(pwItems[0].resolution).toContain('playwright');
    });
  });
});
