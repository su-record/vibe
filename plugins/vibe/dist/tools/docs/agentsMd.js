/**
 * `CLAUDE.md` → `AGENTS.md` 결정론 생성.
 *
 * ## 왜 생성인가
 *
 * 두 파일은 같은 사실의 두 집이다. `CLAUDE.md` 는 "AGENTS.md 는 재생성된다" 고 선언만 하고
 * 검증하는 명령이 없었고, 그 결과 한 파일 안에서 **과잉 번역과 미번역이 공존**했다
 * (실측 2026-09-02: `pnpm lint:ratchet` 이 `$vibe lint:ratchet` 으로 잘못 번역된 줄 1건,
 * Dual-Harness Doctrine 절의 `/vibe` 디스패처가 번역 안 된 줄 1건).
 *
 * 사람이 두 벌을 손으로 맞추는 한 이 드리프트는 반복된다. 그래서 번역 규칙을 데이터로 꺼내고
 * (`scripts/agents-md-rules.json`) 생성 결과와 저장소 파일을 `--check` 로 비교한다.
 *
 * ## 왜 단순 치환으로는 안 되는가
 *
 * `/vibe` → `$vibe` 를 그냥 돌리면 `@su-record/vibe`·`plugins/vibe/`·`.claude/vibe/` 가 함께 깨진다.
 * 그래서 3단이다: **보호 → 치환 → 복원**. 그 뒤에 두 하네스가 의도적으로 다른 문단
 * (파일 매핑 안내문, Codex 진입점 설명, Git include/exclude)을 `overrides` 로 갈아끼운다.
 *
 * `overrides` 는 **치환 이후** 텍스트에 적용된다 — 즉 `find` 는 번역된 형태(`$vibe`)로 쓴다.
 * 각 override 는 정확히 한 번 매치돼야 한다: 0번이면 대상을 잃은 규칙이고(원문이 바뀌었는데
 * 규칙이 안 따라왔다), 2번 이상이면 의도하지 않은 곳까지 갈아끼운다. 둘 다 게이트가 막는다.
 */
const SENTINEL = String.fromCharCode(0);
function splitAll(haystack, needle, replacement) {
    return haystack.split(needle).join(replacement);
}
export function generateAgentsMd(source, rules) {
    const findings = [];
    // 긴 리터럴부터 보호한다 — `@su-record/vibe` 가 `su-record/vibe` 보다 먼저 잡혀야 한다
    const protect = [...rules.protect].sort((a, b) => b.length - a.length);
    let text = source;
    protect.forEach((token, i) => {
        text = splitAll(text, token, SENTINEL + i + SENTINEL);
    });
    for (const s of rules.substitutions)
        text = splitAll(text, s.find, s.replace);
    protect.forEach((token, i) => {
        text = splitAll(text, SENTINEL + i + SENTINEL, token);
    });
    for (const o of rules.overrides) {
        const hits = text.split(o.find).length - 1;
        if (hits !== 1) {
            findings.push(`override 가 ${hits}번 매치됐다 (정확히 1번이어야 한다): ${JSON.stringify(o.find.slice(0, 60))}`);
            continue;
        }
        text = splitAll(text, o.find, o.replace);
    }
    return { output: text, findings };
}
//# sourceMappingURL=agentsMd.js.map