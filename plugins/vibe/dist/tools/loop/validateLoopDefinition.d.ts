/**
 * Loop Definition Validator — 루프 정의 파일(.vibe/loops/<name>.md) 검증.
 *
 * frontmatter 필수 필드, enum 값, max_iterations 범위(1–50),
 * 조건부 필드(schedule, test_command)를 결정론적으로 검증한다.
 */
export type LoopTrigger = 'scheduled' | 'manual' | 'on-event';
/**
 * 완료를 무엇으로 판정하는가.
 *
 * - `ledger` — run-ledger 의 `verifyPassed`
 * - `tests`  — `test_command` 의 exit code
 * - `visual` — `visual_command` 의 exit code **+ 사람이 볼 산출물**
 * - `none`   — 판정 생략(보고만)
 *
 * ⚠️ `visual` 이 "모델이 스크린샷을 보고 판단한다" 는 뜻이 **아니다.** 그건
 * 자기보고이고, loop-contract 가 배제하는 바로 그것이다. 게이트는 명령의 exit
 * code 다 — 베이스라인 diff·접근성 감사·토큰 드리프트처럼 임계값으로 떨어지는
 * 검사여야 한다. `tests` 와 갈리는 지점은 **증거를 남긴다**는 것이다: 스크린샷이나
 * diff 이미지를 남겨 나중에 사람이 눈으로 확인할 수 있어야 한다.
 */
export type LoopVerify = 'ledger' | 'tests' | 'visual' | 'none';
export type LoopIsolation = 'worktree' | 'none';
/**
 * 한 번의 호출에서 몇 바퀴를 도는가.
 *
 * - `continuous` (기본) — `max_iterations` 한도까지 한 세션 안에서 계속 돈다.
 *   회전 사이에 맥락이 남아 이어붙이기 좋지만, 컨텍스트가 단조 증가한다.
 * - `per-iteration` — **한 바퀴만 돌고 끝낸다.** 반복은 스케줄러가 만든다.
 *   호출마다 컨텍스트가 0에서 시작하므로 누적이 없다. 대신 매번 ANCHOR 문서를
 *   다시 읽어야 하고(고정 비용), 회전 사이의 맥락은 파일로만 넘어간다.
 *
 * 어느 쪽이 결과가 나은지는 측정된 바 없다 — 축을 열어두고 선택하게 한다.
 */
export type LoopSession = 'continuous' | 'per-iteration';
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
    visual_command?: string;
    artifact_dir?: string;
    max_iterations: number;
    isolation: LoopIsolation;
    session: LoopSession;
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