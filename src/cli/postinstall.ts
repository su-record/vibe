#!/usr/bin/env node
/**
 * postinstall 스크립트
 * npm install -g @su-record/vibe 시 전역 설정 폴더 생성
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 전역 vibe 설정 디렉토리 경로
 */
function getVibeConfigDir(): string {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'vibe');
  }
  return path.join(os.homedir(), '.config', 'vibe');
}

/**
 * 디렉토리 생성 (재귀)
 */
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 디렉토리 복사 (재귀)
 */
function copyDirRecursive(src: string, dest: string): void {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 디렉토리 삭제 (재귀)
 */
function removeDirRecursive(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * 스킬 복사 (이미 존재하는 파일은 건너뜀 - 유저 수정 보존)
 */
function copySkillsIfMissing(src: string, dest: string): void {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copySkillsIfMissing(srcPath, destPath);
    } else if (!fs.existsSync(destPath)) {
      // 파일이 없을 때만 복사
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * 인라인 기본 스킬 시딩 (번들에 없는 추가 스킬)
 */
function seedInlineSkills(targetDir: string): void {
  const inlineSkills = [
    {
      id: 'multi-llm-orchestration',
      content: [
        '---',
        'name: multi-llm-orchestration',
        'description: "Multi-LLM research using GPT and Gemini for comprehensive analysis"',
        'triggers: [gpt, gemini, multi-llm, research, parallel research]',
        'priority: 80',
        '---',
        '# Multi-LLM Orchestration',
        '',
        'Use multiple LLMs for comprehensive research and validation.',
        '',
        '## Usage',
        '',
        '```bash',
        '# Via Bash hook (automatic in /vibe.spec)',
        'node hooks/scripts/llm-orchestrate.js gpt "your prompt"',
        'node hooks/scripts/llm-orchestrate.js gemini "your prompt"',
        '```',
        '',
        '## Setup',
        '',
        '```bash',
        'vibe gpt auth     # Configure GPT API key',
        'vibe gemini auth  # Configure Gemini OAuth/API key',
        'vibe status       # Check current configuration',
        '```',
        '',
        '## Best Practices',
        '',
        '1. Use GPT for best practices and code review',
        '2. Use Gemini for documentation and security analysis',
        '3. Combine results for comprehensive coverage',
      ].join('\n'),
    },
    {
      id: 'error-recovery',
      content: [
        '---',
        'name: error-recovery',
        'description: "Error recovery patterns and retry strategies"',
        'triggers: [error, fail, retry, recover, fix]',
        'priority: 70',
        '---',
        '# Error Recovery Patterns',
        '',
        '## Common Error Types',
        '',
        '### Build Errors',
        '- Check TypeScript compilation errors',
        '- Verify dependency versions',
        '- Run `npm ci` to clean install',
        '',
        '### Test Failures',
        '- Run failed tests in isolation',
        '- Check test fixtures/mocks',
        '- Verify async timing issues',
        '',
        '### Runtime Errors',
        '- Check stack trace carefully',
        '- Verify environment variables',
        '- Check external service connectivity',
        '',
        '## Retry Strategy',
        '',
        '1. First retry: Same action',
        '2. Second retry: Clean state (cache clear)',
        '3. Third retry: Alternative approach',
        '4. Max retries exceeded: Escalate to user',
      ].join('\n'),
    },
    {
      id: 'code-quality-check',
      content: [
        '---',
        'name: code-quality-check',
        'description: "Code quality validation using vibe tools"',
        'triggers: [quality, lint, complexity, review]',
        'priority: 60',
        '---',
        '# Code Quality Check',
        '',
        '## Using Vibe Tools',
        '',
        '```bash',
        '# Analyze complexity',
        "node -e \"import('@su-record/vibe/tools').then(t =>",
        "  t.analyzeComplexity({targetPath: 'src/', projectPath: process.cwd()})",
        '  .then(r => console.log(r.content[0].text))',
        ')\"',
        '```',
        '',
        '## Quality Metrics',
        '',
        '| Metric | Good | Warning | Critical |',
        '|--------|------|---------|----------|',
        '| Cyclomatic Complexity | ≤10 | 11-15 | >15 |',
        '| Function Length | ≤30 | 31-50 | >50 |',
        '| Nesting Depth | ≤3 | 4 | >4 |',
      ].join('\n'),
    },
    {
      id: 'session-management',
      content: [
        '---',
        'name: session-management',
        'description: "Context and session management across conversations"',
        'triggers: [session, context, memory, save, restore, continue]',
        'priority: 75',
        '---',
        '# Session Management',
        '',
        '## Starting a Session',
        '',
        '```bash',
        '# Auto-restore previous context',
        '/vibe.utils --continue',
        '```',
        '',
        '## Saving Context',
        '',
        'At 70%+ context usage:',
        '1. Use `saveMemory` for important decisions',
        '2. Start new session with `/new`',
        '3. Previous context auto-restores',
        '',
        '## Commands',
        '',
        '- `/vibe.utils --continue` - Restore previous session',
        '- `saveMemory` tool - Save important decisions',
        '- `startSession` tool - Initialize session with context',
      ].join('\n'),
    },
  ];

  for (const skill of inlineSkills) {
    const destPath = path.join(targetDir, skill.id + '.md');
    if (!fs.existsSync(destPath)) {
      try {
        fs.writeFileSync(destPath, skill.content);
      } catch {
        // 무시 - 병렬 실행 시 레이스 컨디션 가능
      }
    }
  }
}

// Cursor 모델 매핑 (각 리뷰어 유형에 최적의 모델)
// 사용 가능: composer-1, claude-4.5-opus-high, claude-4.5-opus-high-thinking,
//           claude-4.5-sonnet-thinking, gpt-5.2-codex, gpt-5.2, gpt-5.2-high,
//           gemini-3-pro, gemini-3-flash
const CURSOR_MODEL_MAPPING: Record<string, string> = {
  // 보안/아키텍처: 깊은 추론 필요 → thinking 모델
  'security-reviewer': 'claude-4.5-sonnet-thinking',
  'architecture-reviewer': 'claude-4.5-sonnet-thinking',
  'data-integrity-reviewer': 'claude-4.5-sonnet-thinking',

  // 언어별 전문가: 코드 이해 필요 → codex
  'typescript-reviewer': 'gpt-5.2-codex',
  'python-reviewer': 'gpt-5.2-codex',
  'react-reviewer': 'gpt-5.2-codex',
  'rails-reviewer': 'gpt-5.2-codex',

  // 빠른 패턴 체크: 경량 모델
  'performance-reviewer': 'gemini-3-flash',
  'complexity-reviewer': 'gemini-3-flash',
  'simplicity-reviewer': 'gemini-3-flash',
  'test-coverage-reviewer': 'gemini-3-flash',
  'git-history-reviewer': 'gemini-3-flash',
};

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
 * Cursor 프로젝트 룰 템플릿 생성 (VIBE 표준 기반)
 */
function generateCursorRules(cursorRulesDir: string): void {
  ensureDir(cursorRulesDir);

  const rules = [
    {
      filename: 'typescript-standards.mdc',
      content: `---
description: TypeScript coding standards - complexity limits, type safety, error handling
globs: "**/*.ts,**/*.tsx"
alwaysApply: false
---

# TypeScript Standards

## Type Safety
- No \`any\` type → Use \`unknown\` + type guards
- No \`as any\` casting → Define proper interfaces
- No \`@ts-ignore\` → Fix type issues at root
- Explicit return types on all exported functions

## Complexity Limits
| Metric | Limit |
|--------|-------|
| Function length | ≤30 lines (recommended), ≤50 lines (max) |
| Nesting depth | ≤3 levels |
| Parameters | ≤5 |
| Cyclomatic complexity | ≤10 |

## Error Handling
- Always use try-catch for async operations
- Provide user-friendly error messages
- Handle loading states appropriately

## Code Structure Order
1. Import statements
2. Type/Interface definitions
3. Constants
4. Helper functions
5. Main component/function
6. Sub-components (if React)

## Example - Early Return Pattern
\`\`\`typescript
// ❌ Avoid nested conditions
function processUser(user: User) {
  if (user.isActive) {
    if (user.hasPermission) {
      return process(user);
    }
  }
  return null;
}

// ✅ Use early returns
function processUser(user: User) {
  if (!user.isActive) return null;
  if (!user.hasPermission) return null;
  return process(user);
}
\`\`\`
`,
    },
    {
      filename: 'react-patterns.mdc',
      content: `---
description: React component patterns and best practices
globs: "**/*.tsx,**/*.jsx"
alwaysApply: false
---

# React Patterns

## Component Structure
1. State & Refs declarations
2. Custom hooks
3. Event handlers
4. Effects (useEffect)
5. Early returns (loading, error states)
6. Main JSX return

## Best Practices
- Use functional components with hooks
- Extract custom hooks for reusable logic
- Keep components under 200 lines
- Colocate styles with components

## Example - Component Order
\`\`\`tsx
function UserProfile({ userId }: Props) {
  // 1. State
  const [user, setUser] = useState<User | null>(null);

  // 2. Custom hooks
  const { isAuthenticated } = useAuth();

  // 3. Event handlers
  const handleSubmit = (e: FormEvent) => { /* ... */ };

  // 4. Effects
  useEffect(() => { /* fetch user */ }, [userId]);

  // 5. Early returns
  if (!user) return <Loading />;

  // 6. Main JSX
  return <div>{/* ... */}</div>;
}
\`\`\`
`,
    },
    {
      filename: 'code-quality.mdc',
      content: `---
description: General code quality rules for all files
alwaysApply: true
---

# Code Quality Rules

## Core Principles
- **Modify only requested scope** - Don't touch unrelated code
- **Preserve existing style** - Follow project conventions
- **Keep working code** - No unnecessary refactoring

## Forbidden Patterns
- No \`console.log\` in production code (remove after debugging)
- No hardcoded strings/numbers → Extract to constants
- No commented-out code in commits
- No incomplete code without TODO marker

## Naming Conventions
- Variables/functions: camelCase
- Classes/types: PascalCase
- Constants: UPPER_SNAKE_CASE
- Files: kebab-case or PascalCase (match project style)

## Function Design
- Single responsibility per function
- Max 5 parameters (use object for more)
- Descriptive names (verb + noun)
- Document non-obvious behavior

## Dependency Management
- Avoid circular dependencies
- Keep loose coupling (depend on interfaces)
- High cohesion (group related functions)
`,
    },
    {
      filename: 'security-checklist.mdc',
      content: `---
description: Security checklist for code changes
globs: "**/*.ts,**/*.tsx,**/*.js,**/*.jsx,**/*.py"
alwaysApply: false
---

# Security Checklist

## Input Validation
- [ ] Validate all user inputs
- [ ] Sanitize data before database queries
- [ ] Use parameterized queries (prevent SQL injection)

## Authentication
- [ ] Secure password handling (never store plain text)
- [ ] Session management is secure
- [ ] Tokens have appropriate expiry

## Data Protection
- [ ] Sensitive data is encrypted
- [ ] API keys not committed to code
- [ ] Error messages don't leak sensitive info

## OWASP Top 10 Awareness
- Injection (SQL, XSS, Command)
- Broken authentication
- Sensitive data exposure
- XML external entities (XXE)
- Broken access control
- Security misconfiguration
- Cross-site scripting (XSS)
- Insecure deserialization
- Using components with known vulnerabilities
- Insufficient logging & monitoring
`,
    },
    {
      filename: 'python-standards.mdc',
      content: `---
description: Python coding standards - PEP8, type hints, async patterns
globs: "**/*.py"
alwaysApply: false
---

# Python Standards

## Type Hints (Required)
\`\`\`python
# ✅ Good
def process_user(user: User, options: dict[str, Any] | None = None) -> Result:
    ...

# ❌ Avoid
def process_user(user, options=None):
    ...
\`\`\`

## PEP8 Compliance
- Max line length: 88 (Black formatter default)
- Use snake_case for functions/variables
- Use PascalCase for classes
- 2 blank lines before top-level definitions

## Async Patterns
\`\`\`python
# ✅ Proper async/await
async def fetch_data(url: str) -> dict:
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.json()

# ❌ Avoid blocking calls in async
async def fetch_data(url: str) -> dict:
    return requests.get(url).json()  # Blocks event loop!
\`\`\`

## Error Handling
\`\`\`python
# ✅ Specific exceptions
try:
    result = process_data(data)
except ValidationError as e:
    logger.error(f"Validation failed: {e}")
    raise HTTPException(400, str(e))

# ❌ Bare except
try:
    result = process_data(data)
except:
    pass  # Silent failure
\`\`\`
`,
    },
  ];

  let updated = 0;
  for (const rule of rules) {
    const destPath = path.join(cursorRulesDir, rule.filename);
    try {
      fs.writeFileSync(destPath, rule.content, 'utf-8');
      updated++;
    } catch {
      // 무시 - 권한 문제 등
    }
  }

  console.log(`   📏 Cursor rules template: ${updated}/${rules.length} updated`);
}

/**
 * Cursor 서브에이전트 설치
 */
function installCursorAgents(agentsSource: string, cursorAgentsDir: string): void {
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

/**
 * Cursor Skills 생성 (VIBE 커맨드 → Cursor 스킬 변환)
 * 설치 경로: ~/.cursor/skills/[skill-name]/SKILL.md
 */
function generateCursorSkills(cursorSkillsDir: string): void {
  const skills = [
    {
      id: 'vibe-spec',
      content: `---
name: vibe-spec
model: claude-4.5-sonnet-thinking
description: "SPEC document creation with parallel research. Use when starting new feature implementation."
---

# /vibe.spec - SPEC Creation Skill

SPEC-driven feature development workflow. Creates AI-executable specification documents.

## When to Use

- Starting new feature implementation
- Complex tasks requiring research and planning
- Features needing clear requirements documentation

## Invocation

User says: "vibe spec [feature-name]" or "Create SPEC for [feature-name]"

## Workflow

### Phase 1: Requirements Gathering
1. Ask user for feature requirements
2. Clarify scope and constraints
3. Identify tech stack and dependencies

### Phase 2: Parallel Research (Manual)
Run these in parallel:
- "Use best-practices-agent for [feature]"
- "Use security-advisory-agent for [feature]"
- Search framework docs with context7

### Phase 3: SPEC Document Generation
Create SPEC in PTCF format:
\`\`\`
<role>      AI role definition
<context>   Background, tech stack, related code
<task>      Phase-by-phase task list
<constraints> Constraints
<output_format> Files to create/modify
<acceptance> Verification criteria
\`\`\`

### Phase 4: Save SPEC
Save to \`.claude/vibe/specs/[feature-name]-spec.md\`

## Output Format

\`\`\`markdown
# [Feature Name] SPEC

## Overview
[1-2 sentence summary]

## Requirements
- REQ-001: [Requirement]
- REQ-002: [Requirement]

## Technical Approach
[Implementation strategy]

## Phases
### Phase 1: [Setup]
- [ ] Task 1
- [ ] Task 2

### Phase 2: [Core Implementation]
...

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
\`\`\`

## Next Steps

After SPEC creation:
- "vibe spec review" - Review SPEC with external LLMs
- "vibe run [feature-name]" - Start implementation
`,
    },
    {
      id: 'vibe-run',
      content: `---
name: vibe-run
model: claude-4.5-opus-high
description: "Execute SPEC implementation with Scenario-Driven Development. Use after SPEC is approved."
---

# /vibe.run - Implementation Execution Skill

Executes SPEC-based implementation using Scenario-Driven Development methodology.

## When to Use

- After SPEC is created and approved
- When implementing features phase by phase
- For complex multi-file implementations

## Invocation

User says: "vibe run [feature-name]" or "Implement [feature-name]"

## Pre-requisites

1. SPEC document exists at \`.claude/vibe/specs/[feature-name]-spec.md\`
2. SPEC has been reviewed (optional but recommended)

## Workflow

### Step 1: Load SPEC
Read SPEC from \`.claude/vibe/specs/[feature-name]-spec.md\`

### Step 2: For Each Phase in SPEC

#### 2a. Phase Planning
- List all tasks for current phase
- Identify file dependencies
- Check existing code patterns

#### 2b. Implementation
- Implement each task
- Follow existing code style
- Keep functions under complexity limits

#### 2c. Phase Verification
- Run relevant tests
- Check TypeScript compilation
- Verify no regressions

### Step 3: Phase Completion
Mark phase complete, proceed to next phase

## ULTRAWORK Mode

Add "ultrawork" or "ulw" for maximum performance:
- Parallel sub-agent exploration
- Auto-continue between phases
- Auto-retry on errors (max 3)

## Output Format

Per phase:
\`\`\`
## Phase [N]: [Name]

### Completed Tasks
- [x] Task 1 - [file.ts]
- [x] Task 2 - [file.ts]

### Files Modified
- src/feature/index.ts (new)
- src/feature/utils.ts (modified)

### Verification
- ✅ TypeScript compilation
- ✅ Tests passing
\`\`\`

## Next Steps

After implementation:
- "vibe review" - Run 12+ agent code review
- "vibe verify [feature-name]" - Verify against SPEC
- "vibe trace [feature-name]" - Generate traceability matrix
`,
    },
    {
      id: 'vibe-review',
      content: `---
name: vibe-review
model: auto
description: "Parallel code review with 12+ specialized agents. Use after code changes."
---

# /vibe.review - Parallel Code Review Skill

Orchestrates 12+ specialized review agents for comprehensive code review.

## When to Use

- After implementing new features
- Before creating pull requests
- After significant code changes

## Invocation

User says: "vibe review" or "Review my code"

## Available Review Agents

### Security & Architecture (Thinking Models)
- **security-reviewer** - OWASP Top 10, authentication, data handling
- **architecture-reviewer** - Design patterns, dependencies, structure
- **data-integrity-reviewer** - Data flow, state management, persistence

### Language Specialists (Codex Models)
- **typescript-reviewer** - Type safety, modern patterns
- **python-reviewer** - Type hints, PEP8, async patterns
- **react-reviewer** - Hooks, component patterns
- **rails-reviewer** - MVC, ActiveRecord best practices

### Pattern Checkers (Flash Models)
- **performance-reviewer** - N+1 queries, loops, memory
- **complexity-reviewer** - Function length, nesting, cyclomatic
- **simplicity-reviewer** - Over-engineering detection
- **test-coverage-reviewer** - Missing tests, edge cases
- **git-history-reviewer** - Risk patterns, commit analysis

## Workflow

### Step 1: Analyze Changes
\`\`\`bash
git diff HEAD~1
\`\`\`

### Step 2: Select Relevant Agents
Based on changed files:
- .ts/.tsx → typescript-reviewer, react-reviewer
- .py → python-reviewer
- Security-related → security-reviewer
- Architecture changes → architecture-reviewer

### Step 3: Run Reviews (Parallel)
Invoke selected agents:
- "Use security-reviewer"
- "Use typescript-reviewer"
- (etc.)

### Step 4: Consolidate Findings

## Priority System

| Priority | Meaning | Action |
|----------|---------|--------|
| 🔴 P1 | Critical | Blocks merge, fix immediately |
| 🟡 P2 | Important | Fix recommended before merge |
| 🔵 P3 | Nice-to-have | Add to backlog |

## Output Format

\`\`\`markdown
# Code Review Summary

## 🔴 P1 - Critical (X issues)
- [Issue description] - [file:line]

## 🟡 P2 - Important (X issues)
- [Issue description] - [file:line]

## 🔵 P3 - Suggestions (X issues)
- [Issue description] - [file:line]

## Reviewed By
- security-reviewer ✅
- typescript-reviewer ✅
- performance-reviewer ✅
\`\`\`

## Next Steps

After review:
- Fix P1 issues immediately
- Address P2 issues before merge
- Track P3 in backlog
- Ready to commit when P1/P2 resolved
`,
    },
    {
      id: 'vibe-analyze',
      content: `---
name: vibe-analyze
model: claude-4.5-sonnet-thinking
description: "Project and feature analysis. Use when exploring codebase or planning changes."
---

# /vibe.analyze - Analysis Skill

Comprehensive project and feature analysis for understanding codebases.

## When to Use

- Exploring unfamiliar codebase
- Planning feature changes
- Understanding dependencies
- Identifying potential issues

## Invocation

User says: "vibe analyze" or "Analyze [feature/path]"

## Analysis Modes

### 1. Project Analysis (Default)
Analyzes entire project structure and architecture.

### 2. Feature Analysis
Analyzes specific feature or module.
\`\`\`
vibe analyze src/auth
vibe analyze "login feature"
\`\`\`

### 3. Dependency Analysis
Maps dependencies and coupling.

## Workflow

### Step 1: Structure Scan
\`\`\`bash
# Find key files
ls -la
find . -name "*.ts" -o -name "*.tsx" | head -20
\`\`\`

### Step 2: Entry Points
Identify main entry points:
- package.json scripts
- src/index.ts
- app/main.ts

### Step 3: Architecture Mapping
- Module boundaries
- Data flow paths
- External dependencies

### Step 4: Quality Assessment
- Complexity hotspots
- Test coverage gaps
- Security concerns

## Output Format

\`\`\`markdown
# Project Analysis: [Name]

## Overview
- Framework: [e.g., Next.js 14]
- Language: [e.g., TypeScript 5.x]
- Package Manager: [e.g., pnpm]

## Architecture
### Layers
1. Presentation (src/components/)
2. Business Logic (src/services/)
3. Data Access (src/repositories/)

### Key Modules
| Module | Purpose | Files |
|--------|---------|-------|
| auth | Authentication | 12 |
| api | API routes | 8 |

## Dependencies
### Internal
- auth → db, utils
- api → auth, services

### External (Notable)
- next: ^14.0.0
- prisma: ^5.0.0

## Quality Metrics
| Metric | Value | Status |
|--------|-------|--------|
| Avg Complexity | 8.2 | ✅ Good |
| Test Coverage | 65% | ⚠️ Moderate |
| Type Coverage | 95% | ✅ Good |

## Recommendations
1. [Recommendation 1]
2. [Recommendation 2]
\`\`\`

## Next Steps

After analysis:
- "vibe spec [feature]" - Create SPEC for changes
- "vibe review" - Review existing code quality
- Plan Mode - For simple modifications
`,
    },
    {
      id: 'vibe-verify',
      content: `---
name: vibe-verify
model: claude-4.5-sonnet-thinking
description: "Verify implementation against SPEC requirements. Use after implementation."
---

# /vibe.verify - Verification Skill

Verifies implementation completeness against SPEC requirements.

## When to Use

- After completing implementation
- Before marking feature as done
- For requirement traceability

## Invocation

User says: "vibe verify [feature-name]"

## Pre-requisites

1. SPEC exists at \`.claude/vibe/specs/[feature-name]-spec.md\`
2. Implementation is complete

## Workflow

### Step 1: Load SPEC
Read SPEC and extract:
- Requirements (REQ-XXX)
- Acceptance criteria
- Expected outputs

### Step 2: Map Implementation
For each requirement:
- Find implementing code
- Identify test coverage
- Check acceptance criteria

### Step 3: Gap Analysis
Identify:
- Unimplemented requirements
- Untested features
- Missing acceptance criteria

### Step 4: Generate Report

## Verification Levels

| Level | Meaning |
|-------|---------|
| ✅ Full | Code + Test + Verified |
| ⚠️ Partial | Code exists, missing test or verification |
| ❌ None | Not implemented |

## Output Format

\`\`\`markdown
# Verification Report: [Feature]

## Summary
- Total Requirements: 10
- Fully Verified: 8 (80%)
- Partial: 1 (10%)
- Missing: 1 (10%)

## Requirement Matrix

| ID | Requirement | Code | Test | Status |
|----|-------------|------|------|--------|
| REQ-001 | User login | ✅ | ✅ | ✅ Full |
| REQ-002 | Password reset | ✅ | ❌ | ⚠️ Partial |
| REQ-003 | MFA support | ❌ | ❌ | ❌ None |

## Acceptance Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Login < 2s | ✅ | Performance test |
| No plain passwords | ✅ | Code review |

## Gaps to Address

1. **REQ-003**: MFA support not implemented
2. **REQ-002**: Missing test for password reset

## Recommendation
⚠️ Address gaps before release
\`\`\`

## Next Steps

After verification:
- Fix gaps if any
- "vibe trace [feature]" - Full traceability matrix
- "vibe review" - Final code review
- Ready for release if all verified
`,
    },
    {
      id: 'vibe-reason',
      content: `---
name: vibe-reason
model: claude-4.5-opus-high-thinking
description: "Systematic 9-step reasoning framework. Use for complex problem solving."
---

# /vibe.reason - Reasoning Framework Skill

Applies systematic reasoning to complex problems and decisions.

## When to Use

- Complex debugging scenarios
- Architecture decisions
- Trade-off analysis
- Root cause analysis

## Invocation

User says: "vibe reason [problem]" or "Reason about [problem]"

## 9-Step Reasoning Framework

### Step 1: Problem Definition
- What exactly is the problem?
- What are the symptoms?
- What is the expected vs actual behavior?

### Step 2: Context Gathering
- What is the relevant code/system?
- What changed recently?
- What are the constraints?

### Step 3: Hypothesis Generation
Generate multiple hypotheses:
- Hypothesis A: [Description]
- Hypothesis B: [Description]
- Hypothesis C: [Description]

### Step 4: Evidence Collection
For each hypothesis:
- What evidence supports it?
- What evidence contradicts it?
- What additional info needed?

### Step 5: Hypothesis Evaluation
Score each hypothesis:
| Hypothesis | Support | Contradict | Confidence |
|------------|---------|------------|------------|
| A | 3 | 1 | 75% |
| B | 2 | 2 | 50% |
| C | 1 | 3 | 25% |

### Step 6: Deep Dive
Focus on highest-confidence hypothesis:
- Trace code paths
- Check logs/metrics
- Reproduce issue

### Step 7: Solution Design
Design solution addressing root cause:
- Option 1: [Description] - Pros/Cons
- Option 2: [Description] - Pros/Cons

### Step 8: Risk Assessment
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| [Risk 1] | High | Medium | [Strategy] |

### Step 9: Recommendation
Final recommendation with:
- Chosen solution
- Implementation steps
- Verification plan

## Output Format

\`\`\`markdown
# Reasoning Analysis: [Problem]

## 1. Problem Definition
[Clear statement of the problem]

## 2. Context
[Relevant background and constraints]

## 3. Hypotheses
1. **H1**: [Description]
2. **H2**: [Description]
3. **H3**: [Description]

## 4-5. Evidence & Evaluation
| Hypothesis | Evidence For | Evidence Against | Confidence |
|------------|--------------|------------------|------------|
| H1 | [List] | [List] | 80% |
| H2 | [List] | [List] | 40% |

## 6. Deep Dive (H1)
[Detailed analysis of most likely cause]

## 7. Solutions
### Option A (Recommended)
- Description: [...]
- Pros: [...]
- Cons: [...]

### Option B
- Description: [...]
- Pros: [...]
- Cons: [...]

## 8. Risks
| Risk | Mitigation |
|------|------------|
| [Risk] | [Strategy] |

## 9. Recommendation
**Proceed with Option A because:**
1. [Reason 1]
2. [Reason 2]

**Next Steps:**
1. [Step 1]
2. [Step 2]
\`\`\`

## Next Steps

After reasoning:
- Implement chosen solution
- "vibe spec [solution]" - If solution needs SPEC
- "vibe verify" - Verify solution addresses problem
`,
    },
    {
      id: 'vibe-ui',
      content: `---
name: vibe-ui
model: gpt-5.2-codex
description: "UI preview and generation utilities. Use for UI component work."
---

# /vibe.ui - UI Utilities Skill

UI preview, generation, and refactoring utilities.

## When to Use

- Creating new UI components
- Previewing UI designs
- Refactoring existing components
- Generating component code from descriptions

## Invocation

User says: "vibe ui [description]" or "Preview UI for [description]"

## Modes

### 1. UI Preview
Generate visual preview of UI description.
\`\`\`
vibe ui "Login form with email, password, and remember me checkbox"
\`\`\`

### 2. Component Generation
Generate component code from description.
\`\`\`
vibe ui generate "User profile card with avatar, name, and bio"
\`\`\`

### 3. UI Refactoring
Refactor existing component for better patterns.
\`\`\`
vibe ui refactor src/components/UserCard.tsx
\`\`\`

## Workflow

### UI Preview Mode

1. **Parse Description**
   - Extract UI elements
   - Identify layout requirements
   - Note interactions

2. **Generate Preview**
   - Create HTML/CSS mockup
   - Show component structure
   - Illustrate states (default, hover, active)

3. **Output**
   - Visual description
   - Component hierarchy
   - Suggested implementation

### Component Generation Mode

1. **Analyze Requirements**
   - Component purpose
   - Props interface
   - State requirements

2. **Generate Code**
   - TypeScript/React component
   - Styled with project's CSS approach
   - Include prop types

3. **Output**
   - Complete component file
   - Usage example
   - Test suggestions

### Refactoring Mode

1. **Analyze Existing**
   - Current structure
   - Identified issues
   - Improvement opportunities

2. **Plan Refactor**
   - Extract components
   - Improve patterns
   - Optimize performance

3. **Apply Changes**
   - Preserve functionality
   - Improve readability
   - Add documentation

## Output Format

### Preview Output
\`\`\`markdown
# UI Preview: [Description]

## Visual Structure
\`\`\`
┌─────────────────────────────────┐
│  [Header]                       │
├─────────────────────────────────┤
│  📧 Email: [_______________]    │
│  🔒 Password: [_______________] │
│  ☐ Remember me                  │
│                                 │
│        [  Login  ]              │
└─────────────────────────────────┘
\`\`\`

## Component Hierarchy
- LoginForm
  - FormField (email)
  - FormField (password)
  - Checkbox (remember)
  - Button (submit)

## Suggested Props
\`\`\`typescript
interface LoginFormProps {
  onSubmit: (data: LoginData) => void;
  isLoading?: boolean;
  error?: string;
}
\`\`\`
\`\`\`

### Generation Output
\`\`\`typescript
// Complete component code with:
// - TypeScript types
// - React hooks
// - Styled components or CSS classes
// - Event handlers
\`\`\`

## Next Steps

After UI work:
- "vibe review" - Review generated components
- "vibe run [feature]" - Continue implementation
- Add tests for new components
`,
    },
  ];

  let updated = 0;
  for (const skill of skills) {
    const skillDir = path.join(cursorSkillsDir, skill.id);
    ensureDir(skillDir);
    const destPath = path.join(skillDir, 'SKILL.md');
    try {
      fs.writeFileSync(destPath, skill.content, 'utf-8');
      updated++;
    } catch {
      // 무시 - 권한 문제 등
    }
  }

  console.log(`   🎯 Cursor skills: ${updated}/${skills.length} updated`);
}

/**
 * postinstall 메인 함수
 */
function main(): void {
  try {
    const globalVibeDir = getVibeConfigDir();
    const nodeModulesDir = path.join(globalVibeDir, 'node_modules');
    const vibePackageDir = path.join(nodeModulesDir, '@su-record', 'vibe');
    const packageRoot = path.resolve(__dirname, '..', '..');

    // 1. 전역 vibe 디렉토리 구조 생성
    ensureDir(globalVibeDir);
    ensureDir(nodeModulesDir);
    ensureDir(path.join(nodeModulesDir, '@su-record'));

    // 2. 패키지 복사
    if (fs.existsSync(vibePackageDir)) {
      removeDirRecursive(vibePackageDir);
    }
    if (fs.existsSync(packageRoot)) {
      copyDirRecursive(packageRoot, vibePackageDir);
    }

    // 3. 훅 스크립트 복사 (%APPDATA%/vibe/hooks/scripts/)
    const hooksSource = path.join(packageRoot, 'hooks', 'scripts');
    const hooksTarget = path.join(globalVibeDir, 'hooks', 'scripts');
    if (fs.existsSync(hooksSource)) {
      ensureDir(path.join(globalVibeDir, 'hooks'));
      if (fs.existsSync(hooksTarget)) {
        removeDirRecursive(hooksTarget);
      }
      copyDirRecursive(hooksSource, hooksTarget);
    }

    // 4. ~/.claude/ 전역 assets 설치 (commands, agents, skills)
    const globalClaudeDir = path.join(os.homedir(), '.claude');
    ensureDir(globalClaudeDir);

    // commands 복사
    const commandsSource = path.join(packageRoot, 'commands');
    const globalCommandsDir = path.join(globalClaudeDir, 'commands');
    if (fs.existsSync(commandsSource)) {
      ensureDir(globalCommandsDir);
      copyDirRecursive(commandsSource, globalCommandsDir);
    }

    // agents 복사
    const agentsSource = path.join(packageRoot, 'agents');
    const globalAgentsDir = path.join(globalClaudeDir, 'agents');
    if (fs.existsSync(agentsSource)) {
      ensureDir(globalAgentsDir);
      copyDirRecursive(agentsSource, globalAgentsDir);
    }

    // skills 복사 (덮어쓰지 않고 없는 것만 추가)
    const skillsSource = path.join(packageRoot, 'skills');
    const globalSkillsDir = path.join(globalClaudeDir, 'skills');
    if (fs.existsSync(skillsSource)) {
      ensureDir(globalSkillsDir);
      copySkillsIfMissing(skillsSource, globalSkillsDir);
    }

    // 5. ~/.claude/vibe/ 전역 문서 설치 (rules, languages, templates)
    // 프로젝트별로 복사하지 않고 전역에서 참조
    const globalVibeAssetsDir = path.join(globalClaudeDir, 'vibe');
    ensureDir(globalVibeAssetsDir);

    // ~/.claude/vibe/skills/ 전역 vibe 스킬 설치 (v2.5.12)
    const vibeSkillsDir = path.join(globalVibeAssetsDir, 'skills');
    ensureDir(vibeSkillsDir);
    if (fs.existsSync(skillsSource)) {
      copySkillsIfMissing(skillsSource, vibeSkillsDir);
    }
    // 인라인 기본 스킬 추가 (번들에 없는 추가 스킬)
    seedInlineSkills(vibeSkillsDir);

    // vibe/rules 복사
    const rulesSource = path.join(packageRoot, 'vibe', 'rules');
    const globalRulesDir = path.join(globalVibeAssetsDir, 'rules');
    if (fs.existsSync(rulesSource)) {
      if (fs.existsSync(globalRulesDir)) {
        removeDirRecursive(globalRulesDir);
      }
      copyDirRecursive(rulesSource, globalRulesDir);
    }

    // vibe/templates 복사
    const templatesSource = path.join(packageRoot, 'vibe', 'templates');
    const globalTemplatesDir = path.join(globalVibeAssetsDir, 'templates');
    if (fs.existsSync(templatesSource)) {
      if (fs.existsSync(globalTemplatesDir)) {
        removeDirRecursive(globalTemplatesDir);
      }
      copyDirRecursive(templatesSource, globalTemplatesDir);
    }

    // languages 복사
    const languagesSource = path.join(packageRoot, 'languages');
    const globalLanguagesDir = path.join(globalVibeAssetsDir, 'languages');
    if (fs.existsSync(languagesSource)) {
      if (fs.existsSync(globalLanguagesDir)) {
        removeDirRecursive(globalLanguagesDir);
      }
      copyDirRecursive(languagesSource, globalLanguagesDir);
    }

    // 6. hooks는 프로젝트 레벨에서 관리 (vibe init/update에서 처리)
    // 전역 설정에는 훅을 등록하지 않음 - 프로젝트별 .claude/settings.local.json 사용

    // 7. Cursor IDE 지원 - ~/.cursor/agents/에 변환된 서브에이전트 설치
    const cursorAgentsDir = path.join(os.homedir(), '.cursor', 'agents');
    installCursorAgents(agentsSource, cursorAgentsDir);

    // 8. Cursor 프로젝트 룰 템플릿 생성 - ~/.cursor/rules-template/
    // 프로젝트별로 .cursor/rules/에 복사해서 사용
    const cursorRulesTemplateDir = path.join(os.homedir(), '.cursor', 'rules-template');
    generateCursorRules(cursorRulesTemplateDir);

    // 9. Cursor Skills 생성 - ~/.cursor/skills/
    // VIBE 커맨드를 Cursor 스킬로 변환
    const cursorSkillsDir = path.join(os.homedir(), '.cursor', 'skills');
    generateCursorSkills(cursorSkillsDir);

    console.log(`✅ vibe global setup complete: ${globalVibeDir}`);
    console.log(`✅ cursor agents installed: ${cursorAgentsDir}`);
    console.log(`✅ cursor rules template: ${cursorRulesTemplateDir}`);
    console.log(`✅ cursor skills installed: ${cursorSkillsDir}`);
  } catch (error) {
    // postinstall 실패해도 설치는 계속 진행
    console.warn('⚠️  vibe postinstall warning:', (error as Error).message);
  }
}

// Export functions for use in vibe init/update
export {
  installCursorAgents,
  generateCursorRules,
  generateCursorSkills,
  getVibeConfigDir,
};

// CLI로 직접 실행할 때만 main() 호출 (ESM entry point detection)
// import.meta.url과 process.argv[1]을 비교하여 직접 실행 여부 판단
const currentUrl = import.meta.url;
const isDirectRun = process.argv[1] && (
  currentUrl.includes(process.argv[1].replace(/\\/g, '/')) ||
  process.argv[1].includes('postinstall')
);

if (isDirectRun) {
  main();
}
