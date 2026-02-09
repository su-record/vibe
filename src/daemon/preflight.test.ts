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
    delete process.env.VIBE_IMESSAGE_ENABLED;
    delete process.env.VIBE_VISION_ENABLED;
    delete process.env.VIBE_WEB_ENABLED;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should pass with default config (no channels enabled)', async () => {
    const result = await runPreflight();
    // Should pass (no errors) though may have warnings
    expect(result.passed).toBe(true);
  });

  it('should warn when GPT API key is missing', async () => {
    delete process.env.OPENAI_API_KEY;
    const result = await runPreflight();
    const gptWarning = result.warnings.find((w) => w.check === 'head-model-api-key');
    expect(gptWarning).toBeDefined();
    expect(gptWarning?.resolution).toContain('vibe gpt');
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
});
