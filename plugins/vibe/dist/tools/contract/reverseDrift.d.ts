/**
 * 역방향 계약 드리프트 — 구현에만 있고 SPEC 에 없는 표면의 분류·기록.
 *
 * 배경: `vibe.contract` 의 `check` 는 **SPEC → 구현** 한 방향만 본다. 구현이 SPEC 에 없는
 * 엔드포인트·필드·상태 코드를 갖게 되어도 아무도 모르고, SPEC 은 승인 시점에 얼어붙는다.
 *
 * 방향만 뒤집는 것이 아니라 **등급 매핑을 뒤집는다.** 구현에만 있는 표면은 코드 실패가
 * 아니라 SPEC 결손이다. 그리고 판정 주체가 LLM 추출이므로 loop-contract 의 Judge 권한
 * 경계상 "판정된 P1" 이며 — 단독으로 루프를 차단할 권한이 없다.
 *
 * 그래서 이 모듈이 결정론으로 고정하는 것은 *판정* 이 아니라 **판정의 귀결**이다:
 * 등급에 P1 이 없고(`ReverseDriftSeverity`), 차단이 타입 수준에서 불가능하며
 * (`blocking: false` 리터럴), 목적지가 인박스로 고정된다. 규칙을 산문으로 적어두면
 * 다음 사람이 P1 을 하나 추가하는 것으로 조용히 깨진다.
 */
/** 역방향 드리프트 종류 — `구현 ⊃ SPEC` 인 경우만. 구현이 SPEC 보다 좁은 것은 `check` 의 관할이다. */
export type ReverseDriftKind = 'unspecified-endpoint' | 'unspecified-field' | 'unspecified-status-code' | 'unspecified-parameter';
/** 분류기가 다루는 종류 전부 — 테스트가 순회 기준으로 읽는 SSOT */
export declare const REVERSE_DRIFT_KINDS: readonly ReverseDriftKind[];
/**
 * 역방향 등급에는 P1 이 없다 — 타입 수준에서 없앤다.
 * P1 이 존재하면 차단 권한 없는 판정이 차단하게 된다 (loop-contract Judge 권한 경계).
 */
export type ReverseDriftSeverity = 'P2' | 'P3';
export interface ReverseDriftClassification {
    severity: ReverseDriftSeverity;
    /** 리터럴 `false` — 차단하는 분류를 만들 수 없다 */
    blocking: false;
    /** 리터럴 `'inbox'` — 게이트는 답을 기다리는 질문이고, SPEC 결손은 답을 기다리지 않는다 */
    destination: 'inbox';
    reason: string;
}
export declare function isReverseDriftKind(value: unknown): value is ReverseDriftKind;
export declare function classifyReverseDrift(kind: ReverseDriftKind): ReverseDriftClassification;
export interface ReverseDriftFinding {
    kind: ReverseDriftKind;
    /** 구현에서 발견한 표면 식별자 — 예: `GET /users/:id`, `get-user-by-id.response.200.phoneNumber` */
    surface: string;
    /** 구현 위치 `file:line` — 확인하지 못했으면 생략한다 (추측해 채우지 않는다) */
    location?: string;
    /** 한 줄 부연 */
    note?: string;
}
export interface ReverseDriftSummary {
    total: number;
    byKind: Record<ReverseDriftKind, number>;
    bySeverity: Record<ReverseDriftSeverity, number>;
}
export declare function summarizeReverseDrift(findings: readonly ReverseDriftFinding[]): ReverseDriftSummary;
export interface ReverseReportInput {
    feature: string;
    /** 대조 기준이 된 SPEC 경로 */
    specPath: string;
    /** ISO-8601 */
    comparedAt: string;
    findings: readonly ReverseDriftFinding[];
}
/**
 * `.vibe/contracts/<feature>.reverse.md` 본문.
 *
 * 발견 0건이어도 파일을 낸다 — "대조했고 결손이 없었다" 는 증거이고, 파일이 없는 것과
 * 구분되어야 한다 (아직 안 돌린 것 vs 돌렸는데 깨끗한 것).
 */
export declare function formatReverseReport(input: ReverseReportInput): string;
/**
 * `loop-ledger.js inbox <name> ok <line...>` 에 넘길 줄들.
 *
 * 발견 0건이면 **빈 배열** — 인박스에 빈 블록을 남기지 않는다.
 */
export declare function formatReverseInboxLines(feature: string, findings: readonly ReverseDriftFinding[]): string[];
//# sourceMappingURL=reverseDrift.d.ts.map