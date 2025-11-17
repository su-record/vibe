/**
 * Python-specific complexity analysis
 */
import { THRESHOLDS } from './complexityMetrics.js';
/**
 * Calculate cyclomatic complexity for Python code
 */
export function calculatePythonComplexity(code) {
    // Python control flow keywords
    const patterns = [
        /\bif\b/g, // if statements
        /\belif\b/g, // elif statements
        /\bfor\b/g, // for loops
        /\bwhile\b/g, // while loops
        /\btry\b/g, // try blocks
        /\bexcept\b/g, // except blocks
        /\band\b/g, // logical and
        /\bor\b/g, // logical or
        /\bwith\b/g, // with statements
        /\blambda\b/g // lambda expressions
    ];
    let complexity = 1; // Base complexity
    for (const pattern of patterns) {
        const matches = code.match(pattern);
        if (matches) {
            complexity += matches.length;
        }
    }
    return {
        value: complexity,
        threshold: THRESHOLDS.maxCyclomatic,
        status: complexity <= THRESHOLDS.maxCyclomatic ? 'pass' : 'fail',
        description: 'Python cyclomatic complexity (control flow branches)'
    };
}
/**
 * Calculate cognitive complexity for Python
 */
export function calculatePythonCognitiveComplexity(code) {
    let complexity = 0;
    let nestingLevel = 0;
    const lines = code.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        // Detect indentation level (Python uses indentation for nesting)
        const indent = line.match(/^(\s*)/)?.[1].length || 0;
        const currentNesting = Math.floor(indent / 4); // Assuming 4-space indents
        // Control flow that increases cognitive load
        if (/\b(if|elif|for|while|try|except|with)\b/.test(trimmed)) {
            complexity += 1 + currentNesting;
        }
        // Logical operators increase complexity
        const logicalOps = trimmed.match(/\b(and|or)\b/g);
        if (logicalOps) {
            complexity += logicalOps.length;
        }
        // List comprehensions add cognitive load
        if (/\[.*for.*in.*\]/.test(trimmed)) {
            complexity += 1;
        }
        // Nested functions
        if (/^\s+def\s+/.test(line)) {
            complexity += currentNesting;
        }
    }
    return {
        value: complexity,
        threshold: THRESHOLDS.maxCognitive,
        status: complexity <= THRESHOLDS.maxCognitive ? 'pass' : 'fail',
        description: 'Python cognitive complexity (mental load to understand)'
    };
}
/**
 * Analyze Python code quality
 */
export function analyzePythonQuality(code) {
    const issues = [];
    const recommendations = [];
    // Check for common Python anti-patterns
    if (code.includes('eval(') || code.includes('exec(')) {
        issues.push('Use of eval() or exec() detected - security risk');
        recommendations.push('Avoid eval() and exec(), use safer alternatives');
    }
    if (/except:\s*$/.test(code)) {
        issues.push('Bare except clause detected');
        recommendations.push('Specify exception types: except ValueError:');
    }
    if (/import \*/.test(code)) {
        issues.push('Wildcard import detected');
        recommendations.push('Import specific names instead of using wildcard');
    }
    // Check for long functions
    const functionMatches = code.match(/def\s+\w+\([^)]*\):/g) || [];
    if (functionMatches.length > 0) {
        const avgFunctionLength = code.split('\n').length / functionMatches.length;
        if (avgFunctionLength > 50) {
            issues.push('Functions are too long (avg > 50 lines)');
            recommendations.push('Break down large functions into smaller ones');
        }
    }
    // Check for PEP 8 violations (basic)
    const lines = code.split('\n');
    const longLines = lines.filter(line => line.length > 79);
    if (longLines.length > lines.length * 0.2) {
        issues.push('Many lines exceed 79 characters (PEP 8)');
        recommendations.push('Keep lines under 79 characters for better readability');
    }
    return { issues, recommendations };
}
