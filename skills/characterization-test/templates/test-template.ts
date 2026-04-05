/**
 * Characterization test template — lock existing behavior before refactoring.
 *
 * Instructions:
 *   1. Replace {{MODULE_NAME}} with the module under test.
 *   2. Replace {{IMPORT_PATH}} with the relative import path.
 *   3. Replace {{FUNCTION_NAME}} with each public export to characterize.
 *   4. Run once to generate snapshots: npx vitest run --update {{TEST_FILE}}
 *   5. Verify all tests pass BEFORE making any changes to the source.
 *
 * IMPORTANT: Capture ACTUAL behavior, not expected/ideal behavior.
 * If the current code has a bug, capture the buggy output — fix it separately.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
// import { {{FUNCTION_NAME}} } from '{{IMPORT_PATH}}';

describe('{{MODULE_NAME}} — characterization tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Happy path — normal inputs
  // -------------------------------------------------------------------------

  it('should handle typical input', () => {
    // const result = {{FUNCTION_NAME}}({{TYPICAL_INPUT}});
    // expect(result).toMatchSnapshot();
  });

  it('should handle minimum valid input', () => {
    // const result = {{FUNCTION_NAME}}({{MIN_INPUT}});
    // expect(result).toMatchSnapshot();
  });

  it('should handle maximum valid input', () => {
    // const result = {{FUNCTION_NAME}}({{MAX_INPUT}});
    // expect(result).toMatchSnapshot();
  });

  // -------------------------------------------------------------------------
  // Edge cases — boundary values
  // -------------------------------------------------------------------------

  it('should handle empty string input', () => {
    // const result = {{FUNCTION_NAME}}('');
    // expect(result).toMatchSnapshot();
  });

  it('should handle empty array input', () => {
    // const result = {{FUNCTION_NAME}}([]);
    // expect(result).toMatchSnapshot();
  });

  it('should handle zero / false / null-like values', () => {
    // const result = {{FUNCTION_NAME}}(0);
    // expect(result).toMatchSnapshot();
  });

  // -------------------------------------------------------------------------
  // Error paths — failure modes
  // -------------------------------------------------------------------------

  it('should handle null input', () => {
    // expect(() => {{FUNCTION_NAME}}(null)).toThrowErrorMatchingSnapshot();
  });

  it('should handle undefined input', () => {
    // expect(() => {{FUNCTION_NAME}}(undefined)).toThrowErrorMatchingSnapshot();
  });

  it('should handle invalid type input', () => {
    // expect(() => {{FUNCTION_NAME}}({{INVALID_INPUT}})).toThrowErrorMatchingSnapshot();
  });

  // -------------------------------------------------------------------------
  // Side effects — external interactions
  // -------------------------------------------------------------------------

  it('should call external dependency with correct arguments', () => {
    // const spy = vi.spyOn({{DEPENDENCY}}, '{{METHOD}}');
    // {{FUNCTION_NAME}}({{TYPICAL_INPUT}});
    // expect(spy).toHaveBeenCalledWith({{EXPECTED_ARGS}});
    // expect(spy).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // Branching paths — one test per major branch
  // -------------------------------------------------------------------------

  it('should take branch A when condition is true', () => {
    // const result = {{FUNCTION_NAME}}({{BRANCH_A_INPUT}});
    // expect(result).toMatchSnapshot();
  });

  it('should take branch B when condition is false', () => {
    // const result = {{FUNCTION_NAME}}({{BRANCH_B_INPUT}});
    // expect(result).toMatchSnapshot();
  });
});
