export { launchBrowser, openPage, closeBrowser, getBrowser } from './launch.js';
export { captureScreenshot, getComputedStyles, getComputedStylesBatch, extractTextContent, extractImages } from './capture.js';
export { compareScreenshots, compareStyles, compareRaw, diffsToIssues, rawDiffsToIssues } from './compare.js';
export type { RawComparisonInput, RawDiff } from './compare.js';
export type {
  BrowserLaunchOptions,
  CaptureScreenshotOptions,
  ElementComputedStyle,
  StyleDiff,
  ScreenshotDiff,
  VerificationIssue,
  VerificationReport,
} from './types.js';
