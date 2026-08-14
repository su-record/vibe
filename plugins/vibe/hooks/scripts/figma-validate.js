#!/usr/bin/env node

/**
 * figma-validate.js — SCSS vs sections.json 대조 검증
 *
 * Usage:
 *   node figma-validate.js <scss-dir> <sections.json> [--section=<name>]
 *
 * 검증 항목:
 *   1. SCSS의 모든 CSS 속성이 sections.json에 근거하는가
 *   2. sections.json의 CSS 속성이 SCSS에 누락되지 않았는가
 *   3. 금지 패턴 감지 (커스텀 함수, aspect-ratio 등)
 *   4. 이미지 파일명 kebab-case 확인
 *
 * 출력: JSON { status, errors[], summary }
 */

import fs from 'fs';
import path from 'path';

// ─── Helpers ────────────────────────────────────────────────────────

function camelToKebab(str) {
  return str.replace(/([A-Z])/g, '-$1').toLowerCase();
}

function parseSCSS(scssContent) {
  // 간이 SCSS 파서: 셀렉터 → CSS 속성 맵 추출
  const blocks = {};
  let currentSelector = null;
  const lines = scssContent.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // 빈 줄, 코멘트 스킵
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;

    // 셀렉터 열기
    const selectorMatch = trimmed.match(/^([.&][a-zA-Z0-9_-][a-zA-Z0-9_-]*(?:__[a-zA-Z0-9_-]+(?:-[a-zA-Z0-9_-]+)*)?)\s*\{/);
    if (selectorMatch) {
      currentSelector = selectorMatch[1];
      if (!blocks[currentSelector]) blocks[currentSelector] = {};
      continue;
    }

    // 블록 닫기
    if (trimmed === '}') {
      currentSelector = null;
      continue;
    }

    // CSS 속성
    if (currentSelector && trimmed.includes(':') && trimmed.endsWith(';')) {
      const colonIdx = trimmed.indexOf(':');
      const prop = trimmed.slice(0, colonIdx).trim();
      const value = trimmed.slice(colonIdx + 1).replace(/;$/, '').trim();
      blocks[currentSelector][prop] = value;
    }
  }

  return blocks;
}

// ─── Forbidden Pattern Detection ────────────────────────────────────

const FORBIDDEN_PATTERNS = [
  { pattern: /@function\s/, id: 'custom-function', msg: '@function 자체 정의 금지' },
  { pattern: /@mixin\s/, id: 'custom-mixin', msg: '@mixin 자체 정의 금지 (기존 @use만 허용)' },
  { pattern: /aspect-ratio\s*:/, id: 'aspect-ratio', msg: 'aspect-ratio는 tree.json에 없는 속성' },
  { pattern: /clamp\s*\(/, id: 'clamp', msg: 'clamp()는 font-size 외 사용 금지' },
  { pattern: /\d+vw/, id: 'vw-unit', msg: 'vw 단위 사용 금지 (스태틱 구현)' },
  { pattern: /@media\s/, id: 'media-query', msg: '@media 금지 (스태틱 구현)' },
  { pattern: /@include\s/, id: 'include', msg: '@include 사용 시 기존 프로젝트 믹스인만 허용' },
];

function detectForbidden(scssContent, filePath) {
  const errors = [];
  const lines = scssContent.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { pattern, id, msg } of FORBIDDEN_PATTERNS) {
      if (pattern.test(line)) {
        // clamp in font-size is allowed
        if (id === 'clamp' && line.includes('font-size')) continue;
        errors.push({
          priority: 'P1',
          file: filePath,
          line: i + 1,
          type: `forbidden-${id}`,
          actual: line.trim(),
          message: msg
        });
      }
    }
  }

  return errors;
}

// ─── CSS Value Comparison ───────────────────────────────────────────

function collectCSSFromTree(node, sectionClass, parentPath, result) {
  const css = node.css || {};
  const children = node.children || [];
  const name = node.name || '';
  const type = node.type || '';

  // BG 프레임 스킵
  const nameLower = name.toLowerCase();
  if (nameLower === 'bg' || nameLower.endsWith('-bg') || nameLower.startsWith('bg-')) return;

  // 클래스명 재현 (figma-to-scss.js와 동일 로직)
  let cls = name
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || null;

  if (!cls) {
    const idx = parentPath ? parentPath.split('-').length : 0;
    if (type === 'TEXT') cls = `text-${idx}`;
    else if (type === 'VECTOR') cls = `vector-${idx}`;
    else if (type === 'RECTANGLE') cls = `rect-${idx}`;
    else cls = `el-${idx}`;
  }

  const currentPath = parentPath ? `${parentPath}-${cls}` : cls;
  const selector = `.${sectionClass}__${currentPath}`;

  // CSS 속성 저장 (kebab 변환)
  if (Object.keys(css).length > 0) {
    const kebabCSS = {};
    for (const [prop, value] of Object.entries(css)) {
      if (prop.startsWith('_')) continue;
      kebabCSS[camelToKebab(prop)] = String(value);
    }
    result[selector] = kebabCSS;
  }

  // 자식 재귀
  const seenClasses = new Set();
  for (const child of children) {
    const childName = child.name || '';
    const childLower = childName.toLowerCase();
    if (childLower === 'bg' || childLower.endsWith('-bg') || childLower.startsWith('bg-')) continue;

    let childCls = childName
      .replace(/[^a-zA-Z0-9\s_-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase()
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || null;
    if (!childCls) childCls = `${child.type?.toLowerCase() || 'el'}-0`;

    if (seenClasses.has(childCls)) continue;
    seenClasses.add(childCls);
    collectCSSFromTree(child, sectionClass, currentPath, result);
  }
}

function compareCSSValues(scssBlocks, treeCSS, filePath) {
  const errors = [];

  // SCSS에 있지만 tree에 없는 속성 (임의 추가)
  for (const [selector, props] of Object.entries(scssBlocks)) {
    if (!selector.startsWith('.')) continue;
    const treeProps = treeCSS[selector];

    for (const [prop, value] of Object.entries(props)) {
      // background-image url, background-size 등은 이미지 처리에서 추가됨
      if (prop === 'background-image' || prop === 'background-size' ||
          prop === 'background-position' || prop === 'background-repeat') continue;
      // imageRef 주석 스킵
      if (prop.startsWith('//')) continue;

      if (!treeProps || !(prop in treeProps)) {
        errors.push({
          priority: 'P2',
          file: filePath,
          type: 'extra-property',
          selector,
          property: prop,
          actual: value,
          message: `SCSS에 있지만 sections.json에 없는 속성: ${prop}: ${value}`
        });
      } else if (treeProps[prop] !== value) {
        errors.push({
          priority: 'P1',
          file: filePath,
          type: 'value-mismatch',
          selector,
          property: prop,
          expected: treeProps[prop],
          actual: value,
          message: `값 불일치: ${prop} expected="${treeProps[prop]}" actual="${value}"`
        });
      }
    }
  }

  // tree에 있지만 SCSS에 없는 속성 (누락)
  for (const [selector, props] of Object.entries(treeCSS)) {
    const scssProps = scssBlocks[selector];
    if (!scssProps) {
      errors.push({
        priority: 'P1',
        file: filePath,
        type: 'missing-selector',
        selector,
        message: `sections.json에 있지만 SCSS에 없는 셀렉터: ${selector}`
      });
      continue;
    }
    for (const [prop] of Object.entries(props)) {
      if (!(prop in scssProps)) {
        errors.push({
          priority: 'P1',
          file: filePath,
          type: 'missing-property',
          selector,
          property: prop,
          expected: props[prop],
          message: `SCSS에 누락된 속성: ${selector} { ${prop}: ${props[prop]} }`
        });
      }
    }
  }

  return errors;
}

// ─── Image Filename Check ───────────────────────────────────────────

function checkImageFilenames(scssContent, filePath) {
  const errors = [];
  const urlRegex = /url\(['"]?([^'")\s]+)['"]?\)/g;
  let match;

  while ((match = urlRegex.exec(scssContent)) !== null) {
    const imgPath = match[1];
    const filename = path.basename(imgPath, path.extname(imgPath));

    // 해시 파일명 감지 (16자 이상 hex)
    if (/^[0-9a-f]{16,}$/.test(filename)) {
      errors.push({
        priority: 'P1',
        file: filePath,
        type: 'hash-filename',
        actual: imgPath,
        message: `해시 파일명 금지: ${imgPath} → kebab-case로 변경 필요`
      });
    }
  }

  return errors;
}

// ─── Main ───────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node figma-validate.js <scss-dir> <sections.json> [--section=<name>]');
    process.exit(1);
  }

  const scssDir = args[0];
  const sectionsFile = args[1];
  let sectionFilter = '';

  for (const arg of args.slice(2)) {
    if (arg.startsWith('--section=')) sectionFilter = arg.slice(10);
  }

  // 입력 읽기
  const data = JSON.parse(fs.readFileSync(sectionsFile, 'utf-8'));
  let sections = data.sections || [];

  if (sectionFilter) {
    sections = sections.filter(s => s.name === sectionFilter);
  }

  const allErrors = [];

  for (const section of sections) {
    const sectionClass = section.name
      .replace(/[^a-zA-Z0-9\s_-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase()
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const scssFile = path.join(scssDir, `_${sectionClass}.scss`);
    if (!fs.existsSync(scssFile)) {
      allErrors.push({
        priority: 'P1',
        type: 'missing-file',
        expected: scssFile,
        message: `SCSS 파일 없음: ${scssFile}`
      });
      continue;
    }

    const scssContent = fs.readFileSync(scssFile, 'utf-8');

    // 1. 금지 패턴 검사
    allErrors.push(...detectForbidden(scssContent, scssFile));

    // 2. 이미지 파일명 검사
    allErrors.push(...checkImageFilenames(scssContent, scssFile));

    // 3. CSS 값 대조
    const scssBlocks = parseSCSS(scssContent);
    const treeCSS = {};

    // 루트 섹션 CSS
    const rootSelector = `.${sectionClass}`;
    if (section.css && Object.keys(section.css).length > 0) {
      treeCSS[rootSelector] = {};
      for (const [prop, value] of Object.entries(section.css)) {
        if (!prop.startsWith('_')) treeCSS[rootSelector][camelToKebab(prop)] = String(value);
      }
    }

    // 자식 CSS 재귀 수집
    for (const child of (section.children || [])) {
      collectCSSFromTree(child, sectionClass, '', treeCSS);
    }

    allErrors.push(...compareCSSValues(scssBlocks, treeCSS, scssFile));
  }

  // 결과 출력
  const p1 = allErrors.filter(e => e.priority === 'P1').length;
  const p2 = allErrors.filter(e => e.priority === 'P2').length;

  const result = {
    status: p1 === 0 ? 'PASS' : 'FAIL',
    errors: allErrors,
    summary: { p1, p2, total: allErrors.length }
  };

  console.log(JSON.stringify(result, null, 2));
  process.exit(p1 > 0 ? 1 : 0);
}

main();
