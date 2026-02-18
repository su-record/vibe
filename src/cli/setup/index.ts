/**
 * Setup Module - CLI Setup 기능 모듈화
 */

// LanguageDetector
export {
  detectOsLanguage,
  getLanguageInstruction,
  SupportedLanguage
} from './LanguageDetector.js';

// GlobalInstaller
export {
  getCoreConfigDir,
  installGlobalCorePackage,
  registerMcpServers
} from './GlobalInstaller.js';

// ProjectSetup
export {
  updateConstitution,
  updateRules,
  installProjectHooks,
  updateGitignore,
  updateConfig
} from './ProjectSetup.js';

export {
  migrateLegacyCore,
  cleanupLegacy,
  removeLocalAssets,
  cleanupClaudeConfig,
  cleanupLegacyMcp
} from './LegacyMigration.js';
