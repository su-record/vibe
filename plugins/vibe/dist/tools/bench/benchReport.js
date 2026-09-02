/**
 * 벤치 리포트 — 관측값과 분모를 함께 적고, 결론을 대신 내지 않는다.
 *
 * 이 파일이 지키는 규칙 하나: **비율·퍼센트·배수를 쓰지 않는다.** 게이트 통과도
 * "3/5 회" 로 적지 "60%" 로 적지 않는다. 분모가 5인 비율은 정밀해 보이지만 아무것도
 * 말하지 않으며, 한 번 문서에 들어가면 출처 없이 유통된다 (constitution §3.5).
 */
function formatRange(label, value) {
    if (!value)
        return `- ${label}: 관측값 없음`;
    return `- ${label}: ${value.min}~${value.max} (평균 ${value.mean.toFixed(2)})`;
}
function formatExclusions(arm) {
    const entries = Object.entries(arm.excluded).filter(([, count]) => count > 0);
    if (entries.length === 0)
        return [];
    return [`- 제외: ${entries.map(([reason, count]) => `${reason} ${count}건`).join(' · ')}`];
}
function formatArm(arm) {
    return [
        '',
        `### ${arm.armId}`,
        '',
        `- 실행: ${arm.usableRuns}/${arm.totalRuns} 사용 가능`,
        `- 게이트 통과: ${arm.gatePassed}/${arm.usableRuns}`,
        formatRange('회전 수', arm.iterations),
        formatRange('도구 호출 수', arm.toolCalls),
        ...formatExclusions(arm),
    ];
}
const VERDICT_LABEL = {
    'insufficient-runs': '판정 불가 — 표본 부족',
    'mixed-task-sets': '판정 불가 — 과제 셋 불일치',
    inconclusive: '판정 불가 — 차이를 말할 수 없음',
    'difference-observed': '차이 관측됨',
};
export function formatBenchReport(input) {
    const { comparison } = input;
    const [a, b] = comparison.arms;
    const deltaLine = comparison.delta === null
        ? []
        : [`- 차이(${b.armId} − ${a.armId}): ${comparison.delta.toFixed(2)} ${comparison.metric} (절대 단위)`];
    return [
        `# Bench — ${input.name}`,
        '',
        `- 실행 시각: ${input.ranAt}`,
        `- 지표: ${comparison.metric}`,
        `- 판정: **${VERDICT_LABEL[comparison.verdict]}**`,
        '',
        `> ${comparison.reason}`,
        ...deltaLine,
        '',
        '## Arms',
        ...formatArm(a),
        ...formatArm(b),
        '',
        '---',
        '',
        '이 리포트는 관측값만 적는다. 배수·퍼센트를 계산하지 않으며, 어느 조건을 골라야',
        '하는지도 말하지 않는다 — 지표의 방향은 사람이 안다. 기본값 변경은 사람의 결정이다.',
        '',
    ].join('\n');
}
//# sourceMappingURL=benchReport.js.map