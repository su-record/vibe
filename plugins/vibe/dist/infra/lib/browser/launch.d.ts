/**
 * Puppeteer 브라우저 관리
 *
 * headless Chrome 런치, 페이지 관리, 정리.
 * 싱글턴 패턴으로 세션 내 브라우저 재사용.
 */
import type { BrowserLaunchOptions } from './types.js';
/** headless Chrome 브라우저 시작 */
export declare function launchBrowser(options?: BrowserLaunchOptions): Promise<unknown>;
/** 새 페이지 열고 URL 로드 */
export declare function openPage(browser: unknown, url: string, viewport?: {
    width: number;
    height: number;
}): Promise<unknown>;
/** 브라우저 종료 */
export declare function closeBrowser(): Promise<void>;
/** 현재 브라우저 인스턴스 반환 (없으면 null) */
export declare function getBrowser(): unknown;
//# sourceMappingURL=launch.d.ts.map