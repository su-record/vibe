/**
 * Core GPT 오케스트레이션 함수
 */
import type { VibeGptOptions } from './types.js';
/**
 * Core GPT 오케스트레이션 (검색 없음, JSON 모드)
 * - 검색 제외로 빠른 응답
 * - temperature=0 으로 결정론적 결과
 * - JSON 출력 강제 가능
 */
export declare function coreGptOrchestrate(prompt: string, systemPrompt: string, options?: VibeGptOptions): Promise<string>;
/**
 * Core Spec 파싱 (Core Spec → 실행 계획)
 */
export declare function coreGptParseSpec(spec: string): Promise<string>;
/**
 * Core 실행 계획 수립 (Task → Steps)
 */
export declare function coreGptPlanExecution(task: string, context: string): Promise<string>;
/**
 * Core 코드 분석 (빠른 구조 분석)
 */
export declare function coreGptAnalyze(code: string, question: string): Promise<string>;
/**
 * Core 다음 액션 결정 (상태 기반)
 */
export declare function coreGptDecideNextAction(currentState: string, availableActions: string[], goal: string): Promise<string>;
//# sourceMappingURL=orchestration.d.ts.map