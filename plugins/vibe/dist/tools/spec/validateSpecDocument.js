/**
 * SPEC 문서 Code Guard — `vibe.spec` 산출물이 하류로 넘어가기 전에 검사한다.
 *
 * 배경: vibe 의 결정론 게이트는 전부 파이프라인 **끝**(JUDGE — run-ledger·테스트·RTM)에
 * 몰려 있었다. 중간 노드에는 가드가 없어, 게이트로 쓸 수 없는 SPEC 이 run 까지
 * 흘러간 뒤 verify 단계에서야 걸렸다. 실패를 늦게 발견할수록 비싸다.
 *
 * 여기서 검사하는 것은 취향이 아니라 **하류가 실제로 요구하는 것**이다:
 *  - RTM 은 `REQ-{feature}-NNN` 이 없으면 `status: 'empty'` 를 내고, 그건 통과가 아니라
 *    판정불가다 (traceabilityMatrix.ts). 커버리지 게이트가 통째로 죽는다.
 *  - `Stakes:` 는 디스패처가 파이프라인 깊이를 정하는 입력이다.
 *  - Done Criteria 는 JUDGE 의 입력이다 — 없으면 판정할 것이 없다.
 *  - 채워지지 않은 placeholder 는 직역 하네스가 실데이터로 넣는다
 *    (dual-harness-doctrine 운영 규칙 2).
 */
import path from 'path';
const REQ_ID = /\bREQ-([a-z0-9-]+)-(\d{3})\b/g;
const STAKES_LINE = /^\s*[-*]?\s*\*{0,2}Stakes\*{0,2}\s*[:：]\s*(.+)$/im;
const VALID_STAKES = ['demo', 'prototype', 'production'];
/**
 * 코드 구간(펜스 + 인라인 코드)을 공백으로 지운다 — 줄 번호는 보존한다.
 *
 * SPEC 은 경로 패턴(`styles/{feature}/`), 데이터 모양(`{r,g,b,a}`), 셸 brace
 * expansion(`hooks/{a,b}.js`)을 인라인 코드로 정상적으로 쓴다. 원문을 그대로 훑으면
 * 그것들이 전부 미치환 placeholder 로 잡힌다 (실측: 오탐 28건).
 */
function stripCodeSpans(content) {
    const blank = (block) => block.replace(/[^\n]/g, ' ');
    return content
        .replace(/```[\s\S]*?```/g, blank)
        .replace(/`[^`\n]*`/g, blank);
}
function lineOf(content, index) {
    return content.slice(0, index).split('\n').length;
}
/** 파일명에서 feature 슬러그를 뽑는다 (분할 SPEC 은 디렉토리명) */
export function featureSlugFromPath(specPath) {
    const base = path.basename(specPath, '.md');
    return base === '_index' ? path.basename(path.dirname(specPath)) : base;
}
function collectRequirementIds(content) {
    const out = [];
    for (const m of content.matchAll(REQ_ID)) {
        out.push({ id: m[0], slug: m[1], index: m.index ?? 0 });
    }
    return out;
}
function checkRequirements(content, featureSlug, findings) {
    const found = collectRequirementIds(content);
    if (found.length === 0) {
        findings.push({
            severity: 'P1',
            code: 'no-requirement-ids',
            message: 'REQ-* ID 가 하나도 없다 — RTM 이 status:"empty" 를 내고 커버리지 게이트가 판정불가가 된다. '
                + '모든 기능 요구사항에 REQ-{feature}-NNN 을 붙여라.',
        });
        return [];
    }
    // 파일명과 다른 슬러그는 게이트를 깨지는 않는다 — RTM 은 featureName 을 파일 탐색에만
    // 쓰고 REQ 는 슬러그와 무관하게 전부 파싱한다(traceabilityMatrix.ts extractRequirements).
    // 다만 ID 규약은 REQ-{feature}-NNN 이고(requirementId.ts), 어긋나면 여러 feature 의
    // ID 가 한 문서에서 섞여 추적이 흐려진다 — 그래서 P2 로 알린다.
    if (featureSlug) {
        const mismatched = found.filter(f => f.slug !== featureSlug);
        if (mismatched.length > 0) {
            const slugs = [...new Set(mismatched.map(f => f.slug))];
            findings.push({
                severity: 'P2',
                code: 'requirement-id-slug-mismatch',
                message: `REQ 슬러그(${slugs.join(', ')})가 파일명(${featureSlug})과 다르다 — ${mismatched.length}건. `
                    + 'RTM 집계에는 포함되지만 ID 규약(REQ-{feature}-NNN)에서 벗어나 추적이 흐려진다.',
                line: lineOf(content, mismatched[0].index),
            });
        }
    }
    return [...new Set(found.map(f => f.id))];
}
function checkStakes(content, findings) {
    const m = content.match(STAKES_LINE);
    if (!m) {
        findings.push({
            severity: 'P1',
            code: 'no-stakes',
            message: 'Stakes 필드가 없다 — 디스패처가 파이프라인 깊이를 정할 입력이 없다 (demo | prototype | production).',
        });
        return;
    }
    const value = m[1].toLowerCase();
    if (!VALID_STAKES.some(s => value.includes(s))) {
        findings.push({
            severity: 'P1',
            code: 'invalid-stakes',
            message: `Stakes 값을 알 수 없다: "${m[1].trim()}" — demo | prototype | production 중 하나여야 한다.`,
        });
    }
}
/**
 * 완료 기준 섹션 제목 — 표기는 여러 가지다.
 *
 * 처음에는 영문 `Done Criteria` 만 찾았는데, 실제 SPEC 들은 "목표 (Done 의 정의)" ·
 * "수용 기준" · "Goal — Verifiable" 로 쓰고 있었고 내용은 오히려 더 결정론적이었다
 * (`npm run build && npx vitest run` 그린 등). 문자열이 아니라 의미로 찾는다.
 */
const DONE_HEADING = /^#{1,3}\s*\d*\.?\s*(?:.*\b(?:Done Criteria|Acceptance Criteria)\b.*|.*(?:완료 기준|완료 판정|수용 기준|Done 의 정의|Verifiable).*)$/im;
/** 기준 항목 표기 — D1 / G1 / AC1 / 체크박스 / 표 행 */
const CRITERION_ITEM = /\b(?:D|G|AC)\d+\b|^\s*[-*]\s*\[[ x]\]|^\s*\|\s*(?:D|G|AC)?\d+\s*\|/im;
/**
 * 요구사항마다 기준을 인라인으로 다는 형식도 유효하다 — 별도 섹션이 없을 뿐
 * JUDGE 입력은 존재한다. 실제 SPEC 들이 쓰는 두 가지:
 *   `- AC: 옵션 없이 호출 시 …`          (harness-remediation)
 *   `| Done Criteria | Evidence Required |`  (audit-p2-remediation, REQ 별 표)
 */
const INLINE_CRITERIA = /^\s*[-*]\s*AC\s*[:：]|^\s*\|\s*Done Criteria\s*\||^\s*\|\s*(?:Criterion|Verified by|Evidence)\s*\|/im;
function checkDoneCriteria(content, findings) {
    if (INLINE_CRITERIA.test(content))
        return; // REQ 별 인라인 기준으로 충족
    const heading = content.match(DONE_HEADING);
    if (!heading) {
        findings.push({
            severity: 'P1',
            code: 'no-done-criteria',
            message: '완료 기준 섹션이 없다 (Done Criteria / 완료 기준 / 수용 기준 …) — JUDGE 가 판정할 입력이 없다.',
        });
        return;
    }
    // 제목만 있고 판정할 것이 없는 경우를 잡는다 — 섹션 본문에 기준 항목이나
    // 실행 가능한 판정 문구(명령·그린 여부)가 있어야 한다.
    //
    // 본문은 **동일·상위 레벨** 제목에서 자른다. 아무 레벨에서나 자르면 자기
    // 하위 섹션 앞에서 끊겨, `## Acceptance Criteria` 밑에 `### …` 를 두고 그 아래
    // AC 체크박스를 나열한 SPEC 이 "비었다" 로 오판된다 (vibe-design 실측).
    const level = (heading[0].match(/^#+/) ?? ['#'])[0].length;
    const after = content.slice((heading.index ?? 0) + heading[0].length);
    const body = after.split(new RegExp(`^#{1,${level}}\\s`, 'm'))[0];
    const hasItems = CRITERION_ITEM.test(body);
    const hasVerifiableSentence = /완료\s*(?:판정)?\s*=|그린|exit\s*0|`[^`\n]*(?:test|build|vitest|tsc)[^`\n]*`/i.test(body);
    if (!hasItems && !hasVerifiableSentence) {
        findings.push({
            severity: 'P1',
            code: 'empty-done-criteria',
            message: '완료 기준 섹션에 판정할 항목이 없다 (D1/G1/AC1 · 체크박스 · 실행 가능한 판정 문구) — 제목만 있다.',
            line: lineOf(content, heading.index ?? 0),
        });
    }
}
/**
 * 템플릿에서 온 미치환 placeholder — 직역 하네스가 실데이터로 넣는다.
 *
 * 좁게 잡는다. 중괄호 하나만으로는 판단할 수 없다 — 경로 패턴·데이터 모양·brace
 * expansion 이 전부 중괄호를 쓴다. 템플릿 placeholder 는 **산문**이라는 점이
 * 구분점이다: `{Observable functional requirement}` 처럼 공백을 포함한다.
 * 반면 `{feature}` · `{token}` · `{r,g,b,a}` 는 공백이 없다.
 *
 * `<예시>` 는 검사하지 않는다 — dual-harness-doctrine 이 **권장하는** 예시 표기이지
 * 채워야 할 자리가 아니다. `<채워넣을 값>` 만 미치환으로 본다.
 */
function checkPlaceholders(content, findings) {
    const scannable = stripCodeSpans(content);
    const patterns = [
        { re: /\{\{[^}\n]+\}\}/g, code: 'unresolved-template-var', label: '템플릿 변수' },
        { re: /\{[^}\n]*\s[^}\n]*\}/g, code: 'unfilled-placeholder', label: 'placeholder' },
        { re: /<채워넣을 값>/g, code: 'unfilled-placeholder', label: 'placeholder' },
    ];
    const seen = new Set();
    for (const { re, code, label } of patterns) {
        for (const m of scannable.matchAll(re)) {
            const line = lineOf(scannable, m.index ?? 0);
            if (seen.has(line))
                continue;
            seen.add(line);
            findings.push({
                severity: 'P1',
                code,
                message: `미치환 ${label}: ${m[0].slice(0, 60)} — 직역 하네스는 이 텍스트를 실데이터로 넣는다.`,
                line,
            });
        }
    }
}
function checkScenarios(content, findings) {
    if (!/^#{1,3}\s*\d*\.?\s*Scenarios/im.test(content)) {
        findings.push({
            severity: 'P2',
            code: 'no-scenarios',
            message: 'Scenarios 섹션이 없다 — vibe.run 의 시나리오 루프가 분해할 단위가 없다.',
        });
    }
}
/**
 * SPEC 문서를 검사한다.
 *
 * @param content SPEC 마크다운 원문
 * @param options.specPath 파일 경로 — 주면 REQ 슬러그와 파일명 일치까지 검사한다
 * @returns P1 이 없으면 valid
 */
export function validateSpecDocument(content, options = {}) {
    const findings = [];
    if (content.trim().length === 0) {
        return {
            valid: false,
            findings: [{ severity: 'P1', code: 'empty-spec', message: 'SPEC 이 비어 있다.' }],
            requirementIds: [],
        };
    }
    const featureSlug = options.specPath ? featureSlugFromPath(options.specPath) : undefined;
    const requirementIds = checkRequirements(content, featureSlug, findings);
    checkStakes(content, findings);
    checkDoneCriteria(content, findings);
    checkPlaceholders(content, findings);
    checkScenarios(content, findings);
    return {
        valid: !findings.some(f => f.severity === 'P1'),
        findings,
        requirementIds,
    };
}
/** 사람이 읽는 한 줄 요약 — 스킬이 그대로 출력한다 */
export function formatSpecValidation(result) {
    if (result.valid && result.findings.length === 0) {
        return `✅ SPEC guard 통과 — REQ ${result.requirementIds.length}건`;
    }
    const lines = result.findings.map(f => `  ${f.severity} ${f.code}${f.line ? ` (line ${f.line})` : ''}: ${f.message}`);
    const head = result.valid
        ? `⚠️ SPEC guard 통과 (P2 ${result.findings.length}건) — REQ ${result.requirementIds.length}건`
        : `❌ SPEC guard 실패 — P1 ${result.findings.filter(f => f.severity === 'P1').length}건`;
    return [head, ...lines].join('\n');
}
//# sourceMappingURL=validateSpecDocument.js.map