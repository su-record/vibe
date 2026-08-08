/**
 * remove 명령어
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { removeDirRecursive } from '../utils.js';

/**
 * remove 명령어 실행
 */
export function remove(): void {
  const projectRoot = process.cwd();
  const vibeDir = path.join(projectRoot, '.vibe');
  const legacyClaudeVibe = path.join(projectRoot, '.claude', 'vibe');
  const legacyCoreDir = path.join(projectRoot, '.core');
  const claudeDir = path.join(projectRoot, '.claude');

  const hasAny = fs.existsSync(vibeDir) || fs.existsSync(legacyClaudeVibe) ||
                 fs.existsSync(legacyCoreDir);
  if (!hasAny) {
    console.log('❌ Not a vibe project.');
    return;
  }

  console.log('🗑️  Removing vibe...\n');

  // .vibe 폴더 제거 (SSOT)
  if (fs.existsSync(vibeDir)) {
    removeDirRecursive(vibeDir);
    console.log('   ✅ .vibe/ removed\n');
  }

  // 레거시 `.claude/vibe/` 제거
  if (fs.existsSync(legacyClaudeVibe)) {
    removeDirRecursive(legacyClaudeVibe);
    console.log('   ✅ .claude/vibe/ removed (legacy)\n');
  }

  // 레거시 .core 폴더도 제거
  if (fs.existsSync(legacyCoreDir)) {
    removeDirRecursive(legacyCoreDir);
    console.log('   ✅ .core/ removed (legacy)\n');
  }

  // .claude/commands 제거
  const commandsDir = path.join(claudeDir, 'commands');
  if (fs.existsSync(commandsDir)) {
    const coreCommands = ['vibe.spec.md', 'vibe.run.md', 'vibe.verify.md', 'vibe.reason.md', 'vibe.analyze.md', 'vibe.utils.md', 'vibe.review.md', 'vibe.trace.md', 'vibe.spec.review.md', 'core.spec.md', 'core.run.md', 'core.verify.md', 'core.reason.md', 'core.analyze.md', 'core.ui.md', 'core.diagram.md'];
    coreCommands.forEach(cmd => {
      const cmdPath = path.join(commandsDir, cmd);
      if (fs.existsSync(cmdPath)) {
        fs.unlinkSync(cmdPath);
      }
    });
    console.log('   ✅ Slash commands removed\n');
  }

  // .claude/agents 제거
  const agentsDir = path.join(claudeDir, 'agents');
  if (fs.existsSync(agentsDir)) {
    const coreAgents = [
      'architect.md', 'implementer.md', 'tester.md', 'acceptance-tester.md', 'e2e-tester.md',
      'code-reviewer.md', 'security-reviewer.md', 'build-error-resolver.md', 'documenter.md', 'diagrammer.md'
    ];
    coreAgents.forEach(agent => {
      const agentPath = path.join(agentsDir, agent);
      if (fs.existsSync(agentPath)) {
        fs.unlinkSync(agentPath);
      }
    });
    console.log('   ✅ Subagents removed\n');
  }

  // .claude/settings.json에서 hooks 제거
  const settingsPath = path.join(claudeDir, 'settings.json');
  if (fs.existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      if (settings.hooks) {
        delete settings.hooks;
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        console.log('   ✅ Hooks removed\n');
      }
    } catch { /* ignore: optional operation */ }
  }

  // Cursor 글로벌 에셋 제거
  const cursorDir = path.join(os.homedir(), '.cursor');

  // Cursor agents 제거 — 현행 2종 + 리뷰어 통합 이전에 깔린 레거시까지.
  //
  // 목록이 현행 2종뿐이라 구버전에서 설치된 11종이 영구 잔여물로 남아 있었다
  // (실측: 설치본에 13개). vibe 는 더 이상 Cursor 자산을 설치하지 않으므로
  // 이 목록이 유일한 회수 수단이다 — 놓치면 되돌릴 방법이 없다.
  const cursorAgentsDir = path.join(cursorDir, 'agents');
  if (fs.existsSync(cursorAgentsDir)) {
    const vibeReviewers = [
      'code-reviewer.md', 'security-reviewer.md',
      // 통합 이전 레거시
      'architecture-reviewer.md', 'complexity-reviewer.md', 'data-integrity-reviewer.md',
      'git-history-reviewer.md', 'performance-reviewer.md', 'python-reviewer.md',
      'rails-reviewer.md', 'react-reviewer.md', 'simplicity-reviewer.md',
      'test-coverage-reviewer.md', 'typescript-reviewer.md',
    ];
    let removedAgents = 0;
    vibeReviewers.forEach(agent => {
      const agentPath = path.join(cursorAgentsDir, agent);
      if (fs.existsSync(agentPath)) {
        fs.unlinkSync(agentPath);
        removedAgents++;
      }
    });
    if (removedAgents > 0) {
      console.log(`   ✅ Cursor agents removed (${removedAgents})\n`);
    }
  }

  // Cursor skills 제거 (7 core skills)
  const cursorSkillsDir = path.join(cursorDir, 'skills');
  if (fs.existsSync(cursorSkillsDir)) {
    const coreSkills = ['su-spec', 'su-run', 'su-review', 'su-analyze', 'su-verify', 'su-reason', 'su-ui'];
    let removedSkills = 0;
    coreSkills.forEach(skill => {
      const skillDir = path.join(cursorSkillsDir, skill);
      if (fs.existsSync(skillDir)) {
        removeDirRecursive(skillDir);
        removedSkills++;
      }
    });
    if (removedSkills > 0) {
      console.log(`   ✅ Cursor skills removed (${removedSkills})\n`);
    }
  }

  // Cursor rules template 제거 (5 rules)
  const cursorRulesDir = path.join(cursorDir, 'rules-template');
  if (fs.existsSync(cursorRulesDir)) {
    const coreRules = [
      'typescript-standards.mdc', 'react-patterns.mdc', 'code-quality.mdc',
      'security-checklist.mdc', 'python-standards.mdc'
    ];
    let removedRules = 0;
    coreRules.forEach(rule => {
      const rulePath = path.join(cursorRulesDir, rule);
      if (fs.existsSync(rulePath)) {
        fs.unlinkSync(rulePath);
        removedRules++;
      }
    });
    if (removedRules > 0) {
      console.log(`   ✅ Cursor rules template removed (${removedRules})\n`);
    }
  }

  console.log(`
✅ vibe removed!

Removed:
  - MCP server (context7)
  - .claude/vibe/ folder
  - Slash commands (7)
  - Subagents (10)
  - Hooks settings
  - Cursor assets (agents / skills / rules-template — 레거시 포함)

To reinstall: vibe init
  `);
}
