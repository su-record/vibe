#!/usr/bin/env node
/**
 * postinstall 스크립트
 *
 * v0.0.4: 관심사별 모듈 분리
 * - postinstall/fs-utils: 파일시스템 유틸리티
 * - postinstall/global-config: 전역 설정 관리
 * - postinstall/constants: 상수 데이터
 * - postinstall/inline-skills: 인라인 스킬 시딩
 * - postinstall/cursor-rules: Cursor 룰 변환/생성
 * - postinstall/cursor-agents: Cursor 에이전트 변환/설치
 * - postinstall/cursor-skills: Cursor 스킬 생성
 * - postinstall/main: 메인 오케스트레이션
 *
 * 이 파일은 하위 호환성을 위해 export + CLI 엔트리 포인트 유지
 */

// Export functions for use in vibe init/update
export {
  installCursorAgents,
  generateCursorRules,
  generateCursorSkills,
  getCoreConfigDir,
  STACK_TO_LANGUAGE_FILE,
} from './postinstall/index.js';

// CLI 엔트리 포인트 - main.ts에서 직접 실행 감지 처리
import './postinstall/main.js';
