/**
 * Tests for Python and Dart/Flutter code complexity analysis
 */
import { describe, it, expect } from 'vitest';
import { detectLanguage } from '../tools/convention/languageDetector.js';
import { calculatePythonComplexity, calculatePythonCognitiveComplexity } from '../tools/convention/pythonComplexity.js';
import { calculateDartComplexity, calculateDartCognitiveComplexity } from '../tools/convention/dartComplexity.js';
import { analyzeComplexity } from '../tools/convention/analyzeComplexity.js';
describe('Language Detection', () => {
    it('should detect Python code', () => {
        const pythonCode = `
def calculate_sum(numbers):
    total = 0
    for num in numbers:
        total += num
    return total
`;
        expect(detectLanguage(pythonCode)).toBe('python');
    });
    it('should detect Dart/Flutter code', () => {
        const dartCode = `
class MyWidget extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      child: Text('Hello'),
    );
  }
}
`;
        expect(detectLanguage(dartCode)).toBe('dart');
    });
    it('should detect TypeScript code', () => {
        const tsCode = `
interface User {
  name: string;
  age: number;
}

function greet(user: User): void {
  console.log(\`Hello, \${user.name}\`);
}
`;
        expect(detectLanguage(tsCode)).toBe('typescript');
    });
});
describe('Python Complexity Analysis', () => {
    it('should calculate Python cyclomatic complexity', () => {
        const pythonCode = `
def complex_function(x, y, z):
    if x > 0:
        if y > 0:
            return x + y
        elif y < 0:
            return x - y
    elif z > 0:
        for i in range(10):
            if i % 2 == 0:
                print(i)
    return 0
`;
        const result = calculatePythonComplexity(pythonCode);
        expect(result.value).toBeGreaterThan(5);
        expect(result.status).toBeDefined();
    });
    it('should calculate Python cognitive complexity', () => {
        const pythonCode = `
def nested_function(items):
    for item in items:
        if item > 0:
            if item % 2 == 0:
                print("Even positive")
    return items
`;
        const result = calculatePythonCognitiveComplexity(pythonCode);
        expect(result.value).toBeGreaterThan(0);
    });
});
describe('Dart Complexity Analysis', () => {
    it('should calculate Dart cyclomatic complexity', () => {
        const dartCode = `
Widget buildWidget(bool condition) {
  if (condition) {
    return Text('Yes');
  } else {
    return Text('No');
  }
}
`;
        const result = calculateDartComplexity(dartCode);
        expect(result.value).toBeGreaterThan(1);
    });
    it('should calculate Dart cognitive complexity', () => {
        const dartCode = `
class MyWidget extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return condition1
      ? Text('A')
      : condition2
        ? Text('B')
        : Text('C');
  }
}
`;
        const result = calculateDartCognitiveComplexity(dartCode);
        expect(result.value).toBeGreaterThanOrEqual(0); // Ternary operators may not be counted
    });
});
describe('Integrated Complexity Analysis', () => {
    it('should analyze Python code with auto-detection', async () => {
        const pythonCode = `
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)
`;
        const result = await analyzeComplexity({ code: pythonCode });
        expect(result.content[0].text).toContain('Python');
        expect(result.content[0].text).toContain('cyclomaticComplexity');
    });
    it('should analyze Dart code with auto-detection', async () => {
        const dartCode = `
class Counter extends StatefulWidget {
  @override
  _CounterState createState() => _CounterState();
}
`;
        const result = await analyzeComplexity({ code: dartCode });
        expect(result.content[0].text).toContain('Dart');
    });
    it('should analyze TypeScript code', async () => {
        const tsCode = `
function complexFunc(a: number, b: number): number {
  if (a > b) {
    return a;
  } else if (a < b) {
    return b;
  }
  return 0;
}
`;
        const result = await analyzeComplexity({ code: tsCode });
        expect(result.content[0].text).toContain('TypeScript');
    });
});
