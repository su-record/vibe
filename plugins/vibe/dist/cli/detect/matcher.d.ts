/**
 * Generic matchers that walk the signature tables to produce detection results.
 * Each function is ≤50 lines and cyclomatic ≤10.
 */
import type { DetectedStack, StackDetails } from '../types.js';
/**
 * Detect all stacks and collect detail signals from a single directory.
 * Returns detected stacks (may be empty).
 */
export declare function detectInDir(dir: string, prefix: string, details: StackDetails): DetectedStack[];
/** Detect hosting providers from the project root. */
export declare function detectHosting(projectRoot: string): string[];
/** Detect CI/CD tools from the project root. */
export declare function detectCicd(projectRoot: string): string[];
//# sourceMappingURL=matcher.d.ts.map