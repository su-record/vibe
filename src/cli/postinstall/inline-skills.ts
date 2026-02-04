/**
 * 인라인 기본 스킬 시딩
 */

import path from 'path';
import fs from 'fs';
import { ensureDir } from './fs-utils.js';

/**
 * 인라인 기본 스킬 시딩 (번들에 없는 추가 스킬)
 */
export function seedInlineSkills(targetDir: string): void {
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
        'description: "Code quality validation using core tools"',
        'triggers: [quality, lint, complexity, review]',
        'priority: 60',
        '---',
        '# Code Quality Check',
        '',
        '## Using Core Tools',
        '',
        '```bash',
        '# Analyze complexity',
        "node -e \"import('@su-record/core/tools').then(t =>",
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
