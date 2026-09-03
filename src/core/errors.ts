/**
 * 종료 코드가 판정이다.
 *   0 성공 · 1 판정 실패(검사 불통과·STUCK) · 2 사용 오류 · 3 권한·토큰 오류 · 4 상태 전이 불가
 */
export type ExitCode = 1 | 2 | 3 | 4;

export class VibeError extends Error {
  constructor(message: string, public readonly exitCode: ExitCode) {
    super(message);
    this.name = 'VibeError';
  }
}

export const usage = (message: string): VibeError => new VibeError(message, 2);
export const denied = (message: string): VibeError => new VibeError(message, 3);
export const invalidTransition = (message: string): VibeError => new VibeError(message, 4);
