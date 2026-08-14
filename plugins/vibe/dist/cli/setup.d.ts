/**
 * init/update 공통 설정 함수 (re-export)
 */
export { detectOsLanguage } from './setup/LanguageDetector.js';
export { getCoreConfigDir, } from './setup/GlobalInstaller.js';
export { updateConstitution, updateRules, installProjectHooks, installCodexNotify, updateGitignore, updateConfig, generateProjectClaudeMd, generateProjectAgentsMd, generateProjectAntigravityMd, generateGlobalClaudeMd, generateGlobalCodexAgentsMd, generateGlobalAntigravityMd, } from './setup/ProjectSetup.js';
export { buildCodexHooksConfig, installProjectCodexHooks, } from './setup/CodexHooks.js';
export { migrateLegacyCore, consolidateLegacyVibe, cleanupLegacy, removeLocalAssets, cleanupClaudeConfig, cleanupLegacyMcp } from './setup/LegacyMigration.js';
//# sourceMappingURL=setup.d.ts.map