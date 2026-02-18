/**
 * init/update 공통 설정 함수 (re-export)
 */

// LanguageDetector
export { detectOsLanguage } from './setup/LanguageDetector.js';

// GlobalInstaller
export {
  getCoreConfigDir,
  installGlobalCorePackage,
  installGlobalAssets,
  registerMcpServers
} from './setup/GlobalInstaller.js';

// ProjectSetup
export {
  updateConstitution,
  updateClaudeMd,
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
