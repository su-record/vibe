// Complexity metrics calculation - extracted from analyzeComplexity
import { Project, ScriptKind } from "ts-morph";
const AST_PROJECT = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { allowJs: true, skipLibCheck: true }
});
const COMPLEXITY_NODES = new Set([
    'IfStatement', 'ForStatement', 'ForOfStatement', 'ForInStatement',
    'WhileStatement', 'CaseClause', 'ConditionalExpression',
    'DoStatement', 'CatchClause', 'BinaryExpression'
]);
export const THRESHOLDS = {
    maxCyclomatic: 10,
    maxCognitive: 15,
    maxHalsteadDifficulty: 10
};
/**
 * Calculate AST-based cyclomatic complexity
 */
export function calculateASTCyclomatic(code) {
    try {
        const sourceFile = AST_PROJECT.createSourceFile('temp.ts', code, {
            overwrite: true,
            scriptKind: ScriptKind.TS
        });
        let complexity = 1;
        sourceFile.forEachDescendant((node) => {
            if (COMPLEXITY_NODES.has(node.getKindName())) {
                complexity++;
            }
        });
        return {
            value: complexity,
            threshold: THRESHOLDS.maxCyclomatic,
            status: complexity <= THRESHOLDS.maxCyclomatic ? 'pass' : 'fail',
            description: 'AST-based branch/decision point count'
        };
    }
    catch (error) {
        return {
            value: 0,
            status: 'error',
            description: `AST analysis failed: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}
/**
 * Calculate regex-based cyclomatic complexity (fallback)
 */
export function calculateRegexCyclomatic(code) {
    const patterns = /\bif\b|\bfor\b|\bwhile\b|\bcase\b|\b&&\b|\b\|\|\b/g;
    const matches = code.match(patterns) || [];
    const complexity = matches.length + 1;
    return {
        value: complexity,
        threshold: THRESHOLDS.maxCyclomatic,
        status: complexity <= THRESHOLDS.maxCyclomatic ? 'pass' : 'fail',
        description: 'Number of linearly independent paths'
    };
}
/**
 * Calculate cognitive complexity with nesting awareness
 */
export function calculateCognitiveComplexity(code) {
    const lines = code.split('\n');
    let complexity = 0;
    let nestingLevel = 0;
    for (const line of lines) {
        const trimmed = line.trim();
        // Control structures add complexity based on nesting
        if (/(if|for|while|catch|switch)\s*\(/.test(trimmed)) {
            complexity += 1 + nestingLevel;
        }
        // Track nesting level
        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;
        nestingLevel = Math.max(0, nestingLevel + openBraces - closeBraces);
    }
    return {
        value: complexity,
        threshold: THRESHOLDS.maxCognitive,
        status: complexity <= THRESHOLDS.maxCognitive ? 'pass' : 'fail',
        description: 'Difficulty to understand the code'
    };
}
/**
 * Calculate Halstead complexity metrics
 */
export function calculateHalsteadMetrics(code) {
    const operators = code.match(/[+\-*/=<>!&|%^~?:]/g) || [];
    const operands = code.match(/\b[a-zA-Z_]\w*\b/g) || [];
    const uniqueOperators = new Set(operators).size;
    const uniqueOperands = new Set(operands).size;
    const vocabulary = uniqueOperators + uniqueOperands;
    const length = operators.length + operands.length;
    const calculatedLength = vocabulary > 0
        ? uniqueOperators * Math.log2(uniqueOperators || 1) + uniqueOperands * Math.log2(uniqueOperands || 1)
        : 0;
    const volume = length * Math.log2(vocabulary || 1);
    const difficulty = vocabulary > 0
        ? (uniqueOperators / 2) * (operands.length / (uniqueOperands || 1))
        : 0;
    const effort = difficulty * volume;
    return {
        vocabulary,
        length,
        calculatedLength: Math.round(calculatedLength),
        volume: Math.round(volume),
        difficulty: Math.round(difficulty * 100) / 100,
        effort: Math.round(effort),
        timeToProgram: Math.round(effort / 18),
        bugsDelivered: Math.round(volume / 3000 * 100) / 100,
        description: 'Software science metrics measuring program complexity'
    };
}
/**
 * Calculate additional code metrics
 */
export function calculateAdditionalMetrics(code) {
    const lines = code.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0).length;
    const comments = (code.match(/\/\*[\s\S]*?\*\/|\/\/.*$/gm) || []).length;
    const functions = (code.match(/function\s+\w+|\w+\s*=\s*\(/g) || []).length;
    const classes = (code.match(/class\s+\w+/g) || []).length;
    return {
        linesOfCode: nonEmptyLines,
        comments,
        commentRatio: nonEmptyLines > 0 ? Math.round((comments / nonEmptyLines) * 100) / 100 : 0,
        functions,
        classes,
        averageFunctionLength: functions > 0 ? Math.round(nonEmptyLines / functions) : 0
    };
}
