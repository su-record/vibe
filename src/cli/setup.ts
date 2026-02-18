/**
 * init/update 공통 설정 함수 (re-export)
 */

// LanguageDetector
export { detectOsLanguage } from './setup/LanguageDetector.js';

// GlobalInstaller
export {
  getCoreConfigDir,
  installGlobalCorePackage,
  registerMcpServers
} from './setup/GlobalInstaller.js';

// ProjectSetup
export {
  updateConstitution,
  updateRules,
  installProjectHooks,
  updateGitignore,
  updateConfig,
  installCursorRules
} from './setup/ProjectSetup.js';

export {
  migrateLegacyCore,
  cleanupLegacy,
  removeLocalAssets,
  cleanupClaudeConfig,
  cleanupLegacyMcp
} from './setup/LegacyMigration.js';
