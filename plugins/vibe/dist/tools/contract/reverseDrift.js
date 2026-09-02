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
/** 분류기가 다루는 종류 전부 — 테스트가 순회 기준으로 읽는 SSOT */
export const REVERSE_DRIFT_KINDS = [
    'unspecified-endpoint',
    'unspecified-field',
    'unspecified-status-code',
    'unspecified-parameter',
];
const KIND_SEVERITY = {
    'unspecified-endpoint': 'P2',
    'unspecified-field': 'P3',
    'unspecified-status-code': 'P3',
    'unspecified-parameter': 'P3',
};
const KIND_REASON = {
    'unspecified-endpoint': 'SPEC 이 통째로 모르는 외부 표면 — 계약 리뷰 대상이 아니었다',
    'unspecified-field': '응답/요청 필드가 SPEC 에 없다 — 소비자가 의존하기 시작하면 계약이 된다',
    'unspecified-status-code': 'SPEC 에 없는 상태 코드 — 클라이언트가 처리 대상을 모른다',
    'unspecified-parameter': 'SPEC 에 없는 파라미터 — 문서화되지 않은 입력 표면',
};
export function isReverseDriftKind(value) {
    return typeof value === 'string' && REVERSE_DRIFT_KINDS.includes(value);
}
export function classifyReverseDrift(kind) {
    if (!isReverseDriftKind(kind)) {
        throw new Error(`[reverse-drift] 알 수 없는 종류: ${String(kind)}`);
    }
    return {
        severity: KIND_SEVERITY[kind],
        blocking: false,
        destination: 'inbox',
        reason: KIND_REASON[kind],
    };
}
export function summarizeReverseDrift(findings) {
    const byKind = {
        'unspecified-endpoint': 0,
        'unspecified-field': 0,
        'unspecified-status-code': 0,
        'unspecified-parameter': 0,
    };
    const bySeverity = { P2: 0, P3: 0 };
    for (const finding of findings) {
        byKind[finding.kind] += 1;
        bySeverity[classifyReverseDrift(finding.kind).severity] += 1;
    }
    return { total: findings.length, byKind, bySeverity };
}
function formatFrontmatter(input, summary) {
    const counts = REVERSE_DRIFT_KINDS.map((kind) => `  ${kind}: ${summary.byKind[kind]}`);
    return [
        '---',
        `feature: ${input.feature}`,
        `spec: ${input.specPath}`,
        `compared-at: ${input.comparedAt}`,
        'direction: implementation-to-spec',
        'blocking: false',
        `total: ${summary.total}`,
        'kind-counts:',
        ...counts,
        '---',
    ];
}
function formatFindingLine(finding) {
    const location = finding.location ? ` — ${finding.location}` : '';
    const note = finding.note ? ` (${finding.note})` : '';
    return `- \`${finding.surface}\`${location}${note}`;
}
function formatKindSection(kind, findings) {
    const matched = findings.filter((f) => f.kind === kind);
    if (matched.length === 0)
        return [];
    const { severity, reason } = classifyReverseDrift(kind);
    return [
        '',
        `## ${severity} — ${kind} (${matched.length})`,
        '',
        reason,
        '',
        ...matched.map(formatFindingLine),
    ];
}
/**
 * `.vibe/contracts/<feature>.reverse.md` 본문.
 *
 * 발견 0건이어도 파일을 낸다 — "대조했고 결손이 없었다" 는 증거이고, 파일이 없는 것과
 * 구분되어야 한다 (아직 안 돌린 것 vs 돌렸는데 깨끗한 것).
 */
export function formatReverseReport(input) {
    const summary = summarizeReverseDrift(input.findings);
    const body = summary.total === 0
        ? ['', '결손 없음 — 구현에서 발견한 모든 표면이 SPEC 에 존재한다.']
        : REVERSE_DRIFT_KINDS.flatMap((kind) => formatKindSection(kind, input.findings));
    return [
        ...formatFrontmatter(input, summary),
        '',
        `# Reverse contract drift — ${input.feature}`,
        '',
        '> 구현에만 있고 SPEC 에 없는 표면. **루프를 차단하지 않는다** — 코드 실패가 아니라',
        '> SPEC 결손이므로 인박스(사람 리뷰 큐)로 간다. SPEC 갱신 여부는 사람이 정한다.',
        ...body,
        '',
    ].join('\n');
}
/**
 * `loop-ledger.js inbox <name> ok <line...>` 에 넘길 줄들.
 *
 * 발견 0건이면 **빈 배열** — 인박스에 빈 블록을 남기지 않는다.
 */
export function formatReverseInboxLines(feature, findings) {
    if (findings.length === 0)
        return [];
    const summary = summarizeReverseDrift(findings);
    const head = `SPEC 결손 ${summary.total}건 (P2 ${summary.bySeverity.P2} · P3 ${summary.bySeverity.P3})`
        + ` — 구현에만 있는 표면. 차단 아님, SPEC 갱신 여부는 사람이 정한다.`;
    const items = findings.map((f) => {
        const location = f.location ? ` @ ${f.location}` : '';
        return `${classifyReverseDrift(f.kind).severity} ${f.kind}: ${f.surface}${location}`;
    });
    return [head, `근거: .vibe/contracts/${feature}.reverse.md`, ...items];
}
//# sourceMappingURL=reverseDrift.js.map