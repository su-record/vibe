#!/usr/bin/env node
/**
 * Figma Guard — vibe.figma 작업 시 스킬 우회 차단
 *
 * 차단 대상:
 *   1. /tmp/{feature}/ 하위에 자체 정제/생성 스크립트(.mjs/.js) 작성
 *      → figma-refine.js / figma-to-scss.js 호출하라고 차단
 *   2. SCSS 파일을 직접 작성 (figma-to-scss.js 호출 흔적 없이)
 *   3. Vue/React <style> 블록에 figma 관련 SCSS 클래스 직접 작성
 *
 * 작동 조건:
 *   - tool: Write 또는 Edit
 *   - file_path가 figma 작업 컨텍스트에 해당
 *
 * Exit codes:
 *   0 — 통과
 *   2 — 차단
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// ─── stdin 읽기 ─────────────────────────────────────────────────────

function readStdinSync() {
  try {
    if (process.stdin.isTTY) return null;
    const fd = fs.openSync('/dev/stdin', 'r');
    const buf = Buffer.alloc(1024 * 1024); // 1MB
    const bytesRead = fs.readSync(fd, buf, 0, buf.length, null);
    fs.closeSync(fd);
    if (bytesRead > 0) {
      return JSON.parse(buf.toString('utf-8', 0, bytesRead));
    }
  } catch { /* fallback */ }
  return null;
}

// ─── 검사 1: /tmp/{feature}/ 자체 작성 스크립트 ─────────────────────

const FORBIDDEN_TMP_SCRIPT_PATTERNS = [
  /\/tmp\/[^/]+\/refine[\w-]*\.(mjs|js)$/i,
  /\/tmp\/[^/]+\/.*sections.*\.(mjs|js)$/i,
  /\/tmp\/[^/]+\/.*to-scss.*\.(mjs|js)$/i,
  /\/tmp\/[^/]+\/.*generate-scss.*\.(mjs|js)$/i,
  /\/tmp\/[^/]+\/analyze-tree\.(mjs|js)$/i,
  /\/tmp\/[^/]+\/analyze-section\.(mjs|js)$/i,
];

function checkForbiddenTmpScript(filePath) {
  if (!filePath) return null;
  for (const pattern of FORBIDDEN_TMP_SCRIPT_PATTERNS) {
    if (pattern.test(filePath)) {
      return {
        block: true,
        reason: `자체 작성 figma 스크립트 금지: ${path.basename(filePath)}`,
        suggestion: 'figma-refine.js / figma-to-scss.js / figma-validate.js 사용. ' +
                    '결과가 마음에 안 들면 ~/.vibe/hooks/scripts/figma-*.js 자체를 수정하세요.'
      };
    }
  }
  return null;
}

// ─── 검사 2: SCSS 직접 작성 ─────────────────────────────────────────

/**
 * Figma 작업 컨텍스트인지 판단:
 *   - 현재 작업 디렉토리 또는 file_path에 figma 관련 흔적이 있어야 함
 *   - /tmp/ 하위에 sections.json이 존재 → 활성 figma 작업으로 판단
 */
function isFigmaContext() {
  try {
    const tmpDirs = fs.readdirSync('/tmp', { withFileTypes: true });
    for (const entry of tmpDirs) {
      if (!entry.isDirectory()) continue;
      const moSections = path.join('/tmp', entry.name, 'mo-main', 'sections.json');
      const pcSections = path.join('/tmp', entry.name, 'pc-main', 'sections.json');
      if (fs.existsSync(moSections) || fs.existsSync(pcSections)) {
        return { active: true, feature: entry.name };
      }
    }
  } catch { /* ignore */ }
  return { active: false };
}

/**
 * SCSS 파일 작성 시도 검사
 */
function checkScssWrite(filePath, content) {
  if (!filePath) return null;
  if (!filePath.endsWith('.scss')) return null;

  // figma 컨텍스트가 아니면 통과
  const ctx = isFigmaContext();
  if (!ctx.active) return null;

  // 자동 생성 표시 코멘트 있으면 통과
  if (typeof content === 'string' && content.includes('Auto-generated from sections.json')) {
    return null;
  }

  // 빈 파일 또는 @import만 있는 경우 통과
  if (typeof content === 'string') {
    const meaningfulLines = content
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('//') && !l.startsWith('/*'));
    const hasOnlyImports = meaningfulLines.every(l =>
      l.startsWith('@import') || l.startsWith('@use') || l.startsWith('@forward')
    );
    if (hasOnlyImports) return null;
  }

  return {
    block: true,
    reason: `SCSS 직접 작성 금지: ${filePath}`,
    suggestion: `figma-to-scss.js로 생성하세요:\n` +
                `  node ~/.vibe/hooks/scripts/figma-to-scss.js \\\n` +
                `    /tmp/${ctx.feature}/{bp}-main/sections.json \\\n` +
                `    --out=$(dirname ${filePath})`
  };
}

// ─── 검사 3: Vue/React <style> 블록에 CSS 값 작성 ───────────────────

function checkVueStyleBlock(filePath, content) {
  if (!filePath) return null;
  if (!/\.(vue|jsx|tsx)$/.test(filePath)) return null;

  const ctx = isFigmaContext();
  if (!ctx.active) return null;

  // 파일 경로에 feature 이름이 있는지 확인
  if (!filePath.includes(ctx.feature)) return null;

  if (typeof content !== 'string') return null;

  // <style ...> ... </style> 블록 추출
  const styleBlocks = content.match(/<style[^>]*>([\s\S]*?)<\/style>/g);
  if (!styleBlocks || styleBlocks.length === 0) return null;

  for (const block of styleBlocks) {
    const inner = block.replace(/<style[^>]*>/, '').replace(/<\/style>/, '');
    const meaningfulLines = inner
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('//') && !l.startsWith('/*'));

    // @import / @use 만 있으면 통과
    const hasOnlyImports = meaningfulLines.every(l =>
      l.startsWith('@import') || l.startsWith('@use') || l.startsWith('@forward')
    );
    if (hasOnlyImports) continue;

    // CSS 값으로 보이는 라인 검출 (px, rem, color, flex 등)
    const hasCssValue = meaningfulLines.some(l =>
      /:\s*[^;]*(?:px|rem|em|%|vh|vw|#[0-9a-fA-F]|rgba?\(|flex|grid|absolute|relative|inherit)/.test(l)
    );
    if (hasCssValue) {
      return {
        block: true,
        reason: `Vue/React <style> 블록에 CSS 직접 작성 금지: ${path.basename(filePath)}`,
        suggestion: `<style> 블록은 @import만 허용:\n` +
                    `  <style lang="scss" scoped>\n` +
                    `  @import '~/assets/scss/${ctx.feature}/index.scss';\n` +
                    `  </style>`
      };
    }
  }

  return null;
}

// ─── 메인 ───────────────────────────────────────────────────────────

const stdinPayload = readStdinSync();
if (!stdinPayload) {
  process.exit(0);
}

const toolName = stdinPayload.tool_name || '';
const toolInput = stdinPayload.tool_input || {};

// Write 또는 Edit만 검사
if (toolName !== 'Write' && toolName !== 'Edit') {
  process.exit(0);
}

const filePath = toolInput.file_path || '';
const content = toolInput.content || toolInput.new_string || '';

// 3단계 검사
const checks = [
  checkForbiddenTmpScript(filePath),
  checkScssWrite(filePath, content),
  checkVueStyleBlock(filePath, content),
];

const violations = checks.filter(c => c !== null);

if (violations.length === 0) {
  process.exit(0);
}

// 차단
const messages = ['🚫 FIGMA GUARD: 스킬 규칙 위반'];
for (const v of violations) {
  messages.push('');
  messages.push(`  ${v.reason}`);
  messages.push(`  💡 ${v.suggestion}`);
}
messages.push('');
messages.push('⛔ vibe.figma 작업 중에는 스크립트 파이프라인을 우회하지 마세요.');
messages.push('   ~/.vibe/hooks/scripts/figma-{refine,to-scss,validate}.js만 사용.');

// PreToolUse hook은 stderr 출력 + exit 2로 차단
console.error(messages.join('\n'));
process.exit(2);
