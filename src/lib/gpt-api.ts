/**
 * GPT API 호출
 *
 * v0.0.4: 관심사별 모듈 분리
 * - gpt/auth: 인증 관리
 * - gpt/chat: 채팅 API
 * - gpt/specializations: 아키텍처 분석, 디버깅
 * - gpt/orchestration: Core 오케스트레이션
 *
 * 이 파일은 하위 호환성을 위해 모든 함수를 re-export
 */

export * from './gpt/index.js';
