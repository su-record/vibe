/**
 * Skill Repository - ~/.claude/vibe/skills/ 저장소 관리
 *
 * 기본 스킬 세트를 전역 위치에 설치하고 관리
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { parseSkillFrontmatter, ParsedSkill, SkillMetadata } from './SkillFrontmatter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  path: string;
  source: 'user' | 'default';
  metadata?: SkillMetadata;
}

export interface SkillRepositoryConfig {
  userSkillsDir?: string;
  bundledSkillsDir?: string;
}

/**
 * 기본 전역 스킬 디렉토리 경로
 */
export function getGlobalSkillsDir(): string {
  return path.join(os.homedir(), '.claude', 'vibe', 'skills');
}

/**
 * 번들된 기본 스킬 디렉토리 (패키지 내부)
 */
export function getBundledSkillsDir(): string {
  // dist/lib/SkillRepository.js 기준 -> ../../skills
  const distPath = path.resolve(__dirname, '..', '..', 'skills');
  if (fs.existsSync(distPath)) {
    return distPath;
  }
  // 개발 환경: src/lib -> ../../skills
  return path.resolve(__dirname, '..', '..', 'skills');
}

/**
 * Skill Repository 클래스
 */
export class SkillRepository {
  private userSkillsDir: string;
  private bundledSkillsDir: string;

  constructor(config: SkillRepositoryConfig = {}) {
    this.userSkillsDir = config.userSkillsDir || getGlobalSkillsDir();
    this.bundledSkillsDir = config.bundledSkillsDir || getBundledSkillsDir();
  }

  /**
   * 스킬 디렉토리 초기화
   */
  ensureSkillsDir(): void {
    if (!fs.existsSync(this.userSkillsDir)) {
      fs.mkdirSync(this.userSkillsDir, { recursive: true });
    }
  }

  /**
   * 기본 스킬 세트 시딩 (없는 것만 복사)
   */
  seedDefaultSkills(): { seeded: string[]; skipped: string[]; errors: string[] } {
    this.ensureSkillsDir();

    const seeded: string[] = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    if (!fs.existsSync(this.bundledSkillsDir)) {
      errors.push(`Bundled skills directory not found: ${this.bundledSkillsDir}`);
      return { seeded, skipped, errors };
    }

    const entries = fs.readdirSync(this.bundledSkillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.md') && !entry.name.endsWith('.yaml') && !entry.name.endsWith('.yml')) {
        continue;
      }

      const srcPath = path.join(this.bundledSkillsDir, entry.name);
      const destPath = path.join(this.userSkillsDir, entry.name);

      try {
        if (fs.existsSync(destPath)) {
          skipped.push(entry.name);
          continue;
        }

        // Atomic write: temp file -> rename
        const tmpPath = destPath + '.tmp';
        const content = fs.readFileSync(srcPath, 'utf8');
        fs.writeFileSync(tmpPath, content, { flag: 'wx' });
        fs.renameSync(tmpPath, destPath);
        seeded.push(entry.name);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
          skipped.push(entry.name);
        } else {
          errors.push(`${entry.name}: ${(err as Error).message}`);
        }
      }
    }

    return { seeded, skipped, errors };
  }

  /**
   * 모든 스킬 목록 조회 (user + bundled fallback)
   */
  listSkills(): SkillInfo[] {
    const skills: Map<string, SkillInfo> = new Map();

    // 1. 번들 스킬 먼저 로드 (낮은 우선순위)
    if (fs.existsSync(this.bundledSkillsDir)) {
      this.loadSkillsFromDir(this.bundledSkillsDir, 'default', skills);
    }

    // 2. 유저 스킬 로드 (높은 우선순위, 덮어쓰기)
    if (fs.existsSync(this.userSkillsDir)) {
      this.loadSkillsFromDir(this.userSkillsDir, 'user', skills);
    }

    return Array.from(skills.values());
  }

  /**
   * 디렉토리에서 스킬 로드
   */
  private loadSkillsFromDir(
    dir: string,
    source: 'user' | 'default',
    skills: Map<string, SkillInfo>
  ): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.md') && !entry.name.endsWith('.yaml') && !entry.name.endsWith('.yml')) {
        continue;
      }

      const filePath = path.join(dir, entry.name);
      const id = entry.name.replace(/\.(md|yaml|yml)$/, '');

      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const parsed = parseSkillFrontmatter(content);

        const info: SkillInfo = {
          id,
          name: parsed?.metadata?.name || id,
          description: parsed?.metadata?.description || this.extractDescription(content),
          path: filePath,
          source,
          metadata: parsed?.metadata,
        };

        skills.set(id, info);
      } catch {
        // 파싱 실패한 스킬은 건너뜀
      }
    }
  }

  /**
   * 콘텐츠에서 설명 추출 (frontmatter 없는 경우)
   */
  private extractDescription(content: string): string {
    // description: 라인 찾기
    const match = content.match(/^description:\s*(.+)$/m);
    if (match) {
      return match[1].replace(/^["']|["']$/g, '');
    }

    // 첫 번째 문단 사용
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('---'));
    return lines[0]?.slice(0, 200) || 'No description';
  }

  /**
   * ID로 스킬 조회
   */
  getSkill(id: string): SkillInfo | null {
    // 유저 스킬 우선
    const userPath = this.findSkillFile(this.userSkillsDir, id);
    if (userPath) {
      return this.loadSkillInfo(userPath, id, 'user');
    }

    // 번들 스킬 fallback
    const bundledPath = this.findSkillFile(this.bundledSkillsDir, id);
    if (bundledPath) {
      return this.loadSkillInfo(bundledPath, id, 'default');
    }

    return null;
  }

  /**
   * 스킬 파일 찾기
   */
  private findSkillFile(dir: string, id: string): string | null {
    if (!fs.existsSync(dir)) return null;

    const extensions = ['.md', '.yaml', '.yml'];
    for (const ext of extensions) {
      const filePath = path.join(dir, id + ext);
      if (fs.existsSync(filePath)) {
        return filePath;
      }
    }
    return null;
  }

  /**
   * 스킬 정보 로드
   */
  private loadSkillInfo(filePath: string, id: string, source: 'user' | 'default'): SkillInfo | null {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = parseSkillFrontmatter(content);

      return {
        id,
        name: parsed?.metadata?.name || id,
        description: parsed?.metadata?.description || this.extractDescription(content),
        path: filePath,
        source,
        metadata: parsed?.metadata,
      };
    } catch {
      return null;
    }
  }

  /**
   * 스킬 콘텐츠 읽기
   */
  getSkillContent(id: string): string | null {
    const skill = this.getSkill(id);
    if (!skill) return null;

    try {
      return fs.readFileSync(skill.path, 'utf8');
    } catch {
      return null;
    }
  }

  /**
   * 유저 스킬 저장
   */
  saveSkill(id: string, content: string): void {
    this.ensureSkillsDir();
    const filePath = path.join(this.userSkillsDir, `${id}.md`);

    // Atomic write
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, content);
    fs.renameSync(tmpPath, filePath);
  }

  /**
   * 유저 스킬 삭제
   */
  deleteSkill(id: string): boolean {
    const userPath = this.findSkillFile(this.userSkillsDir, id);
    if (userPath) {
      fs.unlinkSync(userPath);
      return true;
    }
    return false;
  }

  /**
   * 트리거 기반 스킬 검색
   */
  findSkillsByTrigger(input: string): SkillInfo[] {
    const skills = this.listSkills();
    const lowerInput = input.toLowerCase();

    return skills.filter(skill => {
      if (!skill.metadata?.triggers) return false;
      return skill.metadata.triggers.some(trigger =>
        lowerInput.includes(trigger.toLowerCase())
      );
    });
  }

  /**
   * 저장소 경로 정보
   */
  getPaths(): { userDir: string; bundledDir: string } {
    return {
      userDir: this.userSkillsDir,
      bundledDir: this.bundledSkillsDir,
    };
  }
}

/**
 * 기본 스킬 세트 정의 (인라인)
 * postinstall에서 skills/ 폴더가 없을 때 사용
 */
export const DEFAULT_SKILLS: Array<{ id: string; content: string }> = [
  {
    id: 'multi-llm-orchestration',
    content: `---
name: multi-llm-orchestration
description: "Multi-LLM research using GPT and Gemini for comprehensive analysis"
triggers: [gpt, gemini, multi-llm, research, parallel research]
priority: 80
---
# Multi-LLM Orchestration

Use multiple LLMs for comprehensive research and validation.

## Usage

\`\`\`bash
# Via Bash hook (automatic in /vibe.spec)
node hooks/scripts/llm-orchestrate.js gpt "your prompt"
node hooks/scripts/llm-orchestrate.js gemini "your prompt"
\`\`\`

## Setup

\`\`\`bash
vibe gpt auth     # Configure GPT API key
vibe gemini auth  # Configure Gemini OAuth/API key
vibe status       # Check current configuration
\`\`\`

## Best Practices

1. Use GPT for best practices and code review
2. Use Gemini for documentation and security analysis
3. Combine results for comprehensive coverage
`,
  },
  {
    id: 'error-recovery',
    content: `---
name: error-recovery
description: "Error recovery patterns and retry strategies"
triggers: [error, fail, retry, recover, fix]
priority: 70
---
# Error Recovery Patterns

## Common Error Types

### Build Errors
- Check TypeScript compilation errors
- Verify dependency versions
- Run \`npm ci\` to clean install

### Test Failures
- Run failed tests in isolation
- Check test fixtures/mocks
- Verify async timing issues

### Runtime Errors
- Check stack trace carefully
- Verify environment variables
- Check external service connectivity

## Retry Strategy

1. First retry: Same action
2. Second retry: Clean state (cache clear)
3. Third retry: Alternative approach
4. Max retries exceeded: Escalate to user

## Auto-Recovery Commands

\`\`\`bash
# Clean build
rm -rf node_modules dist && npm ci && npm run build

# Reset git state (careful!)
git stash && git checkout .

# Clear caches
npm cache clean --force
\`\`\`
`,
  },
  {
    id: 'code-quality-check',
    content: `---
name: code-quality-check
description: "Code quality validation using vibe tools"
triggers: [quality, lint, complexity, review]
priority: 60
---
# Code Quality Check

## Using Vibe Tools

\`\`\`bash
# Analyze complexity
node -e "import('@su-record/vibe/tools').then(t =>
  t.analyzeComplexity({targetPath: 'src/', projectPath: process.cwd()})
  .then(r => console.log(r.content[0].text))
)"

# Validate quality
node -e "import('@su-record/vibe/tools').then(t =>
  t.validateCodeQuality({targetPath: 'src/', projectPath: process.cwd()})
  .then(r => console.log(r.content[0].text))
)"
\`\`\`

## Quality Metrics

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Cyclomatic Complexity | ≤10 | 11-15 | >15 |
| Function Length | ≤30 | 31-50 | >50 |
| Nesting Depth | ≤3 | 4 | >4 |

## Common Issues

1. **High Complexity**: Extract helper functions
2. **Long Functions**: Split by responsibility
3. **Deep Nesting**: Use early returns
4. **Tight Coupling**: Apply dependency injection
`,
  },
  {
    id: 'session-management',
    content: `---
name: session-management
description: "Context and session management across conversations"
triggers: [session, context, memory, save, restore, continue]
priority: 75
---
# Session Management

## Starting a Session

\`\`\`bash
# Auto-restore previous context
node -e "import('@su-record/vibe/tools').then(t =>
  t.startSession({projectPath: process.cwd()})
  .then(r => console.log(r.content[0].text))
)"
\`\`\`

## Saving Context

\`\`\`bash
# Save important decisions
node -e "import('@su-record/vibe/tools').then(t =>
  t.saveMemory({
    key: 'decision-auth-method',
    value: 'Using JWT with refresh tokens for auth',
    category: 'architecture',
    projectPath: process.cwd()
  }).then(r => console.log(r.content[0].text))
)"
\`\`\`

## Context Management

At 70%+ context usage:
1. Use \`saveMemory\` for important decisions
2. Start new session with \`/new\`
3. Previous context auto-restores

## Slash Command

\`\`\`
/vibe.utils --continue
\`\`\`

Restores previous session context automatically.
`,
  },
];

/**
 * 인라인 기본 스킬 시딩 (번들 폴더가 없을 때)
 */
export function seedInlineDefaultSkills(targetDir: string): { seeded: string[]; errors: string[] } {
  const seeded: string[] = [];
  const errors: string[] = [];

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  for (const skill of DEFAULT_SKILLS) {
    const destPath = path.join(targetDir, `${skill.id}.md`);

    if (fs.existsSync(destPath)) {
      continue; // 이미 존재하면 건너뜀
    }

    try {
      const tmpPath = destPath + '.tmp';
      fs.writeFileSync(tmpPath, skill.content, { flag: 'wx' });
      fs.renameSync(tmpPath, destPath);
      seeded.push(skill.id);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
        errors.push(`${skill.id}: ${(err as Error).message}`);
      }
    }
  }

  return { seeded, errors };
}

/**
 * 편의 함수: 기본 스킬 세트 설치
 */
export function ensureDefaultSkills(): { seeded: string[]; skipped: string[]; errors: string[] } {
  const repo = new SkillRepository();
  return repo.seedDefaultSkills();
}
