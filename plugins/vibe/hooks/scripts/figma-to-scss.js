#!/usr/bin/env node

/**
 * figma-to-scss.js — sections.json → SCSS 기계적 생성
 *
 * Usage:
 *   node figma-to-scss.js <sections.json> --out=<dir> [--section=<name>]
 *
 * 입력: sections.json (Phase 3 정제 결과)
 * 출력: 섹션별 SCSS 파일 (px 그대로, vw 변환 없음)
 *
 * 원칙:
 *   ⛔ CSS 값은 sections.json에서 1:1 직접 매핑
 *   ⛔ 자체 함수/믹스인 생성 금지
 *   ⛔ vw 변환, clamp, aspect-ratio 등 추가 속성 금지
 */

import fs from 'fs';
import path from 'path';

// ─── Config ─────────────────────────────────────────────────────────

const CSS_LAYOUT_PROPS = new Set([
  'display', 'flexDirection', 'justifyContent', 'alignItems', 'flexWrap',
  'gap', 'padding', 'width', 'height', 'minWidth', 'minHeight',
  'maxWidth', 'maxHeight', 'position', 'top', 'right', 'bottom', 'left',
  'overflow', 'zIndex', 'flex', 'flexGrow', 'flexShrink', 'flexBasis',
  'alignSelf', 'boxSizing', 'transform'
]);

const CSS_VISUAL_PROPS = new Set([
  'backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition',
  'backgroundRepeat', 'backgroundBlendMode', 'color', 'fontFamily', 'fontSize',
  'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign', 'textTransform',
  'textOverflow', 'whiteSpace', 'borderRadius', 'border', 'borderTop',
  'borderRight', 'borderBottom', 'borderLeft', 'borderStyle', 'outline',
  'boxShadow', 'opacity', 'mixBlendMode', 'filter', 'backdropFilter',
  'marginBottom'
]);

// ─── Helpers ────────────────────────────────────────────────────────

function camelToKebab(str) {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

function nameToClass(name) {
  // 한글/특수문자 제거, 영문+숫자만 유지
  return name
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || null; // 영문이 없으면 null
}

function nodeToClassName(node, index) {
  const name = node.name || '';
  const type = node.type || '';

  // 1. Figma name에서 영문 클래스명 추출
  let cls = nameToClass(name);

  // 2. 영문이 없으면 (한글 TEXT 등) → 타입+인덱스로 대체
  if (!cls) {
    if (type === 'TEXT') cls = `text-${index}`;
    else if (type === 'VECTOR') cls = `vector-${index}`;
    else if (type === 'RECTANGLE') cls = `rect-${index}`;
    else if (type === 'ELLIPSE') cls = `ellipse-${index}`;
    else if (type === 'GROUP') cls = `group-${index}`;
    else cls = `el-${index}`;
  }

  return cls;
}

function isBGFrame(node) {
  const name = (node.name || '').toLowerCase();
  return name === 'bg' || name.endsWith('-bg') || name.startsWith('bg-');
}

function indent(level) {
  return '  '.repeat(level);
}

// ─── CSS Generation ─────────────────────────────────────────────────

function cssValue(prop, value) {
  // 값 그대로 출력 — 변환 없음
  return `${camelToKebab(prop)}: ${value};`;
}

function generateCSSBlock(css, indentLevel) {
  if (!css || Object.keys(css).length === 0) return '';
  const lines = [];
  for (const [prop, value] of Object.entries(css)) {
    if (value === undefined || value === null || value === '') continue;
    // 내부 메타 필드 스킵
    if (prop.startsWith('_')) continue;
    lines.push(`${indent(indentLevel)}${cssValue(prop, value)}`);
  }
  return lines.join('\n');
}

// ─── BG 처리 ────────────────────────────────────────────────────────

function generateBGStyles(sectionClass, images, indentLevel) {
  if (!images?.bg) return '';
  const lines = [];
  lines.push(`${indent(indentLevel)}background-image: url('${images.bg}');`);
  lines.push(`${indent(indentLevel)}background-size: cover;`);
  lines.push(`${indent(indentLevel)}background-position: center top;`);
  lines.push(`${indent(indentLevel)}background-repeat: no-repeat;`);
  return lines.join('\n');
}

// ─── Node → SCSS 재귀 ──────────────────────────────────────────────

/**
 * Flat BEM 방식: .section, .section__parent-child 형태
 * 부모 경로를 포함하여 중복 클래스명 방지.
 * SCSS nesting 없이 모든 클래스를 루트 레벨로 출력.
 */
function collectNodeBlocks(node, sectionClass, isRoot, childIndex, blocks, parentPath) {
  const css = node.css || {};
  const children = node.children || [];

  // 클래스명 결정: 부모 경로 포함으로 유니크하게
  const nodeCls = isRoot ? null : nodeToClassName(node, childIndex || 0);

  // 현재 노드의 경로 (부모-자식 체인)
  let currentPath;
  if (isRoot) {
    currentPath = '';
  } else if (parentPath) {
    currentPath = `${parentPath}-${nodeCls}`;
  } else {
    currentPath = nodeCls;
  }

  const selector = isRoot ? `.${sectionClass}` : `.${sectionClass}__${currentPath}`;

  // BG 프레임 → 스킵 (이미지로 렌더링됨)
  if (!isRoot && isBGFrame(node)) {
    blocks.push({ selector: null, comment: `// BG frame "${node.name}" → background-image on .${sectionClass}` });
    return;
  }

  const hasCSS = Object.keys(css).length > 0;
  const hasImages = node.images?.bg;
  const hasImageRef = node.imageRef && node.imageScaleMode;

  if (hasCSS || hasImages || hasImageRef) {
    const block = { selector, lines: [], nodeId: node.nodeId, name: node.name };

    // BG 이미지
    if (hasImages) {
      block.lines.push(`background-image: url('${node.images.bg}');`);
      block.lines.push(`background-size: cover;`);
      block.lines.push(`background-position: center top;`);
      block.lines.push(`background-repeat: no-repeat;`);
    }

    // CSS 속성
    for (const [prop, value] of Object.entries(css)) {
      if (value === undefined || value === null || value === '') continue;
      if (prop.startsWith('_')) continue;
      block.lines.push(`${camelToKebab(prop)}: ${value};`);
    }

    // imageRef
    if (hasImageRef && !hasImages) {
      const sizeMap = { 'FILL': 'cover', 'FIT': 'contain', 'CROP': 'cover', 'TILE': 'auto' };
      block.lines.push(`// imageRef: ${node.imageRef}`);
      block.lines.push(`background-size: ${sizeMap[node.imageScaleMode] || 'cover'};`);
    }

    blocks.push(block);
  }

  // 자식 재귀 (BG 프레임 제외, 중복 클래스 첫 번째만)
  const seenClasses = new Set();
  let idx = 0;
  for (const child of children) {
    const childCls = nodeToClassName(child, idx);
    if (seenClasses.has(childCls)) { idx++; continue; }
    seenClasses.add(childCls);
    collectNodeBlocks(child, sectionClass, false, idx, blocks, currentPath);
    idx++;
  }
}

// ─── Section → SCSS 파일 ───────────────────────────────────────────

function generateSectionSCSS(section) {
  const sectionClass = nameToClass(section.name);
  const lines = [];

  // 헤더 코멘트
  lines.push(`// ${section.name} — Auto-generated from sections.json`);
  lines.push(`// ⛔ 이 파일의 CSS 값을 수동 수정하지 마세요.`);
  lines.push('');

  // Flat BEM 블록 수집
  const blocks = [];
  collectNodeBlocks(section, sectionClass, true, 0, blocks, '');

  // 블록 → SCSS 텍스트
  for (const block of blocks) {
    if (block.comment) {
      lines.push(block.comment);
      continue;
    }
    if (!block.selector || block.lines.length === 0) continue;
    lines.push(`${block.selector} {`);
    for (const line of block.lines) {
      lines.push(`  ${line}`);
    }
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n') + '\n';
}

// ─── _tokens.scss 생성 ─────────────────────────────────────────────

function generateTokens(meta, sections) {
  const lines = [];
  lines.push(`// Design Tokens — Auto-generated from sections.json`);
  lines.push(`// Feature: ${meta.feature}`);
  lines.push(`// Design Width: ${meta.designWidth}px`);
  lines.push('');
  lines.push(`$design-width: ${meta.designWidth}px;`);
  if (meta.breakpoint) {
    lines.push(`$bp-desktop: ${meta.breakpoint};`);
  }
  lines.push('');

  // 색상 토큰 추출 (모든 섹션에서 사용된 색상)
  const colors = new Map();
  const fonts = new Set();

  function extractTokens(node) {
    const css = node.css || {};
    for (const [prop, value] of Object.entries(css)) {
      if (typeof value !== 'string') continue;
      // 색상 추출
      if (prop === 'backgroundColor' || prop === 'color' || prop === 'border') {
        const hexMatch = value.match(/#[0-9a-fA-F]{3,8}/g);
        if (hexMatch) hexMatch.forEach(c => colors.set(c.toLowerCase(), (colors.get(c.toLowerCase()) || 0) + 1));
        const rgbaMatch = value.match(/rgba?\([^)]+\)/g);
        if (rgbaMatch) rgbaMatch.forEach(c => colors.set(c, (colors.get(c) || 0) + 1));
      }
      // 폰트 추출
      if (prop === 'fontFamily') {
        const font = value.replace(/['"]/g, '').split(',')[0].trim();
        fonts.add(font);
      }
    }
    (node.children || []).forEach(extractTokens);
  }

  sections.forEach(s => extractTokens(s));

  // 폰트 토큰
  if (fonts.size > 0) {
    lines.push('// Fonts');
    let i = 0;
    for (const font of fonts) {
      const varName = `$font-${nameToClass(font) ?? `family-${i}`}`;
      lines.push(`${varName}: '${font}', sans-serif;`);
      i++;
    }
    lines.push('');
  }

  // 자주 사용되는 색상만 토큰화 (2회 이상)
  const frequentColors = [...colors.entries()].filter(([, count]) => count >= 2).sort((a, b) => b[1] - a[1]);
  if (frequentColors.length > 0) {
    lines.push('// Colors (used 2+ times)');
    frequentColors.forEach(([color], i) => {
      lines.push(`$color-${i + 1}: ${color};`);
    });
    lines.push('');
  }

  return lines.join('\n') + '\n';
}

// ─── _base.scss 생성 ────────────────────────────────────────────────

function generateBase(meta) {
  return `// Base — Auto-generated
// ⛔ 이 파일의 CSS 값을 수동 수정하지 마세요.

.${nameToClass(meta.feature)} {
  width: ${meta.designWidth}px;
  margin: 0 auto;
  overflow-x: hidden;
}
`;
}

// ─── index.scss 생성 ────────────────────────────────────────────────

function generateIndex(meta, sections) {
  const lines = [];
  lines.push(`// Index — Auto-generated`);
  lines.push(`@use 'tokens';`);
  lines.push(`@use 'base';`);
  lines.push('');
  for (const s of sections) {
    const name = nameToClass(s.name);
    lines.push(`@use '${name}';`);
  }
  return lines.join('\n') + '\n';
}

// ─── Main ───────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node figma-to-scss.js <sections.json> --out=<dir> [--section=<name>]');
    process.exit(1);
  }

  const inputFile = args[0];
  let outDir = '';
  let sectionFilter = '';

  for (const arg of args.slice(1)) {
    if (arg.startsWith('--out=')) outDir = arg.slice(6);
    if (arg.startsWith('--section=')) sectionFilter = arg.slice(10);
  }

  if (!outDir) {
    console.error('--out=<dir> required');
    process.exit(1);
  }

  // 입력 읽기
  const data = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  const meta = data.meta || {};
  let sections = data.sections || [];

  if (sectionFilter) {
    sections = sections.filter(s => s.name === sectionFilter);
    if (sections.length === 0) {
      console.error(`Section "${sectionFilter}" not found`);
      process.exit(1);
    }
  }

  // 출력 디렉토리 생성
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const results = { files: [], sections: [] };

  // _tokens.scss
  const tokensFile = path.join(outDir, '_tokens.scss');
  fs.writeFileSync(tokensFile, generateTokens(meta, sections));
  results.files.push(tokensFile);

  // _base.scss
  const baseFile = path.join(outDir, '_base.scss');
  fs.writeFileSync(baseFile, generateBase(meta));
  results.files.push(baseFile);

  // 섹션별 SCSS
  for (const section of sections) {
    const name = nameToClass(section.name);
    const scssFile = path.join(outDir, `_${name}.scss`);
    const scss = generateSectionSCSS(section);
    fs.writeFileSync(scssFile, scss);
    results.files.push(scssFile);
    results.sections.push({ name: section.name, file: scssFile, classes: name });
  }

  // index.scss
  const indexFile = path.join(outDir, 'index.scss');
  fs.writeFileSync(indexFile, generateIndex(meta, sections));
  results.files.push(indexFile);

  // 결과 출력
  console.log(JSON.stringify(results, null, 2));
}

main();
