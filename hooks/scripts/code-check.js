/**
 * PostToolUse Hook - Write/Edit 후 코드 품질 검사 + 관찰 자동 캡처
 */
import { getToolsBaseUrl, PROJECT_DIR } from './utils.js';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import path from 'path';
import os from 'os';

process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});

const BASE_URL = getToolsBaseUrl();

/**
 * stdin에서 hook input JSON을 읽어 파일 경로 추출
 */
function getModifiedFiles() {
  try {
    const input = process.env.HOOK_INPUT;
    if (input) {
      const parsed = JSON.parse(input);
      const filePath = parsed.tool_input?.file_path || parsed.tool_input?.path;
      return filePath ? [filePath] : [];
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * 파일 확장자/경로로 관찰 타입 분류
 */
function classifyObservation(files) {
  const hasTest = files.some(f => /\.(test|spec)\.[jt]sx?$/.test(f) || /\/__tests__\//.test(f));
  const hasConfig = files.some(f => /\.(json|ya?ml|toml|env|config)/.test(f));

  if (hasTest) return { type: 'feature', title: 'Test file updated' };
  if (hasConfig) return { type: 'refactor', title: 'Configuration updated' };
  return { type: 'feature', title: 'Code modified' };
}

/**
 * Detect `any` type usage and return line-level findings
 */
function detectAnyType(lines) {
  const findings = [];
  lines.forEach((line, i) => {
    if (/:\s*any\b|<any>|as\s+any\b/.test(line)) {
      findings.push({
        line: i + 1,
        match: line.trim(),
        suggestion: 'Replace with: unknown + type guard pattern: if (typeof x === \'string\') { ... }'
      });
    }
  });
  return findings;
}

/**
 * Detect functions exceeding 50 lines
 */
function detectLongFunctions(lines) {
  const findings = [];
  let fnStart = -1;
  let fnName = '';
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fnMatch = line.match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\()/);
    if (fnMatch && depth === 0) {
      fnStart = i;
      fnName = fnMatch[1] || fnMatch[2] || 'anonymous';
    }
    depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    if (fnStart !== -1 && depth <= 0) {
      const length = i - fnStart + 1;
      if (length > 50) {
        findings.push({
          line: fnStart + 1,
          match: `function '${fnName}' is ${length} lines`,
          suggestion: `Extract lines ${fnStart + 20}–${i + 1} into a separate helper function`
        });
      }
      fnStart = -1;
      depth = 0;
    }
  }
  return findings;
}

/**
 * Detect nesting depth exceeding 3 levels
 */
function detectDeepNesting(lines) {
  const findings = [];
  let depth = 0;
  let reported = false;

  lines.forEach((line, i) => {
    depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    if (depth > 3 && !reported) {
      findings.push({
        line: i + 1,
        match: `nesting depth ${depth} at line ${i + 1}`,
        suggestion: 'Use early return pattern: if (!condition) return; — instead of wrapping in else'
      });
      reported = true;
    }
    if (depth <= 3) reported = false;
  });
  return findings;
}

/**
 * Detect console.log statements
 */
function detectConsoleLogs(lines) {
  const findings = [];
  lines.forEach((line, i) => {
    if (/console\.log\(/.test(line)) {
      findings.push({
        line: i + 1,
        match: line.trim(),
        suggestion: 'Remove or replace with debugLog utility'
      });
    }
  });
  return findings;
}

/**
 * Detect magic numbers (bare numeric literals ≥2 digits, outside comments/strings)
 */
function detectMagicNumbers(lines) {
  const findings = [];
  lines.forEach((line, i) => {
    const stripped = line.replace(/\/\/.*$/, '').replace(/(['"`]).*?\1/g, '""');
    const nums = stripped.match(/\b\d{2,}\b/g) || [];
    if (nums.length > 0) {
      findings.push({
        line: i + 1,
        match: `magic number(s): ${nums.join(', ')}`,
        suggestion: `Extract to named constant: const LIMIT = ${nums[0]};`
      });
    }
  });
  return findings;
}

/**
 * Run all self-heal detectors and emit [SELF-HEAL] messages
 */
function emitSelfHealMessages(filePath) {
  let content;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return;
  }

  const lines = content.split('\n');
  const detectors = [
    { label: 'any type detected', fn: detectAnyType },
    { label: 'function too long', fn: detectLongFunctions },
    { label: 'nesting too deep', fn: detectDeepNesting },
    { label: 'console.log found', fn: detectConsoleLogs },
    { label: 'magic number', fn: detectMagicNumbers },
  ];

  for (const { label, fn } of detectors) {
    const findings = fn(lines).slice(0, 2);
    for (const f of findings) {
      console.log(`[SELF-HEAL] ${label} at line ${f.line} → ${f.suggestion}`);
    }
  }
}

// ─── Failure Escalation Tracking ───

const ESCALATION_THRESHOLD = 3;
const ESCALATION_FILE = path.join(os.homedir(), '.vibe', 'failure-tracker.json');

function loadFailureTracker() {
  try {
    if (existsSync(ESCALATION_FILE)) {
      return JSON.parse(readFileSync(ESCALATION_FILE, 'utf8'));
    }
  } catch { /* ignore */ }
  return {};
}

function saveFailureTracker(tracker) {
  try {
    writeFileSync(ESCALATION_FILE, JSON.stringify(tracker));
  } catch { /* ignore */ }
}

function trackFailure(filePath, issues) {
  const tracker = loadFailureTracker();
  const key = filePath;
  const entry = tracker[key] || { count: 0, issues: [] };
  entry.count += 1;
  entry.issues = issues.slice(0, 3);
  entry.lastSeen = new Date().toISOString();
  tracker[key] = entry;
  saveFailureTracker(tracker);

  if (entry.count >= ESCALATION_THRESHOLD) {
    console.log(`\n🚨 [ESCALATION] ${path.basename(filePath)}: 동일 이슈 ${entry.count}회 반복`);
    console.log(`   이슈: ${entry.issues.join(' | ')}`);
    console.log('   → 사용자 개입 필요 — 자동 수정이 수렴하지 않고 있습니다.');
    console.log('   → 방향을 바꾸거나, 접근 방식을 재검토하세요.');
    // 카운터 리셋 (다음 에스컬레이션까지 다시 3회)
    entry.count = 0;
    saveFailureTracker(tracker);
  }
}

function clearFailure(filePath) {
  const tracker = loadFailureTracker();
  delete tracker[filePath];
  saveFailureTracker(tracker);
}

async function main() {
  // 1. Code quality check (changed files only — never scan entire project)
  try {
    const files = getModifiedFiles();
    if (files.length > 0) {
      const module = await import(`${BASE_URL}convention/index.js`);
      const result = await module.validateCodeQuality({
        targetPath: files[0],
        projectPath: PROJECT_DIR,
      });
      const text = result.content[0].text;
      // Output P1/P2 only — skip P3 (style)
      const critical = text.split('\n').filter(l => /\b(error|critical|P1|P2)\b/i.test(l)).slice(0, 3);
      if (critical.length > 0) {
        console.log('[CODE CHECK]', critical.join(' | '));
        trackFailure(files[0], critical);
      } else {
        clearFailure(files[0]);
      }
      emitSelfHealMessages(files[0]);
    }
  } catch {
    // Silently continue on check failure — never block progress
  }

  // 2. 관찰 자동 캡처
  try {
    const files = getModifiedFiles();
    if (files.length === 0) return;

    const memModule = await import(`${BASE_URL}memory/index.js`);
    const { type, title } = classifyObservation(files);

    await memModule.addObservation({
      type,
      title: `${title}: ${files.map(f => f.split(/[\\/]/).pop()).join(', ')}`,
      filesModified: files,
      projectPath: PROJECT_DIR,
    });
  } catch {
    // 관찰 캡처 실패해도 무시 (non-critical)
  }
}

main();
