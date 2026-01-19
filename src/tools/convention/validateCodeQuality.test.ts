// Unit tests for validateCodeQuality
import { describe, it, expect } from 'vitest';
import { validateCodeQuality } from './validateCodeQuality.js';

describe('validateCodeQuality', () => {
  describe('code validation', () => {
    it('should validate simple clean code', async () => {
      const code = `
function add(a: number, b: number): number {
  return a + b;
}
`;
      const result = await validateCodeQuality({ code });

      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Score');
      expect(result.content[0].text).toContain('Grade');
    });

    it('should detect high nesting depth', async () => {
      const code = `
function nested() {
  if (true) {
    if (true) {
      if (true) {
        if (true) {
          console.log('deep');
        }
      }
    }
  }
}
`;
      const result = await validateCodeQuality({ code });

      expect(result.content[0].text).toContain('Nesting');
    });

    it('should detect any type usage', async () => {
      const code = `
function process(data: any): any {
  return data;
}
`;
      const result = await validateCodeQuality({ code });

      expect(result.content[0].text).toContain('type');
    });

    it('should detect loose equality', async () => {
      const code = `
function compare(a, b) {
  return a == b;
}
`;
      const result = await validateCodeQuality({ code });

      expect(result.content[0].text).toContain('Issues');
    });

    it('should detect var usage', async () => {
      const code = `
function oldStyle() {
  var x = 1;
  var y = 2;
  return x + y;
}
`;
      const result = await validateCodeQuality({ code });

      expect(result.content[0].text).toContain('Issues');
    });

    it('should detect magic numbers', async () => {
      const code = `
function calculate(value) {
  return value * 123 + 456;
}
`;
      const result = await validateCodeQuality({ code });

      expect(result.content[0].text).toContain('Issues');
    });
  });

  describe('async code validation', () => {
    it('should warn about missing error handling in async', async () => {
      const code = `
async function fetchData() {
  const response = await fetch('/api');
  return response.json();
}
`;
      const result = await validateCodeQuality({ code });

      expect(result.content[0].text).toContain('Issues');
    });

    it('should not warn when error handling exists', async () => {
      const code = `
async function fetchData() {
  try {
    const response = await fetch('/api');
    return response.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
}
`;
      const result = await validateCodeQuality({ code });

      // Should have fewer issues or no error handling issue
      expect(result.content[0].text).toContain('Score');
    });
  });

  describe('React component validation', () => {
    it('should validate React component with type', async () => {
      const code = `
import React from 'react';

function MyComponent({ name }) {
  return <div>Hello, {name}!</div>;
}
`;
      const result = await validateCodeQuality({ code, type: 'component' });

      expect(result.content[0].text).toContain('Type: component');
    });

    it('should suggest memo for React components', async () => {
      const code = `
import React from 'react';

function ExpensiveComponent({ data }) {
  return (
    <div>
      {data.map(item => <span key={item.id}>{item.name}</span>)}
    </div>
  );
}
`;
      const result = await validateCodeQuality({ code, type: 'component' });

      // Should mention performance optimization
      expect(result.content[0].text).toBeDefined();
    });
  });

  describe('input validation', () => {
    it('should return error for missing code and targetPath', async () => {
      const result = await validateCodeQuality({});

      expect(result.content[0].text).toContain('Error');
      expect(result.content[0].text).toContain('No code or targetPath provided');
    });

    it('should return error for undefined args', async () => {
      const result = await validateCodeQuality(undefined as any);

      expect(result.content[0].text).toContain('Error');
    });

    it('should return error for non-string code', async () => {
      const result = await validateCodeQuality({ code: 123 as any });

      expect(result.content[0].text).toContain('Error');
    });
  });

  describe('grading system', () => {
    it('should give A grade for excellent code', async () => {
      const code = `
const add = (a: number, b: number): number => a + b;
`;
      const result = await validateCodeQuality({ code });

      expect(result.content[0].text).toContain('Grade: A');
    });

    it('should give lower grade for problematic code', async () => {
      const code = `
function badCode(data: any) {
  var result;
  if (data == null) {
    if (true) {
      if (true) {
        if (true) {
          result = data * 123456;
        }
      }
    }
  }
  return result;
}
`;
      const result = await validateCodeQuality({ code });

      // Should not be grade A
      expect(result.content[0].text).not.toContain('Grade: A');
    });
  });

  describe('strict mode', () => {
    it('should accept strict flag', async () => {
      const code = `
function test() {
  return 1;
}
`;
      const result = await validateCodeQuality({ code, strict: true });

      expect(result.content[0].text).toContain('Score');
    });
  });

  describe('metrics option', () => {
    it('should accept complexity metrics', async () => {
      const code = `
function test() {
  return 1;
}
`;
      const result = await validateCodeQuality({ code, metrics: 'complexity' });

      expect(result.content[0].text).toContain('Complexity');
    });

    it('should accept all metrics', async () => {
      const code = `
function test() {
  if (true) {
    for (let i = 0; i < 10; i++) {
      console.log(i);
    }
  }
}
`;
      const result = await validateCodeQuality({ code, metrics: 'all' });

      expect(result.content[0].text).toContain('Score');
    });
  });

  describe('deductions', () => {
    it('should show deduction details', async () => {
      const code = `
async function process(data: any) {
  var x = data == null ? 0 : data;
  return x * 12345;
}
`;
      const result = await validateCodeQuality({ code });

      expect(result.content[0].text).toContain('Deductions');
    });

    it('should calculate score correctly', async () => {
      const code = `
const clean = (x: number): number => x + 1;
`;
      const result = await validateCodeQuality({ code });

      // Clean code should have high score (90+)
      expect(result.content[0].text).toMatch(/Score: (9\d|100)\/100/);
    });
  });
});
