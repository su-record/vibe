/**
 * UI 캡처 — 스크린샷, DOM 추출, computed CSS 조회
 *
 * CDP(Chrome DevTools Protocol)를 통해 렌더링된 결과를 정밀하게 추출.
 */

import type {
  CaptureScreenshotOptions,
  ElementComputedStyle,
} from './types.js';

/** 페이지 스크린샷 캡처 */
export async function captureScreenshot(
  page: unknown,
  options: CaptureScreenshotOptions,
): Promise<string> {
  const p = page as {
    screenshot: (o: Record<string, unknown>) => Promise<Buffer>;
    $: (s: string) => Promise<unknown>;
  };

  if (options.selector) {
    const element = await p.$(options.selector);
    if (!element) {
      throw new Error(`Element not found: ${options.selector}`);
    }
    const el = element as { screenshot: (o: Record<string, unknown>) => Promise<Buffer> };
    await el.screenshot({
      path: options.outPath,
      type: options.format ?? 'png',
    });
  } else {
    await p.screenshot({
      path: options.outPath,
      fullPage: options.fullPage !== false,
      type: options.format ?? 'png',
    });
  }

  return options.outPath;
}

/** 요소의 computed CSS + bounding box 추출 */
export async function getComputedStyles(
  page: unknown,
  selector: string,
  properties: string[],
): Promise<ElementComputedStyle | null> {
  const p = page as {
    evaluate: <T>(fn: (...args: unknown[]) => T, ...args: unknown[]) => Promise<T>;
  };

  const result = await p.evaluate(
    (...args: unknown[]) => {
      const sel = args[0] as string;
      const props = args[1] as string[];
      const el = document.querySelector(sel);
      if (!el) return null;

      const computed = window.getComputedStyle(el);
      const styles: Record<string, string> = {};
      for (const prop of props) {
        styles[prop] = computed.getPropertyValue(prop);
      }

      const rect = el.getBoundingClientRect();
      return {
        selector: sel,
        styles,
        box: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      };
    },
    selector,
    properties,
  );

  return result as ElementComputedStyle | null;
}

/** 페이지의 모든 매칭 요소에서 computed CSS 일괄 추출 */
export async function getComputedStylesBatch(
  page: unknown,
  selector: string,
  properties: string[],
): Promise<ElementComputedStyle[]> {
  const p = page as {
    evaluate: <T>(fn: (...args: unknown[]) => T, ...args: unknown[]) => Promise<T>;
  };

  const results = await p.evaluate(
    (...args: unknown[]) => {
      const sel = args[0] as string;
      const props = args[1] as string[];
      const elements = document.querySelectorAll(sel);
      return Array.from(elements).map((el, idx) => {
        const computed = window.getComputedStyle(el);
        const styles: Record<string, string> = {};
        for (const prop of props) {
          styles[prop] = computed.getPropertyValue(prop);
        }
        const rect = el.getBoundingClientRect();
        return {
          selector: `${sel}:nth-child(${idx + 1})`,
          styles,
          box: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        };
      });
    },
    selector,
    properties,
  );

  return results as ElementComputedStyle[];
}

/** 페이지의 모든 텍스트 콘텐츠 추출 */
export async function extractTextContent(
  page: unknown,
  selector?: string,
): Promise<Array<{ selector: string; text: string }>> {
  const p = page as {
    evaluate: <T>(fn: (...args: unknown[]) => T, ...args: unknown[]) => Promise<T>;
  };

  const results = await p.evaluate(
    (...args: unknown[]) => {
      const sel = args[0] as string;
      const elements = document.querySelectorAll(sel);
      return Array.from(elements)
        .filter(el => el.textContent?.trim())
        .map((el, idx) => ({
          selector: `${sel}:nth-child(${idx + 1})`,
          text: el.textContent?.trim() ?? '',
        }));
    },
    selector ?? 'h1, h2, h3, h4, h5, h6, p, span, a, button, li, label',
  );

  return results as Array<{ selector: string; text: string }>;
}

/** 페이지의 모든 이미지 src + 로드 상태 확인 */
export async function extractImages(
  page: unknown,
): Promise<Array<{ src: string; alt: string; loaded: boolean; width: number; height: number }>> {
  const p = page as {
    evaluate: <T>(fn: () => T) => Promise<T>;
  };

  const results = await p.evaluate(() => {
    const images = document.querySelectorAll('img');
    return Array.from(images).map(img => ({
      src: img.src,
      alt: img.alt,
      loaded: img.complete && img.naturalWidth > 0,
      width: img.naturalWidth,
      height: img.naturalHeight,
    }));
  });

  return results as Array<{ src: string; alt: string; loaded: boolean; width: number; height: number }>;
}
