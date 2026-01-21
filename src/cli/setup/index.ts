/**
 * Setup Module - CLI Setup 기능 모듈화
 *
 * v2.6.0: setup.ts 기능을 4개 모듈로 분리
 * - LanguageDetector: OS 언어 감지
 * - GlobalInstaller: 전역 패키지/자산 설치
 * - ProjectSetup: 프로젝트 레벨 설정
 * - LegacyMigration: 레거시 마이그레이션/정리
 */

// LanguageDetector
export {
  detectOsLanguage,
  getLanguageInstruction,
  SupportedLanguage
} from './LanguageDetector.js';

// GlobalInstaller
export {
  getVibeConfigDir,
  installGlobalVibePackage,
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

// LegacyMigration
export {
  migrateLegacyVibe,
  cleanupLegacy,
  removeLocalAssets,
  cleanupClaudeConfig,
  cleanupLegacyMcp
} from './LegacyMigration.js';
