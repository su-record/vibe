/**
 * UI 비교 — 스크린샷 diff, CSS 수치 비교
 *
 * Figma 원본 스크린샷 vs 렌더링 결과 비교,
 * Figma CSS 수치 vs computed CSS 비교.
 */
import type { ElementComputedStyle, ScreenshotDiff, StyleDiff, VerificationIssue } from './types.js';
/**
 * 두 PNG 파일의 픽셀 단위 비교
 *
 * 정밀한 비교를 위해 pixelmatch 사용 (optional dependency).
 * 없으면 파일 크기 기반 근사 비교로 폴백.
 */
export declare function compareScreenshots(expectedPath: string, actualPath: string, diffOutputPath?: string): Promise<ScreenshotDiff>;
/** CSS 수치 비교 — Figma 기대값 vs 실제 렌더링 값 */
export declare function compareStyles(expected: Record<string, string>, actual: ElementComputedStyle): StyleDiff[];
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
export declare function compareRaw(input: RawComparisonInput): RawDiff[];
/** RawDiff → VerificationIssue. */
export declare function rawDiffsToIssues(diffs: RawDiff[]): VerificationIssue[];
/** StyleDiff → VerificationIssue 변환 */
export declare function diffsToIssues(diffs: StyleDiff[]): VerificationIssue[];
//# sourceMappingURL=compare.d.ts.map