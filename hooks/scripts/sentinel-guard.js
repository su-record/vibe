#!/usr/bin/env node
/**
 * Sentinel Guard — PreToolUse hook
 * Protects sentinel files and blocks dangerous operations.
 * Runs before pre-tool-guard.js.
 */

const SENTINEL_PATH_PREFIX = 'src/infra/lib/autonomy/';

const SENTINEL_PATH_RE = /^(\.\/|\.\\)?src[\\/]infra[\\/]lib[\\/]autonomy[\\/]/;

const DANGEROUS_BASH_RE =
  /\b(rm\s+-rf|kill\s+-9|drop\s+table|truncate|shutdown|reboot|mkfs|dd\s+if=)\b/i;

/**
 * Extract file path from tool input
 */
function extractFilePath(toolName, input) {
  if (!input) return null;
  try {
    const parsed = typeof input === 'string' ? JSON.parse(input) : input;
    if (toolName === 'Write' || toolName === 'Edit' || toolName === 'Read') {
      return parsed.file_path || parsed.filePath || null;
    }
  } catch {
    // Not JSON, try as plain string
    return typeof input === 'string' ? input : null;
  }
  return null;
}

/**
 * Extract command from Bash tool input
 */
function extractBashCommand(input) {
  if (!input) return null;
  try {
    const parsed = typeof input === 'string' ? JSON.parse(input) : input;
    return parsed.command || null;
  } catch {
    return typeof input === 'string' ? input : null;
  }
}

/**
 * Check if path targets sentinel files
 */
function isSentinelPath(filePath) {
  if (!filePath) return false;
  const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  return normalized.startsWith(SENTINEL_PATH_PREFIX) || SENTINEL_PATH_RE.test(filePath);
}

/**
 * Main guard logic
 */
function guard(toolName, toolInput) {
  // Write/Edit targeting sentinel files → block
  if (toolName === 'Write' || toolName === 'Edit') {
    const filePath = extractFilePath(toolName, toolInput);
    if (isSentinelPath(filePath)) {
      return {
        decision: 'block',
        reason: `Sentinel files are protected. Cannot modify: ${filePath}`,
      };
    }
  }

  // Bash targeting sentinel files or dangerous commands
  if (toolName === 'Bash') {
    const command = extractBashCommand(toolInput);
    if (command && isSentinelPath(command)) {
      return {
        decision: 'block',
        reason: `Sentinel files are protected. Dangerous command targeting sentinel path.`,
      };
    }
    if (command && DANGEROUS_BASH_RE.test(command)) {
      // Check if command targets sentinel files
      if (command.includes(SENTINEL_PATH_PREFIX) || command.includes('src/infra/lib/autonomy')) {
        return {
          decision: 'block',
          reason: `Dangerous command targeting sentinel path: ${command}`,
        };
      }
    }
  }

  // Allow — return undefined for normal flow
  return undefined;
}

// Main execution
const toolName = process.argv[2] || '';
const toolInput = process.argv[3] || process.env.TOOL_INPUT || '';

const result = guard(toolName, toolInput);

if (result) {
  console.log(JSON.stringify(result));
  process.exit(1);
}

process.exit(0);
