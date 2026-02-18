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
  installGlobalAssets,
  registerMcpServers
} from './GlobalInstaller.js';

// ProjectSetup
export {
  updateConstitution,
  updateClaudeMd,
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
