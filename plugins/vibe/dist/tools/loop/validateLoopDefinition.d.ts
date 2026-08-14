/**
 * Loop Definition Validator — 루프 정의 파일(.vibe/loops/<name>.md) 검증.
 *
 * frontmatter 필수 필드, enum 값, max_iterations 범위(1–50),
 * 조건부 필드(schedule, test_command)를 결정론적으로 검증한다.
 */
export type LoopTrigger = 'scheduled' | 'manual' | 'on-event';
export type LoopVerify = 'ledger' | 'tests' | 'none';
export type LoopIsolation = 'worktree' | 'none';
export type LoopStatus = 'active' | 'paused';
/** 파싱된 루프 정의 */
export interface ParsedLoopDefinition {
    name: string;
    trigger: LoopTrigger;
    schedule?: string;
    goal: string;
    discover: string;
    pipeline: string[];
    verify: LoopVerify;
    test_command?: string;
    max_iterations: number;
    isolation: LoopIsolation;
    status: LoopStatus;
}
/** validateLoopDefinition 반환 타입 */
export interface LoopValidationResult {
    valid: boolean;
    errors: string[];
    definition: ParsedLoopDefinition | null;
}
/**
 * 루프 정의 마크다운 문자열을 파싱하고 검증한다.
 *
 * @param content - 루프 정의 파일 전체 내용 (frontmatter 포함 마크다운)
 * @returns LoopValidationResult
 */
export declare function validateLoopDefinition(content: string): LoopValidationResult;
//# sourceMappingURL=validateLoopDefinition.d.ts.map