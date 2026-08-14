export type SpecFindingSeverity = 'P1' | 'P2';
export interface SpecFinding {
    severity: SpecFindingSeverity;
    code: string;
    message: string;
    /** 1-indexed. 문서 전체에 걸린 문제면 생략 */
    line?: number;
}
export interface SpecValidationResult {
    /** P1 이 하나도 없으면 통과 — P2 는 통과를 막지 않는다 */
    valid: boolean;
    findings: SpecFinding[];
    /** 문서에서 발견한 REQ ID 목록 (중복 제거) */
    requirementIds: string[];
}
/** 파일명에서 feature 슬러그를 뽑는다 (분할 SPEC 은 디렉토리명) */
export declare function featureSlugFromPath(specPath: string): string;
/**
 * SPEC 문서를 검사한다.
 *
 * @param content SPEC 마크다운 원문
 * @param options.specPath 파일 경로 — 주면 REQ 슬러그와 파일명 일치까지 검사한다
 * @returns P1 이 없으면 valid
 */
export declare function validateSpecDocument(content: string, options?: {
    specPath?: string;
}): SpecValidationResult;
/** 사람이 읽는 한 줄 요약 — 스킬이 그대로 출력한다 */
export declare function formatSpecValidation(result: SpecValidationResult): string;
//# sourceMappingURL=validateSpecDocument.d.ts.map