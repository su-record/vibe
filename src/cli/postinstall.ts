#!/usr/bin/env node
/**
 * postinstall 스크립트 (re-export)
 */

// Export functions for use in vibe init/update
export {
  installCursorAgents,
  installClaudeAgents,
  generateCursorRules,
  generateCursorSkills,
  getCoreConfigDir,
  STACK_TO_LANGUAGE_FILE,
  GLOBAL_SKILLS,
  STACK_TO_SKILLS,
  COMMERCE_SKILLS,
  resolveLocalSkills,
  copySkillsFiltered,
} from './postinstall/index.js';

// CLI 엔트리 포인트 - main.ts에서 직접 실행 감지 처리
import './postinstall/main.js';
