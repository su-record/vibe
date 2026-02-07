/**
 * BaseRoute - Abstract class for all routes
 * Strategy Pattern: each route implements canHandle + execute
 */

import { InterfaceLogger } from '../../interface/types.js';
import { ClassifiedIntent, RouteContext, RouteResult } from '../types.js';

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;
const DEFAULT_TIMEOUT_MS = 120_000;

export abstract class BaseRoute {
  abstract readonly name: string;
  protected logger: InterfaceLogger;
  protected timeoutMs: number;

  constructor(logger: InterfaceLogger, timeoutMs: number = DEFAULT_TIMEOUT_MS) {
    this.logger = logger;
    this.timeoutMs = timeoutMs;
  }

  /** Check if this route can handle the given intent */
  abstract canHandle(intent: ClassifiedIntent): boolean;

  /** Execute the route logic (implemented by subclasses) */
  protected abstract executeInternal(context: RouteContext): Promise<RouteResult>;

  /** Execute with retry and timeout wrapper */
  async execute(context: RouteContext): Promise<RouteResult> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await this.executeWithTimeout(context);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.logger('warn', `${this.name} attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`);

        if (attempt === MAX_RETRIES) {
          return this.createErrorResult(error);
        }

        const delay = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }

    return { success: false, error: 'Max retries exceeded' };
  }

  private async executeWithTimeout(context: RouteContext): Promise<RouteResult> {
    return Promise.race([
      this.executeInternal(context),
      this.createTimeoutPromise(),
    ]);
  }

  private createTimeoutPromise(): Promise<RouteResult> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Route ${this.name} timed out after ${this.timeoutMs}ms`)), this.timeoutMs);
    });
  }

  private createErrorResult(error: Error): RouteResult {
    return {
      success: false,
      error: error.message,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
