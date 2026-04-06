/**
 * UI 비교 — 스크린샷 diff, CSS 수치 비교
 *
 * Figma 원본 스크린샷 vs 렌더링 결과 비교,
 * Figma CSS 수치 vs computed CSS 비교.
 */

import { readFileSync } from 'node:fs';
import type {
  ElementComputedStyle,
  ScreenshotDiff,
  StyleDiff,
  VerificationIssue,
} from './types.js';

/**
 * 두 PNG 파일의 픽셀 단위 비교
 *
 * 정밀한 비교를 위해 pixelmatch 사용 (optional dependency).
 * 없으면 파일 크기 기반 근사 비교로 폴백.
 */
export async function compareScreenshots(
  expectedPath: string,
  actualPath: string,
  diffOutputPath?: string,
): Promise<ScreenshotDiff> {
  try {
    const { default: pixelmatch } = await import('pixelmatch' as string);
    const { PNG } = await import('pngjs' as string);

    const img1 = PNG.sync.read(readFileSync(expectedPath));
    const img2 = PNG.sync.read(readFileSync(actualPath));

    const width = Math.max(img1.width, img2.width);
    const height = Math.max(img1.height, img2.height);

    // 사이즈 맞추기 (작은 쪽을 확장)
    const canvas1 = createCanvas(img1, width, height);
    const canvas2 = createCanvas(img2, width, height);
    const diffData = new Uint8Array(width * height * 4);

    const diffPixels = pixelmatch(
      canvas1, canvas2, diffData, width, height,
      { threshold: 0.1 },
    ) as number;

    const totalPixels = width * height;

    if (diffOutputPath) {
      const diffImg = new PNG({ width, height }) as { data: Buffer };
      diffImg.data = Buffer.from(diffData);
      const { writeFileSync } = await import('node:fs');
      writeFileSync(diffOutputPath, PNG.sync.write(diffImg));
    }

    return {
      diffRatio: diffPixels / totalPixels,
      diffPixels,
      diffImagePath: diffOutputPath,
      totalPixels,
    };
  } catch {
    // pixelmatch/pngjs 미설치 시 파일 크기 기반 근사 비교
    const buf1 = readFileSync(expectedPath);
    const buf2 = readFileSync(actualPath);
    const sizeDiff = Math.abs(buf1.length - buf2.length);
    const maxSize = Math.max(buf1.length, buf2.length);

    return {
      diffRatio: sizeDiff / maxSize,
      diffPixels: -1,
      totalPixels: -1,
    };
  }
}

/** 캔버스 크기 통일 (투명 배경으로 확장) */
function createCanvas(
  img: { width: number; height: number; data: Buffer },
  width: number,
  height: number,
): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const srcIdx = (y * img.width + x) * 4;
      const dstIdx = (y * width + x) * 4;
      data[dstIdx] = img.data[srcIdx];
      data[dstIdx + 1] = img.data[srcIdx + 1];
      data[dstIdx + 2] = img.data[srcIdx + 2];
      data[dstIdx + 3] = img.data[srcIdx + 3];
    }
  }
  return data;
}

/** CSS 수치 비교 — Figma 기대값 vs 실제 렌더링 값 */
export function compareStyles(
  expected: Record<string, string>,
  actual: ElementComputedStyle,
): StyleDiff[] {
  const diffs: StyleDiff[] = [];

  for (const [property, expectedValue] of Object.entries(expected)) {
    const actualValue = actual.styles[property];
    if (!actualValue) continue;

    const normalizedExpected = normalizeCSS(property, expectedValue);
    const normalizedActual = normalizeCSS(property, actualValue);

    if (normalizedExpected !== normalizedActual) {
      const diff: StyleDiff = {
        selector: actual.selector,
        property,
        expected: expectedValue,
        actual: actualValue,
      };

      const expectedNum = parseFloat(expectedValue);
      const actualNum = parseFloat(actualValue);
      if (!isNaN(expectedNum) && !isNaN(actualNum)) {
        diff.delta = Math.abs(expectedNum - actualNum);
      }

      diffs.push(diff);
    }
  }

  return diffs;
}

/** CSS 값 정규화 (비교용) */
function normalizeCSS(property: string, value: string): string {
  let v = value.trim().toLowerCase();

  // rgb → hex 변환
  const rgbMatch = v.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    v = '#' + [r, g, b].map(c => parseInt(c, 10).toString(16).padStart(2, '0')).join('');
  }

  // px 값 반올림
  if (v.endsWith('px')) {
    const num = parseFloat(v);
    if (!isNaN(num)) v = Math.round(num) + 'px';
  }

  // color 속성의 특수 처리
  if (property === 'color' || property.includes('color')) {
    if (v === 'transparent') v = 'rgba(0, 0, 0, 0)';
  }

  return v;
}

/** StyleDiff → VerificationIssue 변환 */
export function diffsToIssues(diffs: StyleDiff[]): VerificationIssue[] {
  return diffs.map(diff => {
    const isPx = diff.delta !== undefined;
    const isLarge = isPx && diff.delta! > 4;

    return {
      severity: isLarge ? 'P1' : 'P2',
      type: 'style-diff' as const,
      target: diff.selector,
      message: `${diff.property}: expected ${diff.expected}, got ${diff.actual}` +
        (diff.delta !== undefined ? ` (delta: ${diff.delta}px)` : ''),
      expected: diff.expected,
      actual: diff.actual,
    };
  });
}
