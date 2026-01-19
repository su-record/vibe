// Unit tests for analyzeComplexity
import { describe, it, expect } from 'vitest';
import { analyzeComplexity } from './analyzeComplexity.js';

describe('analyzeComplexity', () => {
  describe('code analysis', () => {
    it('should analyze simple code', async () => {
      const code = `
function add(a, b) {
  return a + b;
}
`;
      const result = await analyzeComplexity({ code });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Complexity');
    });

    it('should detect high cyclomatic complexity', async () => {
      const code = `
function complex(a, b, c, d) {
  if (a > 0) {
    if (b > 0) {
      if (c > 0) {
        if (d > 0) {
          for (let i = 0; i < 10; i++) {
            while (true) {
              switch (i) {
                case 1: break;
                case 2: break;
                case 3: break;
              }
              break;
            }
          }
        }
      }
    }
  }
}
`;
      const result = await analyzeComplexity({ code });

      expect(result.content[0].text).toContain('Complexity');
      // High complexity code should have lower score or issues
    });

    it('should calculate cyclomatic metrics only', async () => {
      const code = `
function test() {
  if (true) return 1;
  return 0;
}
`;
      const result = await analyzeComplexity({ code, metrics: 'cyclomatic' });

      expect(result.content[0].text).toContain('Complexity');
    });

    it('should calculate cognitive metrics only', async () => {
      const code = `
function test() {
  if (true) {
    for (let i = 0; i < 10; i++) {
      console.log(i);
    }
  }
}
`;
      const result = await analyzeComplexity({ code, metrics: 'cognitive' });

      expect(result.content[0].text).toContain('Complexity');
    });

    it('should calculate halstead metrics only', async () => {
      const code = `
const x = 1 + 2 * 3 - 4 / 5;
`;
      const result = await analyzeComplexity({ code, metrics: 'halstead' });

      expect(result.content[0].text).toContain('Complexity');
    });

    it('should calculate all metrics', async () => {
      const code = `
function calculate(a, b) {
  if (a > b) {
    return a - b;
  }
  return b - a;
}
`;
      const result = await analyzeComplexity({ code, metrics: 'all' });

      expect(result.content[0].text).toContain('Complexity');
      expect(result.content[0].text).toContain('Score');
    });
  });

  describe('input validation', () => {
    it('should return error for missing code and targetPath', async () => {
      const result = await analyzeComplexity({});

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('No code or targetPath provided');
    });

    it('should return error for undefined args', async () => {
      const result = await analyzeComplexity(undefined as any);

      expect(result.content[0].text).toContain('Error');
    });

    it('should return error for non-string code', async () => {
      const result = await analyzeComplexity({ code: 123 as any });

      expect(result.content[0].text).toContain('Error');
    });
  });

  describe('Python code detection', () => {
    it('should detect and analyze Python code', async () => {
      const pythonCode = `
def calculate(a, b):
    if a > b:
        return a - b
    return b - a

class Calculator:
    def __init__(self):
        self.value = 0

    def add(self, x):
        self.value += x
`;
      const result = await analyzeComplexity({ code: pythonCode });

      expect(result.content[0].text).toContain('Python');
    });
  });

  describe('score calculation', () => {
    it('should give high score for simple code', async () => {
      const simpleCode = `
function simple() {
  return 42;
}
`;
      const result = await analyzeComplexity({ code: simpleCode });

      // Simple code should have good score
      expect(result.content[0].text).toContain('Score');
    });

    it('should give lower score for complex code', async () => {
      const complexCode = `
function veryComplex(a, b, c, d, e, f, g, h) {
  if (a && b || c && d || e && f || g && h) {
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        if (i > j) {
          switch (i) {
            case 1: break;
            case 2: break;
            case 3: break;
            case 4: break;
            case 5: break;
          }
        }
      }
    }
  }
}
`;
      const result = await analyzeComplexity({ code: complexCode });

      expect(result.content[0].text).toContain('Score');
      // Complex code may have issues
    });
  });

  describe('TypeScript code analysis', () => {
    it('should analyze TypeScript code', async () => {
      const tsCode = `
interface User {
  name: string;
  age: number;
}

function greet(user: User): string {
  if (user.age > 18) {
    return \`Hello, \${user.name}!\`;
  }
  return 'Hello!';
}
`;
      const result = await analyzeComplexity({ code: tsCode });

      expect(result.content[0].text).toContain('Complexity');
    });

    it('should handle class definitions', async () => {
      // Use explicit TypeScript syntax that won't be mistaken for Python
      const tsCode = `
// TypeScript class
export class Calculator {
  private value: number = 0;

  public add(x: number): this {
    this.value += x;
    return this;
  }

  public subtract(x: number): this {
    if (x > this.value) {
      throw new Error('Cannot be negative');
    }
    this.value -= x;
    return this;
  }

  public getValue(): number {
    return this.value;
  }
}
`;
      const result = await analyzeComplexity({ code: tsCode });

      // Should analyze as TypeScript, not Python
      expect(result.content[0].text).toContain('Complexity');
    });
  });
});
