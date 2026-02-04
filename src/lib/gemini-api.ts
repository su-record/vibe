/**
 * Gemini API 호출
 *
 * v0.0.4: 관심사별 모듈 분리
 * - gemini/auth: 인증 관리
 * - gemini/chat: 채팅 API
 * - gemini/capabilities: 웹 검색, 이미지 생성/분석
 * - gemini/orchestration: Core 오케스트레이션
 *
 * 이 파일은 하위 호환성을 위해 모든 함수를 re-export
 */

export * from './gemini/index.js';
