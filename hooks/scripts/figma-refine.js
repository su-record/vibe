#!/usr/bin/env node

/**
 * figma-refine.js — tree.json → sections.json 정제
 *
 * Usage:
 *   node figma-refine.js <tree.json> --out=<sections.json> --design-width=<px> [--bp=<breakpoint>]
 *
 * 정제 규칙:
 *   1. 1depth 자식을 섹션으로 분할
 *   2. 크기 0px, 장식선 (≤2px), isMask 노드 제거
 *   3. BG 프레임 → images.bg로 분리
 *   4. 벡터 글자 GROUP → images.content로 분리
 *   5. 디자인 텍스트 (multi-fill, gradient, effects) → images.content로 분리
 *   6. 전체 children 재귀 포함 — 잎 노드까지
 */

import fs from 'fs';
import path from 'path';

// ─── Helpers ────────────────────────────────────────────────────────

function nameToKebab(name) {
  return name
    .replace(/[^a-zA-Z0-9\s_-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unnamed';
}

// ─── Node Classification ────────────────────────────────────────────

function isZeroSize(node) {
  const w = node.size?.width || 0;
  const h = node.size?.height || 0;
  return w === 0 && h === 0;
}

function isDecorationLine(node) {
  // VECTOR 장식선: w ≤ 2 or h ≤ 2
  if (node.type !== 'VECTOR') return false;
  const w = node.size?.width || 0;
  const h = node.size?.height || 0;
  return (w <= 2 || h <= 2) && (w > 0 || h > 0);
}

function isBGFrame(node) {
  const name = (node.name || '').toLowerCase();
  return name === 'bg' || name.endsWith('-bg') || name.startsWith('bg-') || name.startsWith('bg ');
}

function isVectorTextGroup(node) {
  // 부모 GROUP/FRAME 아래 VECTOR 3개 이상, 각 <60px
  if (node.type !== 'GROUP' && node.type !== 'FRAME') return false;
  const children = node.children || [];
  const vectors = children.filter(c => c.type === 'VECTOR');
  if (vectors.length < 3) return false;
  return vectors.every(v => {
    const w = v.size?.width || 0;
    const h = v.size?.height || 0;
    return w < 60 && h < 60;
  });
}

function isDesignText(node) {
  if (node.type !== 'TEXT') return false;
  const fills = node.fills || [];
  const css = node.css || {};

  // Multi-fill (2개 이상)
  if (fills.length > 1) return true;

  // Gradient fill
  if (fills.some(f => (f.type || '').includes('GRADIENT'))) return true;

  // Effects (box-shadow from effects indicates design text with effects)
  // Check if has complex visual effects beyond simple color
  if (css.boxShadow || css.filter || css.backdropFilter) return true;

  // outline on text = stroke effect
  if (css.outline) return true;

  return false;
}

// ─── Node Refinement ────────────────────────────────────────────────

function refineNode(node, sectionName, images) {
  // 필터: 제거 대상
  if (isZeroSize(node)) return null;
  if (isDecorationLine(node)) return null;
  if (node.isMask) return null;

  // BG 프레임 → images로 분리
  if (isBGFrame(node)) {
    const bgName = `${nameToKebab(sectionName)}-bg`;
    images.bg = `bg/${bgName}.webp`;
    return null; // children에서 제거
  }

  // 벡터 글자 GROUP → images로 분리
  if (isVectorTextGroup(node)) {
    const contentName = `${nameToKebab(sectionName)}-${nameToKebab(node.name || 'text')}`;
    images.content.push({
      name: contentName,
      path: `content/${contentName}.webp`,
      nodeId: node.nodeId,
      originalName: node.name,
      type: 'vector-text'
    });
    // 렌더링 이미지로 대체: type을 IMAGE_PLACEHOLDER로 마킹
    return {
      nodeId: node.nodeId,
      name: node.name,
      type: 'RENDERED_IMAGE',
      size: node.size,
      css: node.css || {},
      imagePath: `content/${contentName}.webp`,
      children: []
    };
  }

  // 디자인 텍스트 → images로 분리
  if (isDesignText(node)) {
    const contentName = `${nameToKebab(sectionName)}-${nameToKebab(node.name || 'design-text')}`;
    images.content.push({
      name: contentName,
      path: `content/${contentName}.webp`,
      nodeId: node.nodeId,
      originalName: node.name,
      text: node.text,
      type: 'design-text'
    });
    return {
      nodeId: node.nodeId,
      name: node.name,
      type: 'RENDERED_IMAGE',
      size: node.size,
      css: node.css || {},
      imagePath: `content/${contentName}.webp`,
      text: node.text,
      children: []
    };
  }

  // 일반 노드 → 재귀 정제
  const refined = {
    nodeId: node.nodeId,
    name: node.name,
    type: node.type,
    size: node.size,
    css: node.css || {}
  };

  // 메타데이터 보존
  if (node.text) refined.text = node.text;
  if (node.imageRef) refined.imageRef = node.imageRef;
  if (node.imageScaleMode) refined.imageScaleMode = node.imageScaleMode;
  if (node.fills) refined.fills = node.fills;
  if (node.layoutSizingH) refined.layoutSizingH = node.layoutSizingH;
  if (node.layoutSizingV) refined.layoutSizingV = node.layoutSizingV;

  // children 재귀 정제
  refined.children = [];
  for (const child of (node.children || [])) {
    const refinedChild = refineNode(child, sectionName, images);
    if (refinedChild) refined.children.push(refinedChild);
  }

  return refined;
}

// ─── Section Splitting ──────────────────────────────────────────────

function findMainFrame(tree) {
  // 루트가 직접 섹션을 가지고 있으면 그대로 반환
  const children = tree.children || [];

  // 1depth에서 섹션 후보 찾기 (GNB/Footer 제외)
  const sectionCandidates = children.filter(c => {
    const name = (c.name || '').toLowerCase();
    const isNav = name.includes('gnb') || name.includes('footer') || name.includes('nav');
    return !isNav;
  });

  // 1depth 자식이 1개고 FRAME이면 → 래퍼 프레임, 그 안의 children이 진짜 섹션
  if (sectionCandidates.length === 1 && sectionCandidates[0].type === 'FRAME') {
    const inner = sectionCandidates[0];
    const innerChildren = inner.children || [];
    // 내부에 2개 이상 자식이 있으면 래퍼로 판단
    if (innerChildren.length >= 2) {
      return inner;
    }
  }

  return tree;
}

function splitIntoSections(tree, designWidth) {
  const mainFrame = findMainFrame(tree);
  const children = mainFrame.children || [];
  const sections = [];

  for (const child of children) {
    const name = child.name || `Section_${sections.length}`;

    // GNB/Footer 스킵
    const nameLower = name.toLowerCase();
    if (nameLower.includes('gnb') || nameLower.includes('footer')) continue;

    // 래퍼 프레임 (이름이 "Frame NNN" 패턴이고 children이 있으면 풀어서 처리)
    const isWrapper = /^Frame\s+\d+$/.test(name) && (child.children || []).length > 0;
    if (isWrapper) {
      // 래퍼 안의 자식을 섹션으로
      for (const inner of (child.children || [])) {
        const innerName = inner.name || `Section_${sections.length}`;
        const images = { bg: null, content: [] };
        const refined = refineNode(inner, innerName, images);
        if (refined) {
          refined.images = images;
          sections.push(refined);
        }
      }
    } else {
      const images = { bg: null, content: [] };
      const refined = refineNode(child, name, images);
      if (refined) {
        refined.images = images;
        sections.push(refined);
      }
    }
  }

  return sections;
}

// ─── Stats ──────────────────────────────────────────────────────────

function countNodes(node) {
  let count = 1;
  for (const c of (node.children || [])) {
    count += countNodes(c);
  }
  return count;
}

// ─── Main ───────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node figma-refine.js <tree.json> --out=<sections.json> --design-width=<px>');
    process.exit(1);
  }

  const inputFile = args[0];
  let outFile = '';
  let designWidth = 720;
  let breakpoint = '';

  for (const arg of args.slice(1)) {
    if (arg.startsWith('--out=')) outFile = arg.slice(6);
    if (arg.startsWith('--design-width=')) designWidth = parseInt(arg.slice(15));
    if (arg.startsWith('--bp=')) breakpoint = arg.slice(5);
  }

  if (!outFile) {
    console.error('--out=<sections.json> required');
    process.exit(1);
  }

  // 입력 읽기
  const tree = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));

  // 섹션 분할 + 정제
  const sections = splitIntoSections(tree, designWidth);

  // 결과
  const result = {
    meta: {
      feature: nameToKebab(tree.name || 'feature'),
      designWidth,
      ...(breakpoint ? { breakpoint } : {})
    },
    sections
  };

  // 출력
  const outDir = path.dirname(outFile);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));

  // 통계 출력
  const totalNodes = sections.reduce((sum, s) => sum + countNodes(s), 0);
  const totalImages = sections.reduce((sum, s) => {
    const imgs = s.images || {};
    return sum + (imgs.bg ? 1 : 0) + (imgs.content || []).length;
  }, 0);

  const stats = {
    sections: sections.map(s => ({
      name: s.name,
      nodes: countNodes(s),
      bg: s.images?.bg || null,
      contentImages: (s.images?.content || []).length
    })),
    total: { sections: sections.length, nodes: totalNodes, images: totalImages }
  };

  console.log(JSON.stringify(stats, null, 2));
}

main();
