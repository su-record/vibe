/**
 * LLM 인증 관련 함수 (config.json 기반)
 */
import { LLMAuthStatus, LLMStatusMap, ClaudeCodeStatus } from './types.js';
/**
 * LLM 인증 상태 확인 (config.json 우선, process.env fallback)
 */
export declare function getLLMAuthStatus(): LLMStatusMap;
/**
 * Claude Code CLI 설치 및 인증 상태 확인
 *
 * @param checkAuth - true이면 실제 API 호출로 인증까지 검증 (vibe init용), false이면 CLI 존재만 확인 (postinstall용)
 * @returns Claude Code 상태 객체
 */
export declare function getClaudeCodeStatus(checkAuth?: boolean): ClaudeCodeStatus;
/**
 * Claude Code 상태 포맷팅
 */
export declare function formatClaudeCodeStatus(status: ClaudeCodeStatus): string;
/**
 * LLM 상태 포맷팅
 */
export declare function formatAuthMethods(auths: LLMAuthStatus[], cliInstalled?: boolean): string;
/**
 * 통합 LLM/CLI 상태 포맷터 (status / init / update / upgrade 공용)
 * - LLM CLI (vibe 멀티-오케스트레이션에서 호출 가능): Claude Code, Codex, Antigravity
 * - LLM API Key (직접 호출용): GPT, Antigravity
 */
export declare function formatLLMStatus(): string;
//# sourceMappingURL=auth.d.ts.map