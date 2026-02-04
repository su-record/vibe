/**
 * Cursor 에이전트 변환 및 설치
 */

import path from 'path';
import fs from 'fs';
import { ensureDir } from './fs-utils.js';
import { CURSOR_MODEL_MAPPING } from './constants.js';

/**
 * VIBE 에이전트를 Cursor 서브에이전트 형식으로 변환
 */
function convertAgentToCursor(content: string, filename: string): string {
  // Windows CRLF → LF 정규화
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const name = path.basename(filename, '.md');
  const model = CURSOR_MODEL_MAPPING[name] || 'auto';

  // 제목 추출
  const titleMatch = normalizedContent.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : name;

  // Role 섹션 추출 (## Role 다음 내용을 다음 ## 전까지)
  const roleMatch = normalizedContent.match(/## Role\s*\n([\s\S]*?)(?=\n## )/);
  const roleLines = roleMatch
    ? roleMatch[1]
        .split('\n')
        .filter((line) => line.trim().startsWith('- '))
        .map((line) => line.trim().replace(/^- /, '').trim())
        .slice(0, 3)
    : [];

  // Checklist 섹션 추출 (## Checklist 다음 내용을 ## Output 전까지)
  const checklistMatch = normalizedContent.match(/## Checklist\s*\n([\s\S]*?)(?=\n## Output)/);
  const checklist = checklistMatch ? checklistMatch[1].trim() : '';

  // Output Format 추출 (## Output Format 다음 내용을 끝 또는 ## 전까지)
  const outputMatch = normalizedContent.match(/## Output Format\s*\n([\s\S]*?)(?=\n## |$)/);
  const outputFormat = outputMatch ? outputMatch[1].trim() : '';

  // Description 생성
  const roleDesc = roleLines.join(', ');
  const descriptions: Record<string, string> = {
    'security-reviewer': `Security vulnerability expert. ${roleDesc}. OWASP Top 10 verification. Use proactively after code changes involving authentication, user input, or data handling.`,
    'architecture-reviewer': `Architecture design expert. ${roleDesc}. Use proactively when modifying service layers, dependencies, or module structure.`,
    'performance-reviewer': `Performance optimization expert. ${roleDesc}. Use proactively after adding loops, database queries, or API calls.`,
    'complexity-reviewer': `Code complexity analyzer. ${roleDesc}. Use proactively to check function length, nesting depth, cyclomatic complexity.`,
    'simplicity-reviewer': `Code simplicity advocate. ${roleDesc}. Detects over-engineering. Use proactively after refactoring.`,
    'data-integrity-reviewer': `Data integrity expert. ${roleDesc}. Validates data flow and state management.`,
    'test-coverage-reviewer': `Test coverage analyzer. ${roleDesc}. Identifies missing tests. Use proactively after implementing new features.`,
    'git-history-reviewer': `Git history analyzer. ${roleDesc}. Reviews commit patterns and identifies risky changes.`,
    'python-reviewer': `Python code expert. ${roleDesc}. Type hints, PEP8 compliance. Use proactively for Python files.`,
    'typescript-reviewer': `TypeScript code expert. ${roleDesc}. Type safety, modern patterns. Use proactively for .ts/.tsx files.`,
    'rails-reviewer': `Rails framework expert. ${roleDesc}. MVC patterns, ActiveRecord best practices.`,
    'react-reviewer': `React framework expert. ${roleDesc}. Hooks, component patterns. Use proactively for React components.`,
  };
  const description =
    descriptions[name] || `${title}. ${roleDesc}. Use proactively after code edits.`;

  // Next Steps 생성
  const recommendations: Record<string, string[]> = {
    'security-reviewer': ['architecture-reviewer', 'data-integrity-reviewer'],
    'architecture-reviewer': ['complexity-reviewer', 'performance-reviewer'],
    'performance-reviewer': ['complexity-reviewer', 'test-coverage-reviewer'],
    'complexity-reviewer': ['simplicity-reviewer', 'test-coverage-reviewer'],
    'simplicity-reviewer': ['architecture-reviewer'],
    'data-integrity-reviewer': ['security-reviewer', 'test-coverage-reviewer'],
    'test-coverage-reviewer': ['security-reviewer'],
    'git-history-reviewer': ['security-reviewer', 'architecture-reviewer'],
    'python-reviewer': ['security-reviewer', 'test-coverage-reviewer'],
    'typescript-reviewer': ['security-reviewer', 'react-reviewer', 'test-coverage-reviewer'],
    'rails-reviewer': ['security-reviewer', 'performance-reviewer'],
    'react-reviewer': ['typescript-reviewer', 'performance-reviewer'],
  };
  const nextAgents = recommendations[name] || ['security-reviewer', 'test-coverage-reviewer'];
  const nextStepsSection = nextAgents
    .map((a) => `- For ${a.replace('-reviewer', '')} review: "Use ${a}"`)
    .join('\n');

  return `---
name: ${name}
model: ${model}
description: ${description}
---

# ${title}

## When Invoked

1. Run \`git diff\` to see recent changes
2. Focus on modified files relevant to this review type
3. Begin review immediately without asking questions

## Role

${roleLines.map((r) => `- ${r}`).join('\n')}

## Checklist

${checklist}

## Output Format

${outputFormat}

## Next Steps

Review complete. Consider these follow-up actions:

${nextStepsSection}
- All reviews done: Ready to commit
`;
}

/**
 * Cursor 서브에이전트 설치
 */
export function installCursorAgents(agentsSource: string, cursorAgentsDir: string): void {
  const reviewDir = path.join(agentsSource, 'review');
  if (!fs.existsSync(reviewDir)) {
    console.log(`   ⚠️ agents/review not found: ${reviewDir}`);
    return;
  }

  ensureDir(cursorAgentsDir);

  const files = fs.readdirSync(reviewDir).filter((f) => f.endsWith('.md'));
  let installed = 0;

  for (const file of files) {
    try {
      const sourcePath = path.join(reviewDir, file);
      const content = fs.readFileSync(sourcePath, 'utf-8');
      const cursorContent = convertAgentToCursor(content, file);
      const destPath = path.join(cursorAgentsDir, file);
      fs.writeFileSync(destPath, cursorContent, 'utf-8');
      installed++;
    } catch (err) {
      console.warn(`   ⚠️ Failed to convert ${file}: ${(err as Error).message}`);
    }
  }

  console.log(`   📦 Cursor agents: ${installed}/${files.length} installed`);
}
