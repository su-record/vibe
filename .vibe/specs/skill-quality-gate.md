---
status: in-progress
currentPhase: 1
totalPhases: 3
stakes: production
createdAt: 2026-07-26T05:58:00+09:00
lastUpdated: 2026-07-26T05:58:00+09:00
---

# SPEC: skill-quality-gate

## Persona
<role>
- vibe 스킬 체계를 설계·운영해 온 시니어 개발자
- 기존 스타일 보존 (한국어 WHY, 프론트매터 규약, 표 기반 명세)
- 진입 스킬의 외부 호출 계약(`/vibe.*` 인자·동작)을 1바이트도 바꾸지 않는다
</role>

## Context
<context>
### Background
스킬 51개를 발행하면서 스킬 **품질** 게이트가 없다. `vibe.test`의 `skills` 프로브는
프론트매터 필드 **존재 여부**만 검사한다 (`name`/`description`이 있으면 pass).

실측 베이스라인 (2026-07-26, `skills/*/SKILL.md` 51개):

| 축 | 위반 | 비율 |
|---|---|---|
| scope — 250줄 초과 | 11개 (845/839/451/306/302/296/292/274/270/268/255) | 22% |
| context — `references/` 부재 | 37개 | 73% |
| verify — Done Criteria 섹션 부재 | 33개 (진입 22개 중 17개) | 65% |

### 설계 제약 (베이스라인에서 도출)
verify 축을 `fail`로 잡으면 진입 스킬 22개 중 17개가 즉시 실패하고
`vibe.regress register --from-test`로 P1이 쏟아진다. 자사 패키지가 자체 테스트에서
무더기 실패하는 리포트를 출시하게 되므로 **warn으로 시작**, 백로그 해소 후 승격한다.

### Related Code
- `skills/vibe.test/SKILL.md`: 프로브 명세 + 리포트 스키마 (LLM 호출 없음 원칙)
- `src/cli/postinstall/constants.ts:15` `GLOBAL_SKILLS_ENTRY`: 진입 스킬 22개 SSOT
- `skills/vibe/SKILL.md` Catch-all: 전체 `vibe.*` description으로 의미 매칭 라우팅
  → description = 유일한 라우팅 신호

### 선행 조사에서 정정된 전제
`skills/vibe.core.*/` 7개는 **0 파일 · git 미추적 빈 디렉토리**. `~/.claude/skills/`의
`clone`/`figma`/`test`는 구버전 잔여물. 현재 repo는 이들을 진입 스킬 본문에
`## Bundled implementation`으로 통합했다 (figma·clone·contract·docs·regress·spec·test).
따라서 Phase 3 대상은 `vibe.core.*`가 아니라 `GLOBAL_SKILLS_ENTRY` 22개다.
</context>

## Task
<task>
### Phase 1: STCV 품질 프로브
1. [ ] `skills/vibe.test/SKILL.md` — `skills` 프로브에 품질 축 4개 추가

   | 축 | 판정 | severity |
   |---|---|---|
   | scope | SKILL.md 줄수 | ≤250 pass · 251–400 warn · >400 fail |
   | context | 본문 코드펜스 ≥3 ∧ `references/` 부재 | warn |
   | trigger | description에 발동 조건 어휘 부재 | warn |
   | verify | `Done Criteria`/`완료 기준` 섹션 부재 | warn |

2. [ ] JSON 스키마 확장: `status`에 `"warn"` 추가, `summary.warned` 카운트,
       마크다운 템플릿에 Warnings 섹션
3. [ ] **`failed[]`와 regress 연동은 `fail`만** — warn은 자동 등록하지 않는다 (기존 P1 계약 보존)
4. [ ] Verify: `>400` 규칙이 vibe.run/figma/clone 3개를 정확히 잡는다

### Phase 2: 토큰 다이어트
5. [ ] `vibe.run` 845줄 → SKILL.md ≤250 + `references/`
6. [ ] `vibe.figma` 839줄 → SKILL.md ≤250 + `references/`
7. [ ] `vibe.clone` 451줄 → SKILL.md ≤250 + `references/`
   - 템플릿·예시·스키마·룩업표를 **이동**한다. 내용 삭제 금지
   - SKILL.md에는 판단 기준 + 절차 + references 포인터만
8. [ ] 3개 스킬에 `Done Criteria` 섹션 신설
9. [ ] Verify: `vibe.test` scope/context/verify 3축 모두 pass

### Phase 3: description 트리거화
10. [ ] `GLOBAL_SKILLS_ENTRY` 22개의 서술형 description을 발동 조건형으로 재작성
11. [ ] Verify: Phase 1의 trigger 축이 22개 전부 pass
12. [ ] `CLAUDE.md` / `AGENTS.md`에 품질 게이트 문서화
</task>

## Done Criteria
- [ ] `vibe.test` 실행 시 STCV 4축이 51개 스킬 전부에 대해 판정된다
- [ ] LLM 호출 0회 — 파일 읽기 + vitest만 (기존 원칙 유지)
- [ ] `fail` 0건 (scope >400 3개가 Phase 2로 해소됨)
- [ ] warn은 `vibe.regress`를 트리거하지 않는다
- [ ] 진입 스킬 22개의 `/vibe.*` 호출 인자·동작 불변

## Out of scope
- `~/.claude/` 설치본 수정 (CLAUDE.md 금지)
- 나머지 8개 250줄 초과 스킬 (warn만, 미착수)
- 빈 `skills/vibe.core.*/` 7개 정리 (untracked 로컬 잔여물, 별건)
