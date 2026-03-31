/**
 * postinstall 모듈
 *
 * 관심사별 모듈 분리:
 * - fs-utils: 파일시스템 유틸리티
 * - global-config: 전역 설정 관리
 * - constants: 상수 데이터
 * - inline-skills: 인라인 스킬 시딩
 * - cursor-rules: Cursor 룰 변환/생성
 * - cursor-agents: Cursor 에이전트 변환/설치
 * - claude-agents: Claude Code 네이티브 에이전트 변환/설치
 * - cursor-skills: Cursor 스킬 생성
 * - main: 메인 오케스트레이션
 */

export { getCoreConfigDir, replaceTemplatesInDir } from './fs-utils.js';
export { STACK_TO_LANGUAGE_FILE, GLOBAL_SKILLS, STACK_TO_SKILLS, CAPABILITY_SKILLS, AVAILABLE_CAPABILITIES, resolveLocalSkills, resolveExternalSkills } from './constants.js';
export { copySkillsFiltered } from './fs-utils.js';
export { generateCursorRules } from './cursor-rules.js';
export { installCursorAgents } from './cursor-agents.js';
export { installClaudeAgents } from './claude-agents.js';
export { generateCursorSkills } from './cursor-skills.js';
export { installCodexPlugin, installCodexAgents } from './codex-agents.js';
export { generateCodexAgentsMd } from './codex-instruction.js';
export { installGeminiAgents } from './gemini-agents.js';
export { generateGeminiMd } from './gemini-instruction.js';
export { main } from './main.js';
