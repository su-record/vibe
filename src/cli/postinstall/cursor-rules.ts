/**
 * Cursor 룰 변환 및 생성
 */

import path from 'path';
import fs from 'fs';
import { ensureDir } from './fs-utils.js';
import {
  STACK_TO_LANGUAGE_FILE,
  LANGUAGE_GLOBS,
  LANGUAGE_RULE_PREFIXES,
  LEGACY_RULE_FILES,
} from './constants.js';

/**
 * VIBE 언어 룰 파일을 Cursor .mdc 형식으로 변환
 */
function convertLanguageRuleToCursor(content: string, filename: string): string {
  // Windows CRLF → LF 정규화
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 제목 추출
  const titleMatch = normalizedContent.match(/^# (.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : filename.replace('.md', '');

  // 설명 생성 - 제목에서 "Quality Rules" 제거하고 간결하게
  const description = title
    .replace(' Quality Rules', ' coding standards')
    .replace(' Specific Rules', ' best practices');

  // glob 패턴 가져오기
  const globs = LANGUAGE_GLOBS[filename] || '**/*';

  // .mdc frontmatter + 본문
  return `---
description: ${description} - complexity limits, type safety, error handling
globs: "${globs}"
alwaysApply: false
---

${normalizedContent}
`;
}

/**
 * VIBE 언어 룰 디렉토리에서 .mdc 파일 생성
 * @param languagesDir - VIBE 언어 룰 디렉토리 (~/.claude/vibe/languages/ 또는 패키지 내 languages/)
 * @param outputDir - Cursor 룰 출력 디렉토리 (~/.cursor/rules-template/)
 * @param detectedStacks - 감지된 기술 스택 배열 (예: ['typescript-react', 'python-fastapi'])
 * @returns 생성된 파일 수
 */
function generateCursorRulesFromCoreLanguages(
  languagesDir: string,
  outputDir: string,
  detectedStacks: string[] = []
): number {
  if (!fs.existsSync(languagesDir)) {
    return 0;
  }

  ensureDir(outputDir);

  // 감지된 스택에 해당하는 언어 파일 결정
  const targetFiles = new Set<string>();

  if (detectedStacks.length === 0) {
    // 스택 감지 없으면 공통 룰만 생성 (hardcoded fallback)
    return 0;
  }

  for (const stack of detectedStacks) {
    const languageFile = STACK_TO_LANGUAGE_FILE[stack.toLowerCase()];
    if (languageFile) {
      targetFiles.add(languageFile);
    }
  }

  let generated = 0;

  for (const file of targetFiles) {
    const sourcePath = path.join(languagesDir, file);
    if (!fs.existsSync(sourcePath)) {
      continue;
    }

    try {
      const content = fs.readFileSync(sourcePath, 'utf-8');
      const mdcContent = convertLanguageRuleToCursor(content, file);
      const destPath = path.join(outputDir, file.replace('.md', '.mdc'));
      fs.writeFileSync(destPath, mdcContent, 'utf-8');
      generated++;
    } catch {
      // 무시 - 파일 읽기/쓰기 실패
    }
  }

  return generated;
}

/**
 * Cursor 프로젝트 룰 템플릿 생성 (VIBE 언어 룰 기반)
 * @param cursorRulesDir - 룰 파일 저장 경로
 * @param detectedStacks - 감지된 기술 스택 배열 (예: ['typescript-react', 'python-fastapi'])
 * @param languagesDir - VIBE 언어 룰 디렉토리 (optional)
 */
export function generateCursorRules(
  cursorRulesDir: string,
  detectedStacks: string[] = [],
  languagesDir?: string
): void {
  ensureDir(cursorRulesDir);

  // 0. 기존 언어 룰 + 레거시 파일 정리
  try {
    const existingFiles = fs.readdirSync(cursorRulesDir).filter(f => f.endsWith('.mdc'));
    for (const file of existingFiles) {
      const isLanguageRule = LANGUAGE_RULE_PREFIXES.some(prefix => file.startsWith(prefix));
      const isLegacy = LEGACY_RULE_FILES.includes(file);
      if (isLanguageRule || isLegacy) {
        fs.unlinkSync(path.join(cursorRulesDir, file));
      }
    }
  } catch {
    // 무시
  }

  // 1. VIBE 언어 룰에서 .mdc 생성 시도
  let coreRulesGenerated = 0;
  if (languagesDir && detectedStacks.length > 0) {
    coreRulesGenerated = generateCursorRulesFromCoreLanguages(
      languagesDir,
      cursorRulesDir,
      detectedStacks
    );
  }

  // 2. 공통 룰 (모든 프로젝트에 적용)
  const commonRules = [
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

## Complexity Limits
| Metric | Limit |
|--------|-------|
| Function length | ≤30 lines (recommended), ≤50 lines (max) |
| Nesting depth | ≤3 levels |
| Parameters | ≤5 |
| Cyclomatic complexity | ≤10 |

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
globs: "**/*.ts,**/*.tsx,**/*.js,**/*.jsx,**/*.py,**/*.go,**/*.rs,**/*.java,**/*.kt,**/*.swift"
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
  ];

  let commonUpdated = 0;
  for (const rule of commonRules) {
    const destPath = path.join(cursorRulesDir, rule.filename);
    try {
      fs.writeFileSync(destPath, rule.content, 'utf-8');
      commonUpdated++;
    } catch {
      // 무시 - 권한 문제 등
    }
  }

  const totalUpdated = coreRulesGenerated + commonUpdated;
  const stackInfo = detectedStacks.length > 0 ? ` (${detectedStacks.slice(0, 3).join(', ')}${detectedStacks.length > 3 ? '...' : ''})` : '';
  console.log(`   📏 Cursor rules: ${totalUpdated} updated (${coreRulesGenerated} language + ${commonUpdated} common)${stackInfo}`);
}
