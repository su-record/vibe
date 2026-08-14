/**
 * SPEC Generator - PRD에서 PTCF 구조 SPEC 자동 생성
 *
 * PTCF: Persona, Task, Context, Format (LLM 프롬프트 최적화)
 */
import { ParsedPRD } from './prdParser.js';
/** SPEC 생성 옵션 */
export interface SpecGeneratorOptions {
    /** 기술 스택 */
    techStack?: string[];
    /** Phase 자동 분리 임계값 (요구사항 수) */
    phaseThreshold?: number;
    /** 관련 코드 경로 */
    relatedCodePaths?: string[];
    /** 디자인 레퍼런스 */
    designReference?: string;
    /** 제약 조건 추가 */
    additionalConstraints?: string[];
    /** 출력 형식 추가 */
    additionalOutputs?: string[];
    /** 컨텍스트 출처 */
    contextSources?: string[];
    /** 확인 없이 채택한 가정 */
    assumptions?: string[];
    /** 완료를 증명할 산출물 */
    evidenceRequired?: EvidenceRequirement[];
    /** 출시 시 사람이 판단할 비차단 기준 */
    humanTaste?: string[];
}
export interface EvidenceRequirement {
    criterionId: string;
    evidence: string;
}
/** 생성된 SPEC */
export interface GeneratedSpec {
    content: string;
    featureName: string;
    phaseCount: number;
    requirementCount: number;
    isSplit: boolean;
    splitFiles?: {
        path: string;
        content: string;
    }[];
}
/**
 * PRD에서 SPEC 생성 (메인 함수)
 */
export declare function generateSpec(prd: ParsedPRD, featureName: string, options?: SpecGeneratorOptions): GeneratedSpec;
//# sourceMappingURL=specGenerator.d.ts.map