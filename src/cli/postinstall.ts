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

    console.log(`✅ vibe global setup complete: ${globalVibeDir}`);
  } catch (error) {
    // postinstall 실패해도 설치는 계속 진행
    console.warn('⚠️  vibe postinstall warning:', (error as Error).message);
  }
}

main();
