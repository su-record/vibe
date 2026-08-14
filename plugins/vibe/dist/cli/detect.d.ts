/**
 * 기술 스택 감지
 */
import { DetectionResult } from './types.js';
/**
 * 프로젝트 기술 스택 감지
 */
export declare function detectTechStacks(projectRoot: string): DetectionResult;
/**
 * 스택 타입에 대한 이름 매핑
 */
export declare const STACK_NAMES: Record<string, {
    name: string;
    lang: string;
    framework: string;
}>;
/**
 * 스택에 맞는 언어 규칙 파일 목록 반환
 */
export declare function getLanguageRulesForStacks(stacks: Array<{
    type: string;
    path: string;
}>): string;
/**
 * 언어별 CLAUDE.md 규칙
 */
export declare const LANGUAGE_RULES: Record<string, string>;
/**
 * 스택에 맞는 언어 규칙 내용 반환
 */
export declare function getLanguageRulesContent(stacks: Array<{
    type: string;
    path: string;
}>): string;
//# sourceMappingURL=detect.d.ts.map