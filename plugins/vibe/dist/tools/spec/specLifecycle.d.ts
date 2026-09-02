/** SPEC 이 가질 수 있는 lifecycle 상태 — 이 집합 밖의 값은 게이트가 거부한다 */
export declare const SPEC_STATUSES: readonly ["DRAFT", "APPROVED", "VERIFIED", "SUPERSEDED", "REJECTED"];
export type SpecStatus = (typeof SPEC_STATUSES)[number];
/** SPEC 의 변경 종류 — dsh Agent Note 의 닫힌 6종을 그대로 쓴다 */
export declare const SPEC_CLASSES: readonly ["feature", "bug-fix", "simplification", "architecture", "process", "testing"];
export type SpecClass = (typeof SPEC_CLASSES)[number];
/**
 * Anchors 를 요구하는 Class.
 *
 * 코드 경로에 실제로 안착하는 종류만 넣는다. process/testing/simplification 은
 * 규약·워크플로 변경이라 고정할 경로가 없는 경우가 많고, 억지로 요구하면 통과 의식이 된다.
 */
export declare const ANCHOR_REQUIRED_CLASSES: readonly SpecClass[];
export interface SpecLifecycleHeader {
    status?: string;
    specClass?: string;
    /** `## Anchors` 절에서 뽑은 경로. 절이 없으면 undefined (빈 배열과 구분한다) */
    anchors?: string[];
}
export interface LifecycleFinding {
    code: string;
    message: string;
}
/**
 * 분할 SPEC 의 phase 파일은 헤더를 요구하지 않는다 — 헤더는 `_index.md` 한 벌이
 * SSOT 다. phase 파일마다 Status 를 두면 둘이 어긋나는 새 드리프트를 만든다.
 */
export declare function isLifecycleExempt(specPath: string): boolean;
/** SPEC 원문에서 lifecycle 헤더를 읽는다 */
export declare function parseSpecLifecycle(content: string): SpecLifecycleHeader;
/** VERIFIED + 코드성 Class 면 Anchors 절이 있고 비어 있지 않아야 한다 */
export declare function anchorsRequired(header: SpecLifecycleHeader): boolean;
/**
 * 내용만으로 판정 가능한 lifecycle 검사.
 *
 * @param content SPEC 마크다운 원문
 * @param specPath 파일 경로 — phase 파일 면제 판정에 쓴다
 */
export declare function checkSpecLifecycle(content: string, specPath?: string): LifecycleFinding[];
//# sourceMappingURL=specLifecycle.d.ts.map