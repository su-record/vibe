/**
 * ZAI (Z.ai / GLM) 오케스트레이션 함수
 */
import type { VibeZaiOptions } from './types.js';
/**
 * Core ZAI 오케스트레이션 (결정론적, 선택적 JSON 모드)
 * coding 키가 있으면 자동으로 GLM Coding Plan 을 사용한다.
 */
export declare function coreZaiOrchestrate(prompt: string, systemPrompt: string, options?: VibeZaiOptions): Promise<string>;
/**
 * UI 개발 전용 — GLM 최고 모델(coding plan) 로 실행.
 * "zai 사용 가능 시 모든 UI 개발은 GLM 최고 모델이 담당" 정책의 실행 지점.
 */
export declare function coreZaiUiImplement(prompt: string, systemPrompt?: string): Promise<string>;
//# sourceMappingURL=orchestration.d.ts.map