/**
 * The exit code is the verdict.
 *   0 success · 1 verdict failed (check failed / STUCK) · 2 usage error · 3 token/permission error · 4 invalid transition
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
