#!/usr/bin/env node
/**
 * Evolution Engine Hook - PostToolUse (Write/Edit)
 * Triggers insight extraction and optional generation every N tool uses.
 * Fire-and-forget: hook returns immediately, processing runs in background.
 */
import { getToolsBaseUrl, getLibBaseUrl, PROJECT_DIR } from './utils.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Throttle: only run every 5th tool use per session
let toolUseCount = 0;
const TRIGGER_EVERY = 5;

// Read config
function getEvolutionConfig() {
  try {
    const configPath = path.join(PROJECT_DIR, '.claude', 'vibe', 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config.evolution || {};
    }
  } catch { /* ignore */ }
  return {};
}

// stdin에서 hook input 읽기
let inputData = '';
for await (const chunk of process.stdin) {
  inputData += chunk;
}

let hookInput;
try {
  hookInput = JSON.parse(inputData);
} catch {
  process.exit(0);
}

// Only trigger on Write/Edit tool completions
const toolName = hookInput?.tool_name || '';
if (toolName !== 'Write' && toolName !== 'Edit') {
  process.exit(0);
}

toolUseCount++;
if (toolUseCount % TRIGGER_EVERY !== 0) {
  process.exit(0);
}

// Check if evolution is enabled
const config = getEvolutionConfig();
if (config.enabled === false) {
  process.exit(0);
}

// Fire-and-forget: schedule background processing
setImmediate(async () => {
  try {
    const LIB_BASE = getLibBaseUrl();
    const [memModule, insightModule, orchestratorModule] = await Promise.all([
      import(`${LIB_BASE}memory/MemoryStorage.js`),
      import(`${LIB_BASE}evolution/InsightExtractor.js`),
      import(`${LIB_BASE}evolution/EvolutionOrchestrator.js`),
    ]);

    const storage = new memModule.MemoryStorage(PROJECT_DIR);
    const extractor = new insightModule.InsightExtractor(storage);

    // Step 1: Extract insights
    const result = extractor.extractFromRecent(20);

    if (result.newInsights.length > 0) {
      const mode = config.mode || 'suggest';

      // Step 2: Generate if new insights found
      const orchestrator = new orchestratorModule.EvolutionOrchestrator(storage, {
        mode,
        maxGenerationsPerCycle: config.maxGenerationsPerCycle || 5,
        minQualityScore: config.minQualityScore || 60,
      });

      const genResult = orchestrator.generate();

      if (mode === 'suggest' && genResult.generated.length > 0) {
        // Notify user about new candidates
        process.stderr.write(
          `[Evolution] New candidates: ${genResult.generated.length} generated, ` +
          `${genResult.rejected.length} rejected\n`
        );
      }
    }

    storage.close();
  } catch (error) {
    process.stderr.write(
      `[Evolution] Background error: ${error instanceof Error ? error.message : 'Unknown'}\n`
    );
  }
});
