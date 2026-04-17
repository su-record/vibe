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

/**
 * Raw Figma numeric values → browser getComputedStyle reconciliation.
 *
 * This is the "end of pipe" check the post argues for: bypass the
 * CSS-translation black box and diff the original Figma numbers directly
 * against what the browser's CSS engine actually computed. Tolerance
 * defaults to 1px for layout, 0.5px for typography — below that the
 * compare step gets noisy on sub-pixel rounding.
 */
export interface RawComparisonInput {
  selector: string;
  /** raw numeric values from Figma (FigmaRawProps). */
  raw: Record<string, number | number[] | string | undefined>;
  /** getComputedStyle output for the same element. */
  computed: Record<string, string>;
}

export interface RawDiff {
  selector: string;
  property: string;
  expected: string;
  actual: string;
  delta?: number;
  severity: 'P1' | 'P2';
}

const RAW_TO_CSS: Array<{
  raw: string;
  css: string;
  tolerance: number;
  severity: 'P1' | 'P2';
}> = [
  { raw: 'itemSpacing',     css: 'gap',           tolerance: 0.5, severity: 'P1' },
  { raw: 'paddingTop',      css: 'padding-top',   tolerance: 0.5, severity: 'P1' },
  { raw: 'paddingRight',    css: 'padding-right', tolerance: 0.5, severity: 'P1' },
  { raw: 'paddingBottom',   css: 'padding-bottom',tolerance: 0.5, severity: 'P1' },
  { raw: 'paddingLeft',     css: 'padding-left',  tolerance: 0.5, severity: 'P1' },
  { raw: 'cornerRadius',    css: 'border-radius', tolerance: 0.5, severity: 'P2' },
  { raw: 'strokeWeight',    css: 'border-top-width', tolerance: 0.5, severity: 'P1' },
  { raw: 'fontSize',        css: 'font-size',     tolerance: 0.25, severity: 'P1' },
  { raw: 'lineHeightPx',    css: 'line-height',   tolerance: 0.5, severity: 'P1' },
  { raw: 'letterSpacing',   css: 'letter-spacing', tolerance: 0.1, severity: 'P2' },
  { raw: 'fontWeight',      css: 'font-weight',   tolerance: 0,   severity: 'P2' },
];

function parsePx(v: string | undefined): number | null {
  if (!v) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export function compareRaw(input: RawComparisonInput): RawDiff[] {
  const diffs: RawDiff[] = [];
  for (const mapping of RAW_TO_CSS) {
    const rawVal = input.raw[mapping.raw];
    if (rawVal == null || typeof rawVal !== 'number') continue;

    const computedRaw = input.computed[mapping.css];
    const actualNum = parsePx(computedRaw);
    if (actualNum === null) continue;

    const delta = Math.abs(actualNum - rawVal);
    if (delta > mapping.tolerance) {
      diffs.push({
        selector: input.selector,
        property: mapping.css,
        expected: `${rawVal}px (Figma raw: ${mapping.raw})`,
        actual: computedRaw ?? '',
        delta,
        severity: mapping.severity,
      });
    }
  }
  return diffs;
}

/** RawDiff → VerificationIssue. */
export function rawDiffsToIssues(diffs: RawDiff[]): VerificationIssue[] {
  return diffs.map((d) => ({
    severity: d.severity,
    type: 'style-diff' as const,
    target: d.selector,
    message: `${d.property}: Figma=${d.expected}, browser=${d.actual}` +
      (d.delta !== undefined ? ` (Δ ${d.delta.toFixed(2)}px)` : ''),
    expected: d.expected,
    actual: d.actual,
  }));
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
