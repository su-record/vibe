/**
 * Dart/Flutter-specific complexity analysis
 */
import { THRESHOLDS } from './complexityMetrics.js';
/**
 * Calculate cyclomatic complexity for Dart code
 */
export function calculateDartComplexity(code) {
    // Dart control flow keywords
    const patterns = [
        /\bif\b/g, // if statements
        /\belse\s+if\b/g, // else if
        /\bfor\b/g, // for loops
        /\bwhile\b/g, // while loops
        /\bdo\b/g, // do-while
        /\bswitch\b/g, // switch statements
        /\bcase\b/g, // case clauses
        /\btry\b/g, // try blocks
        /\bcatch\b/g, // catch blocks
        /&&/g, // logical and
        /\|\|/g, // logical or
        /\?\?/g // null-coalescing
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
        description: 'Dart cyclomatic complexity (control flow branches)'
    };
}
/**
 * Calculate cognitive complexity for Dart
 */
export function calculateDartCognitiveComplexity(code) {
    let complexity = 0;
    // Nested control structures
    let nestingLevel = 0;
    const lines = code.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        // Track nesting level
        const openBraces = (line.match(/{/g) || []).length;
        const closeBraces = (line.match(/}/g) || []).length;
        // Control flow keywords
        if (/\b(if|else|for|while|switch|try|catch)\b/.test(trimmed)) {
            complexity += 1 + nestingLevel;
        }
        // Ternary operators
        const ternaryCount = (trimmed.match(/\?.*:/g) || []).length;
        complexity += ternaryCount;
        // Null-aware operators (Flutter specific)
        const nullAwareCount = (trimmed.match(/\?\?|!\.|\/\?/g) || []).length;
        complexity += nullAwareCount * 0.5; // Half weight
        // Update nesting
        nestingLevel += openBraces - closeBraces;
        if (nestingLevel < 0)
            nestingLevel = 0;
    }
    return {
        value: Math.round(complexity),
        threshold: THRESHOLDS.maxCognitive,
        status: complexity <= THRESHOLDS.maxCognitive ? 'pass' : 'fail',
        description: 'Dart cognitive complexity (mental load to understand)'
    };
}
/**
 * Analyze Flutter/Dart code quality
 */
export function analyzeDartQuality(code) {
    const issues = [];
    const recommendations = [];
    // Flutter-specific anti-patterns
    if (/setState\(\(\)\s*{\s*[\s\S]*?}\s*\)/.test(code)) {
        const setStateCount = (code.match(/setState/g) || []).length;
        if (setStateCount > 5) {
            issues.push('Too many setState calls - consider state management solution');
            recommendations.push('Use Provider, Riverpod, or Bloc for complex state');
        }
    }
    // Deep widget nesting
    const widgetNesting = (code.match(/child:\s*\w+\(/g) || []).length;
    if (widgetNesting > 5) {
        issues.push('Deep widget nesting detected');
        recommendations.push('Extract nested widgets into separate methods or classes');
    }
    // Missing const constructors
    const widgetConstructors = (code.match(/\w+\(/g) || []).length;
    const constConstructors = (code.match(/const\s+\w+\(/g) || []).length;
    if (widgetConstructors > 10 && constConstructors < widgetConstructors * 0.3) {
        issues.push('Many widgets without const constructors');
        recommendations.push('Use const constructors for immutable widgets to improve performance');
    }
    // Missing key in lists
    if (/ListView\.builder|GridView\.builder/.test(code) && !/key:/.test(code)) {
        issues.push('ListView/GridView without keys');
        recommendations.push('Add keys to list items for better performance');
    }
    // Missing null safety
    if (!/\w+\?|\w+!/.test(code) && code.includes('null')) {
        issues.push('Possible null safety issues');
        recommendations.push('Enable null safety and use ? and ! operators appropriately');
    }
    // Large build methods
    const buildMethodMatch = code.match(/Widget build\(BuildContext context\)\s*{([\s\S]*?)^  }/m);
    if (buildMethodMatch && buildMethodMatch[1].split('\n').length > 50) {
        issues.push('Build method is too large (> 50 lines)');
        recommendations.push('Extract widgets into separate methods or classes');
    }
    return { issues, recommendations };
}
