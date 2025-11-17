import { describe, test, expect } from 'vitest';
import { analyzeComplexity, analyzeComplexityDefinition } from '../tools/convention/analyzeComplexity.js';
describe('Code Complexity Analysis', () => {
    describe('analyzeComplexity', () => {
        test('should analyze simple function with low complexity', async () => {
            const simpleCode = `
        function add(a, b) {
          return a + b;
        }
      `;
            const result = await analyzeComplexity({ code: simpleCode, metrics: 'all' });
            const parsed = JSON.parse(result.content[0].text.replace('Complexity Analysis:\n', ''));
            expect(parsed.status).toBe('success');
            expect(parsed.results.cyclomaticComplexity).toBeDefined();
            expect(parsed.results.cognitiveComplexity).toBeDefined();
            expect(parsed.results.halsteadMetrics).toBeDefined();
            expect(parsed.results.cyclomaticComplexity.status).toBe('pass');
        });
        test('should detect high cyclomatic complexity', async () => {
            const complexCode = `
        function complexFunction(x) {
          if (x > 0) {
            if (x < 10) {
              for (let i = 0; i < x; i++) {
                if (i % 2 === 0) {
                  while (i < 5) {
                    if (i === 3) {
                      return i;
                    }
                    i++;
                  }
                }
              }
            }
          }
          return x;
        }
      `;
            const result = await analyzeComplexity({ code: complexCode, metrics: 'all' });
            const parsed = JSON.parse(result.content[0].text.replace('Complexity Analysis:\n', ''));
            expect(parsed.results.cyclomaticComplexity.value).toBeGreaterThan(5);
            expect(parsed.issues.length).toBeGreaterThan(0);
        });
        test('should calculate AST-based complexity', async () => {
            const code = `
        function test() {
          if (true) return 1;
          for (let i = 0; i < 10; i++) {
            console.log(i);
          }
        }
      `;
            const result = await analyzeComplexity({ code, metrics: 'cyclomatic' });
            const parsed = JSON.parse(result.content[0].text.replace('Complexity Analysis:\n', ''));
            expect(parsed.results.astCyclomaticComplexity).toBeDefined();
            expect(parsed.results.astCyclomaticComplexity.value).toBeGreaterThan(1);
        });
        test('should calculate cognitive complexity with nesting', async () => {
            const code = `
        function nested() {
          if (a) {
            if (b) {
              if (c) {
                return true;
              }
            }
          }
        }
      `;
            const result = await analyzeComplexity({ code, metrics: 'cognitive' });
            const parsed = JSON.parse(result.content[0].text.replace('Complexity Analysis:\n', ''));
            expect(parsed.results.cognitiveComplexity.value).toBeGreaterThan(0);
        });
        test('should calculate Halstead metrics', async () => {
            const code = `
        function calculate(x, y) {
          const sum = x + y;
          const product = x * y;
          return sum + product;
        }
      `;
            const result = await analyzeComplexity({ code, metrics: 'halstead' });
            const parsed = JSON.parse(result.content[0].text.replace('Complexity Analysis:\n', ''));
            expect(parsed.results.halsteadMetrics).toBeDefined();
            expect(parsed.results.halsteadMetrics.vocabulary).toBeGreaterThan(0);
            expect(parsed.results.halsteadMetrics.difficulty).toBeGreaterThan(0);
        });
        test('should provide recommendations for complex code', async () => {
            const veryComplexCode = `
        function veryComplex(a, b, c, d, e) {
          if (a) {
            if (b) {
              for (let i = 0; i < 10; i++) {
                if (c) {
                  while (d) {
                    if (e) {
                      return true;
                    }
                  }
                }
              }
            }
          }
          return false;
        }
      `;
            const result = await analyzeComplexity({ code: veryComplexCode, metrics: 'all' });
            const parsed = JSON.parse(result.content[0].text.replace('Complexity Analysis:\n', ''));
            expect(parsed.recommendations).toBeDefined();
            expect(parsed.recommendations.length).toBeGreaterThan(0);
            expect(parsed.overallScore).toBeLessThan(100);
        });
    });
    describe('Tool Definition', () => {
        test('should have correct definition', () => {
            expect(analyzeComplexityDefinition.name).toBe('analyze_complexity');
            expect(analyzeComplexityDefinition.description).toContain('IMPORTANT');
            expect(analyzeComplexityDefinition.inputSchema.required).toContain('code');
        });
        test('should include keyword triggers', () => {
            const desc = analyzeComplexityDefinition.description;
            expect(desc).toContain('복잡도');
            expect(desc).toContain('complexity');
        });
    });
});
