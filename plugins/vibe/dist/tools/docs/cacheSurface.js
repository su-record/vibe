/**
 * 프리픽스 캐시 표면 문서(`vibe/rules/prefix-cache-surface.md`)의 판정 로직.
 *
 * 문서가 자산을 나열하는 순간 그것은 **두 번째 집**이 된다 — 실물이 움직이면 조용히 어긋난다.
 * dsh 가 정확히 그렇게 무너졌다: 게이트가 걸린 `packages/README.md` 는 50개 전부 맞았고,
 * 게이트 없는 루트 문서의 레이아웃 트리는 존재하지 않는 그룹 2개를 나열하고 17개를 빠뜨렸다.
 * 그래서 나열은 허용하되 **양방향으로** 검사한다: 문서에 없는 실물도, 실물이 없는 문서 항목도 실패다.
 *
 * 파일시스템 수집은 여기서 하지 않는다 — 이 모듈은 순수 함수로 두고
 * `scripts/validate-cache-surface.ts` 가 실물을 모아 넘긴다.
 */
/** 절을 식별하는 기계 마커 — 헤딩 문구가 바뀌어도 판정이 흔들리지 않게 */
const SURFACE_MARKER = /<!--\s*surface:\s*([a-z0-9-]+)\s*-->/gi;
/** 자산 문서라면 반드시 답해야 하는 두 질문 */
export const REQUIRED_SUBSECTIONS = ['Model Experience', 'KV Cache effect'];
/** `- **Model Experience**: …` 형태로 내용이 있는가 (헤딩만 있고 빈 절은 통과시키지 않는다) */
function hasSubsection(body, label) {
    const re = new RegExp(String.raw `^\s*[-*#]+\s*\*{0,2}` + label + String.raw `\*{0,2}\s*[:：]?\s*(.*)$`, 'im');
    const m = body.match(re);
    if (!m)
        return false;
    return m[1].trim().length > 0 || /\n\s*\S/.test(body.slice((m.index ?? 0) + m[0].length));
}
function tableEntries(body) {
    const out = [];
    for (const line of body.split('\n')) {
        if (!line.trimStart().startsWith('|'))
            continue;
        for (const m of line.matchAll(/`([^`\n]+)`/g)) {
            const v = m[1].trim();
            if (/\.(md|js|ts|json)$/.test(v))
                out.push(v);
        }
    }
    return out;
}
/** 문서를 절 단위로 쪼갠다 */
export function parseSurfaceDoc(content) {
    const marks = [...content.matchAll(SURFACE_MARKER)];
    return marks.map((m, i) => {
        const start = (m.index ?? 0) + m[0].length;
        const end = i + 1 < marks.length ? marks[i + 1].index ?? content.length : content.length;
        const body = content.slice(start, end);
        return { id: m[1], body, entries: tableEntries(body) };
    });
}
/** 모든 절이 두 질문에 답했는가 */
export function checkRequiredSubsections(sections) {
    const out = [];
    for (const s of sections) {
        for (const label of REQUIRED_SUBSECTIONS) {
            if (!hasSubsection(s.body, label)) {
                out.push({
                    code: 'missing-subsection',
                    message: `표면 "${s.id}" 에 "${label}" 절이 없거나 비어 있다.`,
                });
            }
        }
    }
    return out;
}
/**
 * 나열된 절과 실물을 양방향으로 맞춘다.
 *
 * @param sections 문서에서 파싱한 절
 * @param actual   절 id → 실제 존재하는 자산 경로. 여기 없는 절은 집계 절로 보고 건너뛴다
 */
export function checkEnumeratedSurfaces(sections, actual) {
    const out = [];
    for (const [id, paths] of Object.entries(actual)) {
        const section = sections.find((s) => s.id === id);
        if (!section) {
            out.push({ code: 'missing-surface', message: `표면 절 "${id}" 이 문서에 없다.` });
            continue;
        }
        const documented = new Set(section.entries);
        const real = new Set(paths);
        for (const p of real) {
            if (!documented.has(p)) {
                out.push({ code: 'undocumented-asset', message: `${id}: 실물이 문서에 없다 — ${p}` });
            }
        }
        for (const p of documented) {
            if (!real.has(p)) {
                out.push({ code: 'phantom-asset', message: `${id}: 문서에만 있고 실물이 없다 — ${p}` });
            }
        }
    }
    return out;
}
export function checkCacheSurfaceDoc(content, actual) {
    const sections = parseSurfaceDoc(content);
    if (sections.length === 0) {
        return [{ code: 'no-surfaces', message: '표면 마커(<!-- surface: id -->)가 하나도 없다.' }];
    }
    return [...checkRequiredSubsections(sections), ...checkEnumeratedSurfaces(sections, actual)];
}
//# sourceMappingURL=cacheSurface.js.map