/**
 * Code Completion (placeholder)
 *
 * completeCode는 v1internal OAuth 전용이었으므로 제거됨.
 * gemini-cli 직접 호출로 대체 가능.
 */

import type { CompleteCodeOptions, CompleteCodeResponse } from './types.js';

/**
 * 코드 자동완성 (미지원 — OAuth 제거됨)
 */
export async function completeCode(
  _options: CompleteCodeOptions,
): Promise<CompleteCodeResponse> {
  throw new Error(
    'completeCode is no longer supported. Use gemini-cli directly for code completion.'
  );
}
