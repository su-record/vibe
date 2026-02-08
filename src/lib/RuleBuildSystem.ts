/**
 * Rule Build System - Compile individual rule files into consolidated AGENTS.md
 * Inspired by agent-skills architecture
 */

import { readFile, writeFile, readdir } from 'fs/promises';
import { join, basename } from 'path';

// Impact levels ordered by severity
export type ImpactLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM-HIGH' | 'MEDIUM' | 'LOW-MEDIUM' | 'LOW';

export const IMPACT_ORDER: Record<ImpactLevel, number> = {
  'CRITICAL': 0,
  'HIGH': 1,
  'MEDIUM-HIGH': 2,
  'MEDIUM': 3,
  'LOW-MEDIUM': 4,
  'LOW': 5
};

export interface CodeExample {
  label: string;           // e.g., "Incorrect", "Correct"
  description?: string;    // Optional description
  code: string;
  language?: string;       // Default: 'typescript'
  additionalText?: string; // Text after code block
}

export interface Rule {
  id: string;              // e.g., "1.1", "2.3"
  title: string;
  section: number;
  subsection?: number;
  impact: ImpactLevel;
  impactDescription?: string;  // e.g., "2-10x improvement"
  explanation: string;
  examples: CodeExample[];
  references?: string[];
  tags?: string[];
}

export interface Section {
  number: number;
  title: string;
  impact: ImpactLevel;
  impactDescription?: string;
  introduction?: string;
  rules: Rule[];
}

export interface RulesDocument {
  version: string;
  title: string;
  organization?: string;
  date: string;
  abstract: string;
  sections: Section[];
  references?: string[];
}

export interface RuleFile {
  section: number;
  subsection?: number;
  rule: Rule;
}

export interface TestCase {
  ruleId: string;
  ruleTitle: string;
  type: 'bad' | 'good';
  code: string;
  language: string;
  description?: string;
}

export interface RulePressureTestConfig {
  minExamples: number;
  requireBothTypes: boolean;
  requireRationalization: boolean;
  minCodeLength: number;
}

export interface RuleTDDScores {
  hasExamples: boolean;
  hasBothTypes: boolean;
  hasRationalization: boolean;
  hasEdgeCases: boolean;
  exampleQuality: number;
  coverageScore: number;
}

export interface RuleTDDResult {
  ruleId: string;
  ruleTitle: string;
  scores: RuleTDDScores;
  issues: string[];
  passed: boolean;
}

export interface RulePressureTestSummary {
  total: number;
  passed: number;
  failed: number;
  results: RuleTDDResult[];
}

/**
 * Parse YAML frontmatter from markdown file
 */
function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
  const frontmatter: Record<string, string> = {};
  let body = content;

  if (content.startsWith('---')) {
    const endIndex = content.indexOf('---', 3);
    if (endIndex !== -1) {
      const frontmatterText = content.slice(3, endIndex).trim();
      frontmatterText.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          const key = line.slice(0, colonIndex).trim();
          const value = line.slice(colonIndex + 1).trim().replace(/^["']|["']$/g, '');
          frontmatter[key] = value;
        }
      });
      body = content.slice(endIndex + 3).trim();
    }
  }

  return { frontmatter, body };
}

/**
 * Parse a rule markdown file
 */
export async function parseRuleFile(filePath: string): Promise<RuleFile> {
  const rawContent = await readFile(filePath, 'utf-8');
  const content = rawContent.replace(/\r\n/g, '\n'); // Normalize line endings

  const { frontmatter, body } = parseFrontmatter(content);
  const lines = body.split('\n');

  // Extract title (first ## heading)
  let title = '';
  let titleLine = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('##')) {
      title = lines[i].replace(/^##+\s*/, '').trim();
      titleLine = i;
      break;
    }
  }

  let impact: ImpactLevel = 'MEDIUM';
  let impactDescription = '';
  let explanation = '';
  const examples: CodeExample[] = [];
  const references: string[] = [];

  let currentExample: CodeExample | null = null;
  let inCodeBlock = false;
  let codeBlockLanguage = 'typescript';
  let codeBlockContent: string[] = [];
  let afterCodeBlock = false;
  let additionalText: string[] = [];

  for (let i = titleLine + 1; i < lines.length; i++) {
    const line = lines[i];

    // Impact line
    if (line.includes('**Impact:')) {
      const match = line.match(/\*\*Impact:\s*(\w+(?:-\w+)?)\s*(?:\(([^)]+)\))?/i);
      if (match) {
        impact = match[1].toUpperCase() as ImpactLevel;
        impactDescription = match[2] || '';
      }
      continue;
    }

    // Code block handling
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        if (currentExample) {
          currentExample.code = codeBlockContent.join('\n');
          currentExample.language = codeBlockLanguage;
        }
        codeBlockContent = [];
        inCodeBlock = false;
        afterCodeBlock = true;
      } else {
        inCodeBlock = true;
        codeBlockLanguage = line.slice(3).trim() || 'typescript';
        codeBlockContent = [];
        afterCodeBlock = false;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Example label detection
    const labelMatch = line.match(/^\*\*([^:]+?):\*?\*?$/);
    if (labelMatch) {
      if (currentExample) {
        if (additionalText.length > 0) {
          currentExample.additionalText = additionalText.join('\n\n');
          additionalText = [];
        }
        examples.push(currentExample);
      }
      afterCodeBlock = false;

      const fullLabel = labelMatch[1].trim();
      const descMatch = fullLabel.match(/^([A-Za-z]+(?:\s+[A-Za-z]+)*)\s*\(([^()]+)\)$/);
      currentExample = {
        label: descMatch ? descMatch[1].trim() : fullLabel,
        description: descMatch ? descMatch[2].trim() : undefined,
        code: '',
        language: codeBlockLanguage,
      };
      continue;
    }

    // Reference links
    if (line.startsWith('Reference:') || line.startsWith('References:')) {
      if (currentExample) {
        if (additionalText.length > 0) {
          currentExample.additionalText = additionalText.join('\n\n');
          additionalText = [];
        }
        examples.push(currentExample);
        currentExample = null;
      }

      const refMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/g);
      if (refMatch) {
        refMatch.forEach(ref => {
          const m = ref.match(/\[([^\]]+)\]\(([^)]+)\)/);
          if (m) references.push(m[2]);
        });
      }
      continue;
    }

    // Regular text
    if (line.trim() && !line.startsWith('#')) {
      if (!currentExample && !inCodeBlock) {
        explanation += (explanation ? '\n\n' : '') + line;
      } else if (currentExample && afterCodeBlock) {
        additionalText.push(line);
      }
    }
  }

  // Handle last example
  if (currentExample) {
    if (additionalText.length > 0) {
      currentExample.additionalText = additionalText.join('\n\n');
    }
    examples.push(currentExample);
  }

  // Section mapping from filename prefix
  const filename = basename(filePath);
  const sectionMap: Record<string, number> = {
    security: 1,
    performance: 2,
    architecture: 3,
    complexity: 4,
    testing: 5,
    typescript: 6,
    react: 7,
    advanced: 8,
  };

  const area = filename.split('-')[0];
  const section = frontmatter.section ? parseInt(frontmatter.section) : (sectionMap[area] || 0);

  const rule: Rule = {
    id: '',
    title: frontmatter.title || title,
    section,
    impact: (frontmatter.impact as ImpactLevel) || impact,
    impactDescription: frontmatter.impactDescription || impactDescription,
    explanation: explanation.trim(),
    examples,
    references: frontmatter.references
      ? frontmatter.references.split(',').map(r => r.trim())
      : references,
    tags: frontmatter.tags
      ? frontmatter.tags.split(',').map(t => t.trim())
      : undefined,
  };

  return { section, rule };
}

/**
 * Generate markdown from sections
 */
export function generateMarkdown(
  sections: Section[],
  metadata: {
    version: string;
    title: string;
    organization?: string;
    date: string;
    abstract: string;
    references?: string[];
  }
): string {
  let md = `# ${metadata.title}\n\n`;
  md += `**Version ${metadata.version}**\n`;
  if (metadata.organization) {
    md += `${metadata.organization}\n`;
  }
  md += `${metadata.date}\n\n`;
  md += `> **Note:**\n`;
  md += `> This document is for AI agents and LLMs to follow when maintaining,\n`;
  md += `> generating, or refactoring code. Optimized for automation.\n\n`;
  md += `---\n\n`;
  md += `## Abstract\n\n`;
  md += `${metadata.abstract}\n\n`;
  md += `---\n\n`;
  md += `## Table of Contents\n\n`;

  // Generate TOC
  sections.forEach(section => {
    const anchor = `${section.number}-${section.title.toLowerCase().replace(/\s+/g, '-')}`;
    md += `${section.number}. [${section.title}](#${anchor}) — **${section.impact}**\n`;
    section.rules.forEach(rule => {
      const ruleAnchor = `${rule.id}-${rule.title}`.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      md += `   - ${rule.id} [${rule.title}](#${ruleAnchor})\n`;
    });
  });

  md += `\n---\n\n`;

  // Generate sections
  sections.forEach(section => {
    md += `## ${section.number}. ${section.title}\n\n`;
    md += `**Impact: ${section.impact}${section.impactDescription ? ` (${section.impactDescription})` : ''}**\n\n`;
    if (section.introduction) {
      md += `${section.introduction}\n\n`;
    }

    section.rules.forEach(rule => {
      md += `### ${rule.id} ${rule.title}\n\n`;
      md += `**Impact: ${rule.impact}${rule.impactDescription ? ` (${rule.impactDescription})` : ''}**\n\n`;
      md += `${rule.explanation}\n\n`;

      rule.examples.forEach(example => {
        if (example.description) {
          md += `**${example.label}: ${example.description}**\n\n`;
        } else {
          md += `**${example.label}:**\n\n`;
        }
        if (example.code && example.code.trim()) {
          md += `\`\`\`${example.language || 'typescript'}\n`;
          md += `${example.code}\n`;
          md += `\`\`\`\n\n`;
        }
        if (example.additionalText) {
          md += `${example.additionalText}\n\n`;
        }
      });

      if (rule.references && rule.references.length > 0) {
        md += `Reference: ${rule.references.map(ref => `[${ref}](${ref})`).join(', ')}\n\n`;
      }
    });

    md += `---\n\n`;
  });

  // Add references section
  if (metadata.references && metadata.references.length > 0) {
    md += `## References\n\n`;
    metadata.references.forEach((ref, i) => {
      md += `${i + 1}. [${ref}](${ref})\n`;
    });
  }

  return md;
}

/**
 * Build AGENTS.md from individual rule files
 */
export async function buildRulesDocument(
  rulesDir: string,
  outputFile: string,
  metadata: {
    version: string;
    title: string;
    organization?: string;
    date?: string;
    abstract: string;
    references?: string[];
    sectionMeta?: Record<number, { title: string; impact: ImpactLevel; introduction?: string }>;
  }
): Promise<{ sections: number; rules: number }> {
  const files = await readdir(rulesDir);
  const ruleFiles = files.filter(f =>
    f.endsWith('.md') && !f.startsWith('_') && f !== 'README.md'
  ).sort();

  const ruleData: RuleFile[] = [];
  for (const file of ruleFiles) {
    const filePath = join(rulesDir, file);
    try {
      const parsed = await parseRuleFile(filePath);
      ruleData.push(parsed);
    } catch (error) {
      console.error(`Error parsing ${file}:`, error);
    }
  }

  // Group by section
  const sectionsMap = new Map<number, Section>();
  ruleData.forEach(({ section, rule }) => {
    if (!sectionsMap.has(section)) {
      const sectionMeta = metadata.sectionMeta?.[section];
      sectionsMap.set(section, {
        number: section,
        title: sectionMeta?.title || `Section ${section}`,
        impact: sectionMeta?.impact || rule.impact,
        introduction: sectionMeta?.introduction,
        rules: [],
      });
    }
    sectionsMap.get(section)!.rules.push(rule);
  });

  // Sort rules and assign IDs
  sectionsMap.forEach(section => {
    section.rules.sort((a, b) => a.title.localeCompare(b.title, 'en-US'));
    section.rules.forEach((rule, index) => {
      rule.id = `${section.number}.${index + 1}`;
      rule.subsection = index + 1;
    });
  });

  const sections = Array.from(sectionsMap.values()).sort((a, b) => a.number - b.number);

  const markdown = generateMarkdown(sections, {
    version: metadata.version,
    title: metadata.title,
    organization: metadata.organization,
    date: metadata.date || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    abstract: metadata.abstract,
    references: metadata.references,
  });

  await writeFile(outputFile, markdown, 'utf-8');

  return { sections: sections.length, rules: ruleData.length };
}

/**
 * Extract test cases from rules for LLM evaluation
 */
export function extractTestCases(rules: Rule[]): TestCase[] {
  const testCases: TestCase[] = [];

  rules.forEach(rule => {
    rule.examples.forEach(example => {
      const label = example.label.toLowerCase();
      const isBad = label.includes('incorrect') || label.includes('wrong') || label.includes('bad');
      const isGood = label.includes('correct') || label.includes('good');

      if ((isBad || isGood) && example.code.trim()) {
        testCases.push({
          ruleId: rule.id,
          ruleTitle: rule.title,
          type: isBad ? 'bad' : 'good',
          code: example.code,
          language: example.language || 'typescript',
          description: example.description || `${example.label} example for ${rule.title}`,
        });
      }
    });
  });

  return testCases;
}

/**
 * Extract test cases from rules directory
 */
export async function extractTestCasesFromDir(
  rulesDir: string,
  outputFile: string
): Promise<{ total: number; bad: number; good: number }> {
  const files = await readdir(rulesDir);
  const ruleFiles = files.filter(f =>
    f.endsWith('.md') && !f.startsWith('_') && f !== 'README.md'
  );

  const allTestCases: TestCase[] = [];
  for (const file of ruleFiles) {
    const filePath = join(rulesDir, file);
    try {
      const { rule } = await parseRuleFile(filePath);
      rule.id = file.replace('.md', ''); // Temporary ID
      const testCases = extractTestCases([rule]);
      allTestCases.push(...testCases);
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }

  await writeFile(outputFile, JSON.stringify(allTestCases, null, 2), 'utf-8');

  return {
    total: allTestCases.length,
    bad: allTestCases.filter(tc => tc.type === 'bad').length,
    good: allTestCases.filter(tc => tc.type === 'good').length,
  };
}

/**
 * Validate rule file structure
 */
export function validateRule(rule: Rule): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!rule.title) errors.push('Missing title');
  if (!rule.explanation) errors.push('Missing explanation');
  if (!rule.impact) errors.push('Missing impact level');
  if (rule.examples.length === 0) errors.push('No examples provided');

  const hasIncorrect = rule.examples.some(e =>
    e.label.toLowerCase().includes('incorrect') || e.label.toLowerCase().includes('bad')
  );
  const hasCorrect = rule.examples.some(e =>
    e.label.toLowerCase().includes('correct') || e.label.toLowerCase().includes('good')
  );

  if (!hasIncorrect && !hasCorrect) {
    errors.push('Should have at least one Incorrect or Correct example');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Get impact level color for display
 */
export function getImpactColor(impact: ImpactLevel): string {
  switch (impact) {
    case 'CRITICAL': return '\x1b[31m'; // Red
    case 'HIGH': return '\x1b[33m';      // Yellow
    case 'MEDIUM-HIGH': return '\x1b[33m';
    case 'MEDIUM': return '\x1b[36m';    // Cyan
    case 'LOW-MEDIUM': return '\x1b[36m';
    case 'LOW': return '\x1b[32m';       // Green
    default: return '\x1b[0m';
  }
}

/**
 * Compare two impact levels
 */
export function compareImpact(a: ImpactLevel, b: ImpactLevel): number {
  return IMPACT_ORDER[a] - IMPACT_ORDER[b];
}

// --- Rules TDD (Pressure Testing) ---

const DEFAULT_PRESSURE_CONFIG: RulePressureTestConfig = {
  minExamples: 2,
  requireBothTypes: true,
  requireRationalization: false,
  minCodeLength: 20,
};

const RATIONALIZATION_KEYWORDS = [
  'excuse', 'why wrong', 'avoid', 'rationalization',
  '변명', '왜 틀렸', '합리화', '회피',
];

/**
 * Pressure-test a single rule for completeness and quality
 * Returns weighted score (0-100) with 70+ = passed
 */
export function pressureTestRule(
  rule: Rule,
  config: Partial<RulePressureTestConfig> = {}
): RuleTDDResult {
  const cfg = { ...DEFAULT_PRESSURE_CONFIG, ...config };
  const issues: string[] = [];

  // Check 1: Has examples (20 points)
  const hasExamples = rule.examples.length >= 1;
  if (!hasExamples) issues.push('No examples provided');

  // Check 2: Has both Incorrect + Correct (25 points)
  const hasIncorrect = rule.examples.some(e =>
    /incorrect|wrong|bad|❌/i.test(e.label)
  );
  const hasCorrect = rule.examples.some(e =>
    /correct|good|✅/i.test(e.label)
  );
  const hasBothTypes = hasIncorrect && hasCorrect;
  if (!hasBothTypes) issues.push('Missing Incorrect or Correct example');

  // Check 3: Has rationalization counters (20 points)
  const fullText = `${rule.explanation} ${rule.examples.map(e => e.code).join(' ')}`;
  const hasRationalization = RATIONALIZATION_KEYWORDS.some(kw =>
    fullText.toLowerCase().includes(kw.toLowerCase())
  );
  if (cfg.requireRationalization && !hasRationalization) {
    issues.push('No rationalization counter patterns found');
  }

  // Check 4: Has edge cases / 3+ examples (15 points)
  const hasEdgeCases = rule.examples.length >= 3;
  if (!hasEdgeCases) issues.push(`Only ${rule.examples.length} examples (recommend 3+)`);

  // Check 5: Example code quality (20 points)
  const codeExamples = rule.examples.filter(e => e.code.trim().length > 0);
  const avgCodeLength = codeExamples.length > 0
    ? codeExamples.reduce((sum, e) => sum + e.code.length, 0) / codeExamples.length
    : 0;
  const exampleQuality = Math.min(100, Math.round((avgCodeLength / cfg.minCodeLength) * 100));

  // Calculate weighted coverage score
  const coverageScore =
    (hasExamples ? 20 : 0) +
    (hasBothTypes ? 25 : 0) +
    (hasRationalization ? 20 : 0) +
    (hasEdgeCases ? 15 : 0) +
    Math.round(exampleQuality * 0.2);

  return {
    ruleId: rule.id,
    ruleTitle: rule.title,
    scores: {
      hasExamples,
      hasBothTypes,
      hasRationalization,
      hasEdgeCases,
      exampleQuality,
      coverageScore,
    },
    issues,
    passed: coverageScore >= 70,
  };
}

/**
 * Batch pressure-test all rules in a directory
 */
export async function pressureTestRulesDirectory(
  rulesDir: string,
  config: Partial<RulePressureTestConfig> = {}
): Promise<RulePressureTestSummary> {
  const files = await readdir(rulesDir);
  const ruleFiles = files.filter(f =>
    f.endsWith('.md') && !f.startsWith('_') && f !== 'README.md'
  );

  const results: RuleTDDResult[] = [];
  for (const file of ruleFiles) {
    const filePath = join(rulesDir, file);
    try {
      const { rule } = await parseRuleFile(filePath);
      rule.id = file.replace('.md', '');
      results.push(pressureTestRule(rule, config));
    } catch {
      results.push({
        ruleId: file,
        ruleTitle: file,
        scores: {
          hasExamples: false,
          hasBothTypes: false,
          hasRationalization: false,
          hasEdgeCases: false,
          exampleQuality: 0,
          coverageScore: 0,
        },
        issues: ['Failed to parse rule file'],
        passed: false,
      });
    }
  }

  return {
    total: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    results,
  };
}

/**
 * Format pressure test results as markdown report
 */
export function formatPressureTestReport(summary: RulePressureTestSummary): string {
  const lines: string[] = [];
  const passRate = summary.total > 0
    ? Math.round((summary.passed / summary.total) * 100)
    : 0;

  lines.push('# Rules TDD - Pressure Test Report\n');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Rules | ${summary.total} |`);
  lines.push(`| Passed | ${summary.passed} |`);
  lines.push(`| Failed | ${summary.failed} |`);
  lines.push(`| Pass Rate | ${passRate}% |`);
  lines.push('');

  const failed = summary.results.filter(r => !r.passed);
  if (failed.length > 0) {
    lines.push('## Failed Rules\n');
    for (const r of failed) {
      lines.push(`### ${r.ruleId}: ${r.ruleTitle} (${r.scores.coverageScore}/100)\n`);
      lines.push(`| Check | Status |`);
      lines.push(`|-------|--------|`);
      lines.push(`| Examples | ${r.scores.hasExamples ? '✅' : '❌'} |`);
      lines.push(`| Both Types | ${r.scores.hasBothTypes ? '✅' : '❌'} |`);
      lines.push(`| Rationalization | ${r.scores.hasRationalization ? '✅' : '❌'} |`);
      lines.push(`| Edge Cases (3+) | ${r.scores.hasEdgeCases ? '✅' : '❌'} |`);
      lines.push(`| Code Quality | ${r.scores.exampleQuality}/100 |`);
      if (r.issues.length > 0) {
        lines.push(`\n**Issues:** ${r.issues.join(', ')}\n`);
      }
    }
  }

  const passed = summary.results.filter(r => r.passed);
  if (passed.length > 0) {
    lines.push('## Passed Rules\n');
    lines.push(`| Rule | Score | Rationalization |`);
    lines.push(`|------|-------|-----------------|`);
    for (const r of passed) {
      const rat = r.scores.hasRationalization ? '✅' : '⚠️';
      lines.push(`| ${r.ruleTitle} | ${r.scores.coverageScore}/100 | ${rat} |`);
    }
  }

  return lines.join('\n');
}
