/**
 * Browser UI 검증 인프라 타입 정의
 *
 * Puppeteer + CDP 기반 범용 UI 검증 도구.
 * vibe.figma Phase 4, design-audit, design-polish 등에서 공통 사용.
 */

/** 브라우저 런치 옵션 */
export interface BrowserLaunchOptions {
  /** headless 모드 (기본: true) */
  headless?: boolean;
  /** 뷰포트 크기 */
  viewport?: { width: number; height: number };
  /** dev 서버 URL (예: http://localhost:3000) */
  url?: string;
  /** Chrome 실행 경로 (미지정 시 Puppeteer 번들 사용) */
  executablePath?: string;
}

/** 스크린샷 옵션 */
export interface CaptureScreenshotOptions {
  /** 저장 경로 */
  outPath: string;
  /** 특정 CSS selector만 캡처 (미지정 시 전체 페이지) */
  selector?: string;
  /** fullPage 스크롤 캡처 (기본: true) */
  fullPage?: boolean;
  /** 이미지 포맷 (기본: png) */
  format?: 'png' | 'jpeg' | 'webp';
}

/** DOM 요소의 computed CSS */
export interface ElementComputedStyle {
  /** CSS selector */
  selector: string;
  /** computed style key-value */
  styles: Record<string, string>;
  /** bounding box */
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/** CSS 수치 비교 결과 */
export interface StyleDiff {
  selector: string;
  property: string;
  expected: string;
  actual: string;
  /** px 차이 (숫자 비교 가능한 속성만) */
  delta?: number;
}

/** 스크린샷 비교 결과 */
export interface ScreenshotDiff {
  /** 차이 비율 (0.0 ~ 1.0) */
  diffRatio: number;
  /** 차이 픽셀 수 */
  diffPixels: number;
  /** diff 이미지 저장 경로 */
  diffImagePath?: string;
  /** 전체 픽셀 수 */
  totalPixels: number;
}

/** UI 검증 결과 항목 */
export interface VerificationIssue {
  /** P1=필수, P2=권장 */
  severity: 'P1' | 'P2';
  /** 이슈 유형 */
  type: 'missing-image' | 'layout-mismatch' | 'style-diff' | 'text-mismatch' | 'a11y';
  /** 대상 selector 또는 영역 */
  target: string;
  /** 이슈 설명 */
  message: string;
  /** 기대값 */
  expected?: string;
  /** 실제값 */
  actual?: string;
}

/** UI 검증 리포트 */
export interface VerificationReport {
  /** 검증 대상 URL */
  url: string;
  /** 뷰포트 */
  viewport: { width: number; height: number };
  /** 총 이슈 수 */
  totalIssues: number;
  /** P1 이슈 수 */
  p1Count: number;
  /** P2 이슈 수 */
  p2Count: number;
  /** 이슈 목록 */
  issues: VerificationIssue[];
  /** 스크린샷 diff (있으면) */
  screenshotDiff?: ScreenshotDiff;
  /** 타임스탬프 */
  timestamp: string;
}
