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
    // Review agents — invoked ONLY via the /vibe.review orchestrator (parallel dispatch).
    // No standalone "Use proactively" triggers: individual auto-firing (e.g. typescript+react+security
    // on a single .tsx edit) bypasses the orchestrator and causes duplicate/conflicting reviews.
    'security-reviewer': `Security vulnerability expert. ${roleDesc}. OWASP Top 10 verification. Invoked by the /vibe.review orchestrator (not a standalone auto-trigger).`,
    'architecture-reviewer': `Architecture design expert. ${roleDesc}. Layer/dependency/module-structure review. Invoked by the /vibe.review orchestrator (not a standalone auto-trigger).`,
    'performance-reviewer': `Performance optimization expert. ${roleDesc}. Loops, queries, API calls. Invoked by the /vibe.review orchestrator (not a standalone auto-trigger).`,
    'complexity-reviewer': `Code complexity analyzer. ${roleDesc}. Function length, nesting depth, cyclomatic complexity. Invoked by the /vibe.review orchestrator (not a standalone auto-trigger).`,
    'simplicity-reviewer': `Code simplicity advocate. ${roleDesc}. Detects over-engineering. Invoked by the /vibe.review orchestrator (not a standalone auto-trigger).`,
    'data-integrity-reviewer': `Data integrity expert. ${roleDesc}. Validates data flow and state management. Invoked by the /vibe.review orchestrator (not a standalone auto-trigger).`,
    'test-coverage-reviewer': `Test coverage analyzer. ${roleDesc}. Identifies missing tests. Invoked by the /vibe.review orchestrator (not a standalone auto-trigger).`,
    'git-history-reviewer': `Git history analyzer. ${roleDesc}. Reviews commit patterns and identifies risky changes. Invoked by the /vibe.review orchestrator (not a standalone auto-trigger).`,
    'python-reviewer': `Python code expert. ${roleDesc}. Type hints, PEP8 compliance. Invoked by the /vibe.review orchestrator (not a standalone auto-trigger).`,
    'typescript-reviewer': `TypeScript code expert. ${roleDesc}. Type safety, modern patterns. Invoked by the /vibe.review orchestrator (not a standalone auto-trigger).`,
    'rails-reviewer': `Rails framework expert. ${roleDesc}. MVC patterns, ActiveRecord best practices. Invoked by the /vibe.review orchestrator (not a standalone auto-trigger).`,
    'react-reviewer': `React framework expert. ${roleDesc}. Hooks, component patterns. Invoked by the /vibe.review orchestrator (not a standalone auto-trigger).`,
    // Research agents
    'best-practices': `Industry best practices researcher. ${roleDesc}. Use when starting feature design to gather recommended patterns.`,
    'framework-docs': `Framework documentation researcher. ${roleDesc}. Use to verify latest API usage and migration guides.`,
    'codebase-patterns': `Codebase pattern analyzer. ${roleDesc}. Use to discover existing patterns and conventions before implementation.`,
    'security-advisory': `Security advisory researcher. ${roleDesc}. Use to check CVEs and security advisories for project dependencies.`,
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
    'qa-coordinator': `QA orchestrator that routes changed code to appropriate QA agents. ${roleDesc}. Analyzes change types (API, UI, auth, data) and dispatches edge-case-finder, security-reviewer, performance-reviewer etc. in parallel, then synthesizes a unified QA report. Use after implementation to run comprehensive quality checks.`,
    'edge-case-finder': `Edge case and boundary condition detector. ${roleDesc}. Use to identify potential race conditions and data overflow risks.`,
    'acceptance-tester': `Acceptance criteria testability verifier. ${roleDesc}. Validates SPEC acceptance criteria are measurable and automatable.`,
    // Planning agents
    'requirements-analyst': `Requirements completeness analyzer. ${roleDesc}. Identifies gaps, ambiguous terms, and missing edge cases in SPEC documents.`,
    'ux-advisor': `UI/UX design advisor. ${roleDesc}. Reviews for missing interaction states, accessibility (WCAG 2.1 AA), and responsive design.`,
    // Docs agents
    'api-documenter': `API documentation generator. ${roleDesc}. Extracts endpoints and generates structured API docs with schemas and examples.`,
    'changelog-writer': `Changelog generator from git diff. ${roleDesc}. Classifies changes and suggests semantic version bumps.`,
    // Figma agents (teams/figma)
    'figma-analyst': `Figma data collector & pattern analyst. ${roleDesc}. Phase 2-3: REST API로 tree.json 수집, 디자인 의도 해석, 반복 패턴 → 공통 컴포넌트 후보 추출.`,
    'figma-architect': `Figma component tree designer. ${roleDesc}. Phase 3.5: sections.json → 컴포넌트 설계서, Props/Slots 인터페이스, 공유 vs 고유 컴포넌트 결정.`,
    'figma-builder': `Figma → code assembler. ${roleDesc}. Phase 4: component-spec.json + figma-to-scss.js 출력으로 HTML 구조 + 인터랙션 로직 작성. SCSS는 수정 금지.`,
    'figma-auditor': `Figma rendering validator. ${roleDesc}. Phase 5-6: tsc + build gate, 렌더링 vs 스크린샷 시각 검증, CSS 수치 대조 → builder에 불일치 리포트.`,
    // UI agents
    'ui-a11y-auditor': `UI accessibility auditor. ${roleDesc}. WCAG 2.1 AA 준수 검사, 색 대비, 키보드 네비, 스크린 리더. P1은 Review Debate Team으로 에스컬레이션.`,
    'ui-antipattern-detector': `UI anti-pattern detector. ${roleDesc}. design system MASTER.md 대비 일관성 위반, dark pattern, 디자인 시스템 이탈 식별.`,
    'ui-dataviz-advisor': `Data visualization advisor. ${roleDesc}. 제품 타입별 시각화 접근법, 차트 라이브러리 성능 고려, 접근성 가이드라인 제시.`,
    'ui-design-system-gen': `Design system generator. ${roleDesc}. 산업 분석 → 전체 디자인 시스템 생성, MASTER.md(CSS 변수/팔레트/타이포/스페이싱) 작성·저장.`,
    'ui-industry-analyzer': `Product → industry/style analyzer. ${roleDesc}. 제품 설명으로 산업 카테고리 감지, 스타일 우선순위·컬러·타이포 무드 결정. 다운스트림 agent 입력.`,
    'ui-layout-architect': `UI layout architect. ${roleDesc}. 산업 분석 → 페이지 레이아웃 구조 설계, 섹션/계층/CTA 배치, 랜딩·대시보드 패턴 추천.`,
    'ui-stack-implementer': `Stack-specific implementation guide. ${roleDesc}. 감지된 tech stack에 맞춘 구현 가이드라인, 컴포넌트 라이브러리·훅·상태관리 추천.`,
    'ux-compliance-reviewer': `UX guideline compliance reviewer. ${roleDesc}. 99 UX 가이드라인 대비 검토, 인터랙션 상태·네비게이션·피드백 패턴 검증.`,
    // Team coordinators (multi-agent orchestration meta-docs)
    'debug-team': `Debug team coordinator. ${roleDesc}. Reproduce→hypothesize→fix 워크플로를 다중 agent로 분담.`,
    'dev-team': `Dev team coordinator. ${roleDesc}. Implementer + Tester + Reviewer를 묶어 SPEC → 코드 → 검증 사이클 진행.`,
    'docs-team': `Docs team coordinator. ${roleDesc}. api-documenter + changelog-writer 협업으로 문서·릴리즈 노트 생성.`,
    'figma-team': `Figma pipeline coordinator. ${roleDesc}. figma-analyst → architect → builder → auditor 6-phase 파이프라인 오케스트레이션.`,
    'fullstack-team': `Fullstack team coordinator. ${roleDesc}. Frontend + Backend + DB 변경을 동시 진행하는 다중 agent 팀.`,
    'lite-team': `Lite team coordinator. ${roleDesc}. 단일 agent로 처리 가능한 소형 변경에 가벼운 implementer + reviewer 조합.`,
    'migration-team': `Migration team coordinator. ${roleDesc}. 데이터/스키마/프레임워크 마이그레이션 multi-step orchestration.`,
    'refactor-team': `Refactor team coordinator. ${roleDesc}. characterization-test → refactor-cleaner → simplifier 사이클 오케스트레이션.`,
    'research-team': `Research team coordinator. ${roleDesc}. best-practices + framework-docs + codebase-patterns + security-advisory 병렬 리서치 종합.`,
    'review-debate-team': `Multi-reviewer debate coordinator. ${roleDesc}. P1/P2 이슈를 security/architecture/performance/simplicity reviewer가 토론하여 합의·오탐 제거.`,
    'security-team': `Security team coordinator. ${roleDesc}. security-reviewer + security-advisory + edge-case-finder 협업으로 OWASP 종합 검증.`,
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
 * agents/ 디렉토리를 재귀 순회하여 모든 .md 파일을 변환 후 설치.
 * `agents/teams/` 는 단일 sub-agent가 아닌 다중 agent 메타 문서이므로
 * 별도 위치(vibe core)에 보관하며 Claude Code sub-agent로는 등록하지 않는다.
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
  let teamsSkipped = 0;

  function processDirectory(srcDir: string, destDir: string, relPath: string): void {
    ensureDir(destDir);
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);
      const childRel = relPath ? `${relPath}/${entry.name}` : entry.name;

      // teams/ 는 메타 문서 — sub-agent 등록에서 제외
      if (entry.isDirectory() && entry.name === 'teams' && relPath === '') {
        const teamCount = fs.readdirSync(srcPath, { recursive: true } as { recursive: true })
          .filter((f): f is string => typeof f === 'string' && f.endsWith('.md')).length;
        teamsSkipped = teamCount;
        continue;
      }

      if (entry.isDirectory()) {
        processDirectory(srcPath, destPath, childRel);
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

  processDirectory(agentsSource, claudeAgentsDir, '');
  const skipNote = teamsSkipped > 0 ? ` (+${teamsSkipped} teams skipped — meta docs)` : '';
  console.log(`   📦 Claude agents: ${installed}/${total} installed${skipNote}`);
}
