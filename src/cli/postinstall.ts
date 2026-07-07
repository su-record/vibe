#!/usr/bin/env node
/**
 * postinstall 스크립트 (re-export)
 */

// Export functions for use in vibe init/update
export {
  getCoreConfigDir,
  copySkillsFiltered,
  applyCodexSkillInvocationPolicies,
  removeLegacySkills,
} from './postinstall/fs-utils.js';
export {
  STACK_TO_LANGUAGE_FILE,
  GLOBAL_SKILLS,
  STACK_TO_SKILLS,
  CAPABILITY_SKILLS,
  AVAILABLE_CAPABILITIES,
  resolveLocalSkills,
  resolveLocalAgentGroups,
  CONDITIONAL_AGENT_GROUPS,
  LEGACY_AGENT_GROUPS,
} from './postinstall/constants.js';
export { generateCursorRules } from './postinstall/cursor-rules.js';
export { installCursorAgents } from './postinstall/cursor-agents.js';
export { installClaudeAgents } from './postinstall/claude-agents.js';
export { generateCursorSkills } from './postinstall/cursor-skills.js';

// CLI 엔트리 포인트 - main.ts에서 직접 실행 감지 처리
import './postinstall/main.js';
