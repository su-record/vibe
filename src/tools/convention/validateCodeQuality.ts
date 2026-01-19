// Convention management tool - completely independent

import { ToolResult, ToolDefinition } from '../../types/tool.js';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

// Enhanced Software Engineering Metrics
const CODE_QUALITY_METRICS = {
  COMPLEXITY: {
    maxCyclomaticComplexity: 10,
    maxCognitiveComplexity: 15,
    maxFunctionLines: 20,
    maxNestingDepth: 3,
    maxParameters: 5
  },
  COUPLING: {
    maxDependencies: 7,
    maxFanOut: 5,
    preventCircularDeps: true
  },
  COHESION: {
    singleResponsibility: true,
    relatedFunctionsOnly: true
  },
  MAINTAINABILITY: {
    noMagicNumbers: true,
    consistentNaming: true,
    properErrorHandling: true,
    typesSafety: true
  },
  PERFORMANCE: {
    memoizeExpensiveCalc: true,
    lazyLoading: true,
    batchOperations: true
  }
};

export const validateCodeQualityDefinition: ToolDefinition = {
  name: 'validate_code_quality',
  description: 'quality|review code|check quality|validate - Validate code quality',
  inputSchema: {
    type: 'object',
    properties: {
      code: { type: 'string', description: 'Code to validate' },
      type: { type: 'string', description: 'Code type', enum: ['component', 'function', 'hook', 'utility', 'general'] },
      strict: { type: 'boolean', description: 'Apply strict validation rules' },
      metrics: { type: 'string', description: 'Specific metrics to check', enum: ['complexity', 'coupling', 'cohesion', 'maintainability', 'performance', 'all'] }
    },
    required: ['code']
  },
  annotations: {
    title: 'Validate Code Quality',
    audience: ['user', 'assistant'],
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

/**
 * Collect files from directory for analysis
 */
function collectFilesFromPath(targetPath: string, projectPath?: string): string[] {
  const basePath = projectPath ? join(projectPath, targetPath) : targetPath;
  const files: string[] = [];
  const supportedExtensions = ['.ts', '.tsx', '.js', '.jsx'];

  try {
    const stat = statSync(basePath);
    if (stat.isFile()) {
      return [basePath];
    }

    const entries = readdirSync(basePath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }
      const fullPath = join(basePath, entry.name);
      if (entry.isFile() && supportedExtensions.includes(extname(entry.name))) {
        files.push(fullPath);
      } else if (entry.isDirectory()) {
        files.push(...collectFilesFromPath(fullPath));
      }
    }
  } catch {
    // Path doesn't exist or not accessible
  }

  return files.slice(0, 20); // Limit to 20 files for performance
}

/**
 * Validate single file code quality
 */
function validateSingleFile(code: string, validateType: string): { score: number; issues: number; grade: string } {
  let score = 100;
  let issues = 0;

  const lines = code.split('\n');
  const lineCount = lines.length;

  // Line count check
  if (lineCount > CODE_QUALITY_METRICS.COMPLEXITY.maxFunctionLines * 10) {
    score -= 10;
    issues++;
  }

  // Nesting depth check
  let maxNesting = 0;
  let currentNesting = 0;
  for (const line of lines) {
    const braceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    currentNesting += braceCount;
    maxNesting = Math.max(maxNesting, currentNesting);
  }
  if (maxNesting > CODE_QUALITY_METRICS.COMPLEXITY.maxNestingDepth) {
    score -= 10;
    issues++;
  }

  // Cyclomatic complexity
  const complexity = (code.match(/\bif\b|\bfor\b|\bwhile\b|\bcase\b|\b&&\b|\b\|\|\b/g) || []).length + 1;
  if (complexity > CODE_QUALITY_METRICS.COMPLEXITY.maxCyclomaticComplexity) {
    score -= 15;
    issues++;
  }

  // Anti-patterns
  if (code.includes(': any') || code.includes('<any>')) {
    score -= 5;
    issues++;
  }
  if (code.includes('== ') && !code.includes('===')) {
    score -= 3;
    issues++;
  }
  if (code.includes('var ')) {
    score -= 5;
    issues++;
  }

  score = Math.max(0, score);
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

  return { score, issues, grade };
}

/**
 * Validate code quality of files in a directory
 */
async function validateDirectoryQuality(targetPath: string, projectPath?: string): Promise<ToolResult> {
  const files = collectFilesFromPath(targetPath, projectPath);

  if (files.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No supported files found in ${targetPath}`
      }]
    };
  }

  const results: Array<{ file: string; score: number; issues: number; grade: string }> = [];
  let totalScore = 0;
  let totalIssues = 0;

  for (const file of files) {
    try {
      const code = readFileSync(file, 'utf-8');
      const result = validateSingleFile(code, 'general');

      results.push({
        file: file.replace(projectPath || '', '').replace(/^[/\\]/, ''),
        ...result
      });
      totalScore += result.score;
      totalIssues += result.issues;
    } catch {
      // Skip files that can't be read
    }
  }

  if (results.length === 0) {
    return {
      content: [{
        type: 'text',
        text: 'No files could be analyzed'
      }]
    };
  }

  const avgScore = Math.round(totalScore / results.length);
  const avgGrade = avgScore >= 90 ? 'A' : avgScore >= 80 ? 'B' : avgScore >= 70 ? 'C' : avgScore >= 60 ? 'D' : 'F';
  const lowQualityFiles = results.filter(r => r.score < 70);

  return {
    content: [{
      type: 'text',
      text: `Files: ${results.length} | Avg Score: ${avgScore}/100 (${avgGrade}) | Total Issues: ${totalIssues}${lowQualityFiles.length > 0 ? ` | Low quality: ${lowQualityFiles.length} files` : ''}`
    }]
  };
}

export async function validateCodeQuality(args: { code?: string; type?: string; strict?: boolean; metrics?: string; targetPath?: string; projectPath?: string }): Promise<ToolResult> {
  const { code: validateCode, type: validateType = 'general', strict = false, metrics = 'all', targetPath, projectPath } = args || {};

  // If targetPath is provided, analyze directory
  if (targetPath) {
    return validateDirectoryQuality(targetPath, projectPath);
  }

  // Validate input for code analysis
  if (!validateCode || typeof validateCode !== 'string') {
    return {
      content: [{
        type: 'text',
        text: 'Error: No code or targetPath provided. Please provide code to validate or a targetPath for directory analysis.'
      }]
    };
  }

  const qualityIssues = [];
  const qualityScore = { total: 100, deductions: [] as Array<{reason: string, points: number}> };

  // Basic complexity checks
  const lines = validateCode.split('\n');
  const functionLineCount = lines.length;
  
  if (functionLineCount > CODE_QUALITY_METRICS.COMPLEXITY.maxFunctionLines) {
    qualityIssues.push({
      type: 'complexity',
      severity: 'high',
      message: `Function exceeds maximum lines (${functionLineCount}/${CODE_QUALITY_METRICS.COMPLEXITY.maxFunctionLines})`
    });
    qualityScore.deductions.push({ reason: 'Function too long', points: 15 });
  }
  
  // Nesting depth check
  let maxNesting = 0;
  let currentNesting = 0;
  for (const line of lines) {
    const braceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
    currentNesting += braceCount;
    maxNesting = Math.max(maxNesting, currentNesting);
  }
  
  if (maxNesting > CODE_QUALITY_METRICS.COMPLEXITY.maxNestingDepth) {
    qualityIssues.push({
      type: 'complexity',
      severity: 'medium',
      message: `Nesting depth exceeds maximum (${maxNesting}/${CODE_QUALITY_METRICS.COMPLEXITY.maxNestingDepth})`
    });
    qualityScore.deductions.push({ reason: 'Deep nesting', points: 10 });
  }
  
  // Cyclomatic complexity estimation
  const cyclomaticComplexity = (validateCode.match(/\bif\b|\bfor\b|\bwhile\b|\bcase\b|\b&&\b|\b\|\|\b/g) || []).length + 1;
  if (cyclomaticComplexity > CODE_QUALITY_METRICS.COMPLEXITY.maxCyclomaticComplexity) {
    qualityIssues.push({
      type: 'complexity',
      severity: 'high',
      message: `Cyclomatic complexity too high (${cyclomaticComplexity}/${CODE_QUALITY_METRICS.COMPLEXITY.maxCyclomaticComplexity})`
    });
    qualityScore.deductions.push({ reason: 'High cyclomatic complexity', points: 20 });
  }
  
  // Anti-pattern checks
  if (validateCode.includes('any')) {
    qualityIssues.push({
      type: 'type-safety',
      severity: 'medium',
      message: 'Using "any" type - consider more specific types'
    });
    qualityScore.deductions.push({ reason: 'Any type usage', points: 10 });
  }
  
  if (validateCode.includes('== ')) {
    qualityIssues.push({
      type: 'best-practices',
      severity: 'low',
      message: 'Use strict equality (===) instead of loose equality (==)'
    });
    qualityScore.deductions.push({ reason: 'Loose equality', points: 5 });
  }
  
  if (validateCode.includes('var ')) {
    qualityIssues.push({
      type: 'best-practices',
      severity: 'medium',
      message: 'Use const/let instead of var'
    });
    qualityScore.deductions.push({ reason: 'Var usage', points: 8 });
  }
  
  // Magic numbers check
  const magicNumbers = validateCode.match(/\b\d{2,}\b/g) || [];
  if (magicNumbers.length > 0) {
    qualityIssues.push({
      type: 'maintainability',
      severity: 'low',
      message: `Found potential magic numbers: ${magicNumbers.join(', ')}`
    });
    qualityScore.deductions.push({ reason: 'Magic numbers', points: 5 });
  }
  
  // Error handling check
  const hasErrorHandling = validateCode.includes('try') || validateCode.includes('catch') || validateCode.includes('throw');
  if (!hasErrorHandling && validateCode.includes('async')) {
    qualityIssues.push({
      type: 'error-handling',
      severity: 'medium',
      message: 'Async functions should include error handling'
    });
    qualityScore.deductions.push({ reason: 'Missing error handling', points: 10 });
  }
  
  // Performance checks for React components
  if (validateType === 'component' && validateCode.includes('React')) {
    if (!validateCode.includes('memo') && !validateCode.includes('useMemo') && !validateCode.includes('useCallback')) {
      qualityIssues.push({
        type: 'performance',
        severity: 'low',
        message: 'Consider using React.memo, useMemo, or useCallback for performance optimization'
      });
      qualityScore.deductions.push({ reason: 'Missing performance optimization', points: 5 });
    }
  }
  
  const finalScore = Math.max(0, qualityScore.total - qualityScore.deductions.reduce((sum, d) => sum + d.points, 0));
  
  const validationResult = {
    action: 'validate_code_quality',
    type: validateType,
    strict,
    metricsRequested: metrics,
    score: finalScore,
    grade: finalScore >= 90 ? 'A' : finalScore >= 80 ? 'B' : finalScore >= 70 ? 'C' : finalScore >= 60 ? 'D' : 'F',
    issues: qualityIssues,
    deductions: qualityScore.deductions,
    recommendations: qualityIssues.length > 0 ? [
      'Consider breaking down complex functions',
      'Reduce nesting depth with early returns',
      'Use more specific types instead of "any"',
      'Apply consistent coding standards',
      'Add proper error handling',
      'Consider performance optimizations'
    ] : ['Code quality is excellent!'],
    metrics: {
      complexity: cyclomaticComplexity,
      lines: functionLineCount,
      nesting: maxNesting,
      issues: qualityIssues.length
    },
    status: 'success'
  };
  
  const topIssues = qualityIssues.slice(0, 8);
  return {
    content: [{ type: 'text', text: `Type: ${validateType}\nScore: ${finalScore}/100 (Grade: ${validationResult.grade})\nMetrics: Lines=${validationResult.metrics.lines}, Complexity=${validationResult.metrics.complexity}, Nesting=${validationResult.metrics.nesting}\n\nIssues (${qualityIssues.length}):\n${topIssues.map(i => `[${i.severity.toUpperCase()}] ${i.type}: ${i.message}`).join('\n')}${qualityIssues.length > 8 ? `\n... ${qualityIssues.length - 8} more issues` : ''}\n\nDeductions: -${qualityScore.deductions.reduce((sum, d) => sum + d.points, 0)} pts (${qualityScore.deductions.map(d => `${d.reason}: -${d.points}`).join(', ')})` }]
  };
}
