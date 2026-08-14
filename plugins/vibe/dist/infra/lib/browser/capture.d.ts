/**
 * UI 캡처 — 스크린샷, DOM 추출, computed CSS 조회
 *
 * CDP(Chrome DevTools Protocol)를 통해 렌더링된 결과를 정밀하게 추출.
 */
import type { CaptureScreenshotOptions, ElementComputedStyle } from './types.js';
/** 페이지 스크린샷 캡처 */
export declare function captureScreenshot(page: unknown, options: CaptureScreenshotOptions): Promise<string>;
/** 요소의 computed CSS + bounding box 추출 */
export declare function getComputedStyles(page: unknown, selector: string, properties: string[]): Promise<ElementComputedStyle | null>;
/** 페이지의 모든 매칭 요소에서 computed CSS 일괄 추출 */
export declare function getComputedStylesBatch(page: unknown, selector: string, properties: string[]): Promise<ElementComputedStyle[]>;
/** 페이지의 모든 텍스트 콘텐츠 추출 */
export declare function extractTextContent(page: unknown, selector?: string): Promise<Array<{
    selector: string;
    text: string;
}>>;
/** 페이지의 모든 이미지 src + 로드 상태 확인 */
export declare function extractImages(page: unknown): Promise<Array<{
    src: string;
    alt: string;
    loaded: boolean;
    width: number;
    height: number;
}>>;
//# sourceMappingURL=capture.d.ts.map