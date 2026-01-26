/**
 * init/update 공통 설정 함수
 *
 * v2.6.0: 기능이 4개 모듈로 분리됨
 * - setup/LanguageDetector: OS 언어 감지
 * - setup/GlobalInstaller: 전역 패키지/자산 설치
 * - setup/ProjectSetup: 프로젝트 레벨 설정
 * - setup/LegacyMigration: 레거시 마이그레이션/정리
 *
 * 이 파일은 하위 호환성을 위해 모든 함수를 re-export
 */

// LanguageDetector
export { detectOsLanguage } from './setup/LanguageDetector.js';

// GlobalInstaller
export {
  getVibeConfigDir,
  installGlobalVibePackage,
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

// LegacyMigration
export {
  migrateLegacyVibe,
  cleanupLegacy,
  removeLocalAssets,
  cleanupClaudeConfig,
  cleanupLegacyMcp
} from './setup/LegacyMigration.js';
