#!/usr/bin/env node
/**
 * Codex native hook adapter.
 *
 * Maps Codex hook events to the existing vibe hook scripts while preserving
 * Codex JSON decisions for permission-deny cases.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractPrompt,
  extractToolInput,
  extractToolName,
  normalizeHookPayload,
  readStdinSync,
} from './hook-payload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const eventName = process.argv[2] || '';
const stdinData = readStdinSync();
const payload = normalizeHookPayload(stdinData, process.env);

if (process.env.VIBE_HOOK_DEPTH) process.exit(0);

function toolInputJson() {
  return JSON.stringify(extractToolInput(payload));
}

function childEnv() {
  return {
    ...process.env,
    HOOK_INPUT: stdinData || JSON.stringify(payload),
    TOOL_INPUT: toolInputJson(),
  };
}

function runScript(scriptName, args = []) {
  const scriptPath = path.join(__dirname, scriptName);
  return spawnSync(process.execPath, [scriptPath, ...args], {
    input: stdinData || JSON.stringify(payload),
    encoding: 'utf-8',
    env: childEnv(),
    timeout: 30000,
  });
}

function combinedOutput(result) {
  return `${result.stdout || ''}${result.stderr || ''}`.trim();
}

function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function writeAdditionalContext(text) {
  if (!text) return;
  writeJson({
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext: text,
    },
  });
}

function mappedToolName() {
  const toolName = extractToolName(payload, '');
  if (toolName === 'apply_patch') return 'Edit';
  if (toolName === 'shell') return 'Bash';
  return toolName;
}

function handlePreToolUse() {
  const result = runScript('pre-tool-dispatcher.js', [mappedToolName()]);
  const output = combinedOutput(result);
  if (result.status === 2) {
    writeJson({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: output || 'vibe pre-tool guard denied this operation',
      },
    });
    process.exit(2);
  }
  writeAdditionalContext(output);
}

function handleUserPromptSubmit() {
  if (!extractPrompt(payload)) return;
  const result = runScript('prompt-dispatcher.js');
  writeAdditionalContext(combinedOutput(result));
}

function handlePostToolUse() {
  const result = runScript('post-edit-dispatcher.js');
  writeAdditionalContext(combinedOutput(result));
}

function handleStop() {
  // Turn-complete side effects stay on Codex notify to avoid duplicate commits.
}

switch (eventName) {
  case 'SessionStart':
    writeAdditionalContext(combinedOutput(runScript('session-start.js')));
    break;
  case 'UserPromptSubmit':
    handleUserPromptSubmit();
    break;
  case 'PreToolUse':
    handlePreToolUse();
    break;
  case 'PostToolUse':
    handlePostToolUse();
    break;
  case 'Stop':
    handleStop();
    break;
  default:
    break;
}

process.exit(0);
