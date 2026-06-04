/**
 * LLM fetch timeout + abort 결합 helper
 *
 * 직접 provider 호출(GPT/Antigravity chat·embedding)은 network/runtime 이 실패할
 * 때까지 hang 될 수 있다. 이 helper 는 hard timeout 과 외부 AbortSignal(SmartRouter
 * 등 호출자 취소)을 하나의 signal 로 결합한다.
 *
 * 사용:
 *   const { signal, cleanup } = createTimeoutSignal(60_000, options.signal);
 *   try {
 *     const res = await fetch(url, { ...init, signal });
 *     return await res.json(); // 본문 처리까지 timer 유지
 *   } finally {
 *     cleanup();
 *   }
 */

/** chat 류 호출 기본 timeout — embedding(30s)보다 길게, 긴 응답을 허용. */
export const DEFAULT_LLM_TIMEOUT_MS = 60_000;

export interface TimeoutSignal {
  signal: AbortSignal;
  /** timer 해제 + 외부 signal 리스너 제거. 본문 처리까지 끝난 뒤 호출. */
  cleanup: () => void;
  /**
   * hard timeout timer 만 해제(외부 취소 wiring 은 유지).
   * 스트리밍에서 연결 수립 후 total-timeout 을 끄되 caller 취소는 살릴 때 쓴다.
   */
  clearTimer: () => void;
}

/**
 * timeout 과 외부 signal 을 결합한 AbortSignal 을 생성한다.
 * 반환된 cleanup() 은 본문 처리까지 끝난 뒤(보통 finally) 반드시 호출한다.
 */
export function createTimeoutSignal(
  timeoutMs: number = DEFAULT_LLM_TIMEOUT_MS,
  externalSignal?: AbortSignal
): TimeoutSignal {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`LLM request timeout (${timeoutMs}ms)`)),
    timeoutMs
  );

  let onAbort: (() => void) | undefined;
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      onAbort = (): void => controller.abort(externalSignal.reason);
      externalSignal.addEventListener('abort', onAbort, { once: true });
    }
  }

  const clearTimer = (): void => clearTimeout(timer);

  const cleanup = (): void => {
    clearTimeout(timer);
    if (externalSignal && onAbort) {
      externalSignal.removeEventListener('abort', onAbort);
    }
  };

  return { signal: controller.signal, cleanup, clearTimer };
}
