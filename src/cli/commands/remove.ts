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
  const legacyCocoVibe = path.join(projectRoot, '.coco', 'vibe');
  const legacyCoreDir = path.join(projectRoot, '.core');
  const claudeDir = path.join(projectRoot, '.claude');

  const hasAny = fs.existsSync(vibeDir) || fs.existsSync(legacyClaudeVibe) ||
                 fs.existsSync(legacyCocoVibe) || fs.existsSync(legacyCoreDir);
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

  // 레거시 `.claude/vibe/`, `.coco/vibe/` 제거
  if (fs.existsSync(legacyClaudeVibe)) {
    removeDirRecursive(legacyClaudeVibe);
    console.log('   ✅ .claude/vibe/ removed (legacy)\n');
  }
  if (fs.existsSync(legacyCocoVibe)) {
    removeDirRecursive(legacyCocoVibe);
    console.log('   ✅ .coco/vibe/ removed (legacy)\n');
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
    const coreAgents = ['simplifier.md', 'explorer.md', 'implementer.md', 'tester.md', 'searcher.md'];
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

  // Cursor agents 제거 (12 reviewers)
  const cursorAgentsDir = path.join(cursorDir, 'agents');
  if (fs.existsSync(cursorAgentsDir)) {
    const coreReviewers = [
      'security-reviewer.md', 'architecture-reviewer.md', 'data-integrity-reviewer.md',
      'typescript-reviewer.md', 'python-reviewer.md', 'react-reviewer.md', 'rails-reviewer.md',
      'performance-reviewer.md', 'complexity-reviewer.md', 'simplicity-reviewer.md',
      'test-coverage-reviewer.md', 'git-history-reviewer.md'
    ];
    let removedAgents = 0;
    coreReviewers.forEach(agent => {
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
  - Subagents (5)
  - Hooks settings
  - Cursor agents (12)
  - Cursor skills (7)
  - Cursor rules template (5)

To reinstall: vibe init
  `);
}
