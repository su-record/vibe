/**
 * Claude Code 네이티브 서브에이전트 변환 및 설치
 *
 * VIBE 에이전트 마크다운 파일을 Claude Code 네이티브 서브에이전트 형식
 * (YAML frontmatter 포함)으로 변환하여 ~/.claude/agents/에 설치
 */

import path from 'path';
import fs from 'fs';
import { ensureDir, removeDirRecursive } from './fs-utils.js';
import {
  CLAUDE_MODEL_MAPPING,
  CLAUDE_AGENT_TOOLS,
  CLAUDE_AGENT_TOOL_CATEGORY,
  CLAUDE_AGENT_PERMISSION_MODE,
  CLAUDE_AGENT_DISALLOWED_TOOLS,
  CLAUDE_AGENT_MEMORY,
} from './constants.js';

/**
 * 에이전트별 description 생성
 */
function generateDescription(name: string, title: string, roleLines: string[]): string {
  const roleDesc = roleLines.join(', ');

  const descriptions: Record<string, string> = {
    // Explorer tier
    'explorer': `Codebase exploration specialist. ${roleDesc}. Use proactively when exploring unfamiliar code or analyzing project structure.`,
    'explorer-low': `Fast codebase explorer for simple searches. ${roleDesc}. Use for quick file lookups and pattern matching.`,
    'explorer-medium': `Balanced codebase explorer with analysis. ${roleDesc}. Use for multi-file searches and code relationship analysis.`,
    // Implementer tier
    'implementer': `Core implementation specialist. ${roleDesc}. Use for feature implementation, refactoring, and bug fixes.`,
    'implementer-low': `Fast implementer for simple changes. ${roleDesc}. Use for single-line fixes, typo corrections, and comment updates.`,
    'implementer-medium': `Balanced implementer for standard features. ${roleDesc}. Use for new components, API integrations, and test writing.`,
    // Architect tier
    'architect': `System architecture and design specialist. ${roleDesc}. Use proactively for architecture decisions, trade-off analysis, and security-critical designs.`,
    'architect-low': `Quick architecture query agent. ${roleDesc}. Use for pattern lookups and simple structural questions.`,
    'architect-medium': `Module-level architecture designer. ${roleDesc}. Use for module design, API design, and component hierarchy decisions.`,
    // Review agents
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
    // Research agents
    'best-practices-agent': `Industry best practices researcher. ${roleDesc}. Use when starting feature design to gather recommended patterns.`,
    'framework-docs-agent': `Framework documentation researcher. ${roleDesc}. Use to verify latest API usage and migration guides.`,
    'codebase-patterns-agent': `Codebase pattern analyzer. ${roleDesc}. Use to discover existing patterns and conventions before implementation.`,
    'security-advisory-agent': `Security advisory researcher. ${roleDesc}. Use to check CVEs and security advisories for project dependencies.`,
    // Utility agents
    'searcher': `Web search specialist. ${roleDesc}. Use to find latest tech information, error solutions, and library documentation.`,
    'tester': `Test writing specialist. ${roleDesc}. Use proactively after implementing new features to generate comprehensive tests.`,
    'simplifier': `Code quality validator and auto-corrector. ${roleDesc}. Validates complexity metrics and suggests improvements.`,
    'refactor-cleaner': `Dead code detection and safe removal. ${roleDesc}. Use to find and remove unused exports, files, and dependencies.`,
    'build-error-resolver': `Minimal-diff build error fixer. ${roleDesc}. Use when TypeScript compilation or build fails.`,
    'compounder': `Knowledge compounding agent. ${roleDesc}. Auto-documents solved problems for future productivity.`,
    'diagrammer': `Diagram generation specialist. ${roleDesc}. Generates architecture, ERD, and flowchart diagrams in Mermaid.`,
    'e2e-tester': `E2E testing specialist with Playwright. ${roleDesc}. Use for browser-based testing, visual regression, and accessibility checks.`,
    'ui-previewer': `UI preview generator. ${roleDesc}. Generates UI mockups from descriptions or design files.`,
    'junior-mentor': `Junior developer mentor. ${roleDesc}. Implements features with thorough explanations.`,
    // QA agents
    'edge-case-finder': `Edge case and boundary condition detector. ${roleDesc}. Use to identify potential race conditions and data overflow risks.`,
    'acceptance-tester': `Acceptance criteria testability verifier. ${roleDesc}. Validates SPEC acceptance criteria are measurable and automatable.`,
    // Planning agents
    'requirements-analyst': `Requirements completeness analyzer. ${roleDesc}. Identifies gaps, ambiguous terms, and missing edge cases in SPEC documents.`,
    'ux-advisor': `UI/UX design advisor. ${roleDesc}. Reviews for missing interaction states, accessibility (WCAG 2.1 AA), and responsive design.`,
    // Docs agents
    'api-documenter': `API documentation generator. ${roleDesc}. Extracts endpoints and generates structured API docs with schemas and examples.`,
    'changelog-writer': `Changelog generator from git diff. ${roleDesc}. Classifies changes and suggests semantic version bumps.`,
  };

  return descriptions[name] || `${title}. ${roleDesc}. Use proactively when relevant.`;
}

/**
 * VIBE 에이전트를 Claude Code 네이티브 서브에이전트 형식으로 변환
 */
function convertAgentToClaude(content: string, filename: string): string {
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const name = path.basename(filename, '.md');
  const model = CLAUDE_MODEL_MAPPING[name] || 'sonnet';

  // 도구 해석
  const toolCategory = CLAUDE_AGENT_TOOL_CATEGORY[name] || 'read-only';
  const tools = CLAUDE_AGENT_TOOLS[toolCategory] || CLAUDE_AGENT_TOOLS['read-only'];

  // 권한 모드
  const permissionMode = CLAUDE_AGENT_PERMISSION_MODE[name] || 'default';

  // 차단 도구 (선택)
  const disallowedTools = CLAUDE_AGENT_DISALLOWED_TOOLS[name];

  // 메모리 (선택)
  const memory = CLAUDE_AGENT_MEMORY[name];

  // 제목 추출
  const titleMatch = normalizedContent.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : name;

  // Role 섹션 추출 (cursor-agents.ts와 동일 패턴)
  const roleMatch = normalizedContent.match(/## Role\s*\n([\s\S]*?)(?=\n## )/);
  const roleLines = roleMatch
    ? roleMatch[1]
        .split('\n')
        .filter((line) => line.trim().startsWith('- '))
        .map((line) => line.trim().replace(/^- /, '').trim())
        .slice(0, 3)
    : [];

  // Description 생성
  const description = generateDescription(name, title, roleLines);

  // YAML frontmatter 조립
  let frontmatter = '---\n';
  frontmatter += `name: ${name}\n`;
  frontmatter += `description: ${description}\n`;
  frontmatter += `model: ${model}\n`;
  frontmatter += `tools: ${tools.join(', ')}\n`;
  frontmatter += `permissionMode: ${permissionMode}\n`;

  if (disallowedTools && disallowedTools.length > 0) {
    frontmatter += `disallowedTools: ${disallowedTools.join(', ')}\n`;
  }

  if (memory) {
    frontmatter += `memory: ${memory}\n`;
  }

  frontmatter += '---\n';

  // 기존 frontmatter 제거 후 원본 본문 유지
  const bodyContent = normalizedContent.replace(/^---\n[\s\S]*?\n---\n/, '');

  return `${frontmatter}\n${bodyContent}`;
}

/**
 * Claude Code 네이티브 서브에이전트 설치
 *
 * agents/ 디렉토리를 재귀 순회하여 모든 .md 파일을 변환 후 설치
 */
export function installClaudeAgents(agentsSource: string, claudeAgentsDir: string): void {
  if (!fs.existsSync(agentsSource)) {
    console.log(`   ⚠️ agents directory not found: ${agentsSource}`);
    return;
  }

  // 클린 설치 (이전 버전 잔여 파일 방지)
  if (fs.existsSync(claudeAgentsDir)) {
    removeDirRecursive(claudeAgentsDir);
  }
  ensureDir(claudeAgentsDir);

  let installed = 0;
  let total = 0;

  function processDirectory(srcDir: string, destDir: string): void {
    ensureDir(destDir);
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);

      if (entry.isDirectory()) {
        processDirectory(srcPath, destPath);
      } else if (entry.name.endsWith('.md')) {
        total++;
        try {
          const content = fs.readFileSync(srcPath, 'utf-8');
          const claudeContent = convertAgentToClaude(content, entry.name);
          fs.writeFileSync(destPath, claudeContent, 'utf-8');
          installed++;
        } catch (err) {
          console.warn(`   ⚠️ Failed to convert ${entry.name}: ${(err as Error).message}`);
        }
      }
    }
  }

  processDirectory(agentsSource, claudeAgentsDir);
  console.log(`   📦 Claude agents: ${installed}/${total} installed`);
}
