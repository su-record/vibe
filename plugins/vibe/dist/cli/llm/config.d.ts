/**
 * LLM 설정 관리
 * config.json 통합 방식 (v2)
 */
import { ExternalLLMConfig } from '../types.js';
export { getGlobalConfigDir } from '../../infra/lib/llm/auth/ConfigManager.js';
/**
 * 외부 LLM 설정
 */
export declare const EXTERNAL_LLMS: Record<string, ExternalLLMConfig>;
/**
 * 외부 LLM API 키로 설정 → config.json에 저장
 */
export declare function setupExternalLLM(llmType: string, apiKey: string): void;
/**
 * 외부 LLM 제거 (config.json에서 삭제 + 프로젝트 비활성화)
 */
export declare function removeExternalLLM(llmType: string): void;
//# sourceMappingURL=config.d.ts.map