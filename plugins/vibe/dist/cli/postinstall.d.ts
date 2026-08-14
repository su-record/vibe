#!/usr/bin/env node
/**
 * postinstall 스크립트 (re-export)
 */
export { getCoreConfigDir, copySkillsFiltered, applyCodexSkillInvocationPolicies, removeLegacySkills, } from './postinstall/fs-utils.js';
export { STACK_TO_LANGUAGE_FILE, GLOBAL_SKILLS, STACK_TO_SKILLS, CAPABILITY_SKILLS, AVAILABLE_CAPABILITIES, resolveLocalSkills, resolveLocalAgentGroups, CONDITIONAL_AGENT_GROUPS, LEGACY_AGENT_GROUPS, } from './postinstall/constants.js';
export { installClaudeAgents } from './postinstall/claude-agents.js';
import './postinstall/main.js';
//# sourceMappingURL=postinstall.d.ts.map