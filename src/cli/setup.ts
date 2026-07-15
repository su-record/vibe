/**
 * init/update 공통 설정 함수 (re-export)
 */

// LanguageDetector
export { detectOsLanguage } from './setup/LanguageDetector.js';

// GlobalInstaller
export {
  getCoreConfigDir,
} from './setup/GlobalInstaller.js';

// ProjectSetup
export {
  updateConstitution,
  updateRules,
  installProjectHooks,
  installCodexNotify,
  updateGitignore,
  updateConfig,
  installCursorRules,
  generateProjectClaudeMd,
  generateProjectAgentsMd,
  generateProjectAntigravityMd,
  generateGlobalClaudeMd,
  generateGlobalCodexAgentsMd,
  generateGlobalAntigravityMd,
} from './setup/ProjectSetup.js';

export {
  buildCodexHooksConfig,
  installProjectCodexHooks,
} from './setup/CodexHooks.js';

export {
  migrateLegacyCore,
  consolidateLegacyVibe,
  cleanupLegacy,
  removeLocalAssets,
  cleanupClaudeConfig,
  cleanupLegacyMcp
} from './setup/LegacyMigration.js';
