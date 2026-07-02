---
status: implemented
currentPhase: 3
totalPhases: 3
createdAt: 2026-07-02T10:00:00+09:00
lastUpdated: 2026-07-02T13:35:00+09:00
---

# SPEC: clone-quality-overhaul

## Persona
<role>
- vibe clone 파이프라인(skills/clone + hooks/scripts/clone-*.js)을 작성해 온 시니어 개발자
- 결정론적 게이트(clone-validate, pixel diff)는 보존하면서 모델의 재량을 넓힌다
- 기존 스타일 보존: 한국어 WHY 주석, fail-open 스윕(1개 실패가 전체를 죽이지 않음), 함수 ≤50줄
</role>

## Context
<context>
### Background
`ai-website-cloner-template`(JCodesMore, 474줄 SKILL.md) 분석 결과, vibe.clone 품질 열위의 구조적 원인 5가지가 확인됨:

1. **CSS 역전 구조**: clone-to-scss.js가 computed CSS를 통짜 덤프하고 모델의 CSS 값 수정을 금지 → computed 값은 뷰포트에 해석된 절대값이라 `max-width`/`%`/`flex-grow`/미디어쿼리 *의도*가 소실되는데, 틀려도 모델이 고칠 권한이 없음
2. **반응형 미구현**: `Phase 3C: Responsive Integration … (separate flow, TODO)` — 최종 산출물이 고정 뷰포트 2벌
3. **동작 캡처 격차**: active sweep이 스크롤 헤더 diff + 탭 클릭 감지 2종뿐. 호버 diff, in-view 등장 애니메이션, 캐러셀, 스크롤 라이브러리(Lenis 등) 미캡처
4. **단일 컨텍스트 순차 빌드**: "⛔ No parallelism" — computed.json 덤프가 컨텍스트를 잠식한 상태로 전 섹션 빌드
5. **placeholder 기본값**: 본인 소유 사이트 재구축 유스케이스에서도 "[Lorem ipsum]" 강제

템플릿의 우위 요소 중 이식 대상: 모델 재량 스타일 작성(정확값 근거), 4종 인터랙션 스윕, spec 인라인 병렬 빌더(150줄 분할), Foundation 선행(폰트/파비콘/아이콘), 실콘텐츠.
vibe의 우위 요소(보존): clone-validate 결정론 게이트, pixel diff P1 루프, robots.txt 준수, 스택 불문.

### Tech Stack
- Node.js ESM plain JS (hooks/scripts/), Puppeteer optional peer
- 테스트: vitest (`hooks/scripts/__tests__/`)
- 스킬: `skills/vibe.clone/SKILL.md`(라우터), `skills/clone/SKILL.md`(본체)

### Related Code
- `hooks/scripts/clone-extract.js:563-709` — runInteractionSweep (scroll diff + tab group). TAG_SCROLL_CANDIDATES/TAG_TAB_GROUPS/TAB_CONTENT_FP 패턴을 따라 확장
- `hooks/scripts/clone-extract.js:549` — freezeAnimations: 스윕은 freeze **전**에 실행되는 계약 유지
- `hooks/scripts/clone-spec.js:104-127` — behaviorsBlock: behaviors.json 종류별 렌더러 (확장 지점)
- `hooks/scripts/clone-to-scss.js` — BEM class-plan + SCSS 덤프 (초안 생성기로 강등, 코드 변경 없음)
- `hooks/scripts/clone-validate.js:148-157` — compareValue: box prop delta >4px → P1 (게이트 보존)
- `skills/clone/SKILL.md` — Immutable Rules 1·4, Phase 3 blocking 규칙, Phase 3C TODO
- `skills/vibe.clone/SKILL.md` — 플래그 라우팅, Execution Plan

### 보존 계약 (변경 금지)
- clone-extract.js 출력 파일명/스키마의 기존 키 (behaviors.json은 키 **추가**만 허용)
- clone-validate.js exit code 계약 (0 PASS / 1 FAIL / 2 usage)
- robots.txt 기본 차단, `--no-interact` 시 스윕 전체 비활성
- Phase 5 pixel verification 루프 (P1=0까지, diffRatio 0.05)
</context>

## Task
<task>
### Phase 1: CSS 권한 역전 해소 + 반응형 통합 (P1)

1. [x] **R1 — SCSS 게이트 완화** (`skills/clone/SKILL.md`, `skills/vibe.clone/SKILL.md`)
   - Immutable Rule 1 개정: "clone-to-scss.js 산출물 = **초안(skeleton)**. 모델은 computed.json/states.json/behaviors.json에 근거를 제시할 수 있을 때만 SCSS 값 수정·재구성 가능(반응형 단위 변환, % 복원, 중복 제거). 근거 없는 eyeball 값 생성은 여전히 금지"
   - Phase 3 blocking 규칙에서 "❌ Do NOT modify SCSS CSS values" 삭제, "clone-validate.js PASS가 유일한 판정자" 명시
   - `<style>` 블록 직접 작성 금지는 유지 (스타일 소재지 규칙과 값 권한은 별개)
   - Verify: 두 SKILL.md에서 옛 금지 문구 grep 0건, clone-validate 게이트 문구 존재
2. [x] **R2 — 반응형 통합 스크립트 신규** (`hooks/scripts/clone-merge-responsive.js`)
   - 입력: MO/PC 각각의 `styles/{feature}/` (또는 sections.json 쌍) → mobile-first 병합:
     MO 선언 = 기본, PC와 다른 선언만 `@media (min-width: <bp>)` 블록 (기본 1024, `--breakpoint=` 오버라이드)
   - 동일 값 선언 dedupe, class-plan 불일치 노드는 리포트 후 스킵 (fail-open)
   - `skills/clone/SKILL.md` Phase 3C를 TODO에서 실제 절차로 교체: MO 검증 → PC 검증 → merge → Phase 5를 **두 뷰포트 모두** 재실행
   - Verify: fixture sections.json 쌍으로 vitest — 병합 SCSS에 base+media 블록 존재, 동일 선언 중복 0
3. [x] **R2 검증 배선** (`skills/clone/SKILL.md` Phase 5)
   - 병합 후 Phase 5: MO 뷰포트 → mo/screenshot.png, PC 뷰포트 → pc/screenshot.png 각각 diff. 한쪽이라도 P1이면 미완료
   - Verify: SKILL.md 절차에 두 BP 재검증 명시

### Phase 2: 동작 캡처 확장 + 병렬 빌더 (P2)

4. [x] **R3 — 인터랙션 스윕 4종 확장** (`hooks/scripts/clone-extract.js`)
   - `behaviors.hover[]`: cursor:pointer/a/button/[role=button] 후보 최대 30개 — CDP 마우스 호버 → computed diff (diffStyles 재사용) → `{label, changed, transition}`
   - `behaviors.inview[]`: scroll 0에서 opacity 0/transform 보유 노드 태깅 → 섹션별 스크롤 인 → 재스냅샷 diff → 등장 애니메이션 `{label, changed, triggerY}`
   - `behaviors.timeDriven[]`: 3초 무입력 관찰(MutationObserver) — class/style 자동 변경 노드 → 캐러셀/사이클 후보
   - `behaviors.scrollLib`: `.lenis`/`.locomotive-scroll`/`[data-scroll-container]` 감지 → `{name, evidence}`
   - 기존 계약 유지: freeze 전 실행, 개별 실패 무시(fail-open), `--no-interact`로 전체 비활성
   - Verify: 정적 fixture HTML 서버 대상 vitest — 4종 키가 스키마대로 출력
5. [x] **R3 스펙 렌더** (`hooks/scripts/clone-spec.js`)
   - behaviorsBlock에 hover/inview/timeDriven/scrollLib 렌더러 추가 (기존 scroll/interactive 패턴 동일)
   - Verify: 확장 behaviors fixture로 renderSpec 스냅샷 테스트
6. [x] **R4 — spec 인라인 병렬 빌더** (`skills/clone/SKILL.md`)
   - Phase 3 "⛔ No parallelism" 교체: 섹션별 빌더 서브에이전트 디스패치 — spec **전문을 프롬프트에 인라인**("파일 읽어라" 금지), 병렬 파일 충돌 시 worktree isolation
   - 분할 규칙: spec 파일 150줄 초과 → 하위 컴포넌트 spec으로 분할 후 디스패치 (기계적 체크: `wc -l`)
   - 순서 계약: tokens/base SCSS + Foundation 완료 후에만 병렬 시작; 빌더는 tsc 통과 후 종료; 오케스트레이터가 섹션별 clone-validate → 머지 → 빌드 게이트
   - Verify: SKILL.md에 인라인 규칙·150줄 규칙·순서 계약 명시 (구현 검증은 /vibe.test parity)

### Phase 3: 실콘텐츠 옵션 + Foundation (P3)

7. [x] **R5 — `--real-content` 플래그** (`skills/vibe.clone/SKILL.md`, `skills/clone/SKILL.md`, `hooks/scripts/clone-spec.js`)
   - 기본값 placeholder 유지. `--real-content` 시 verbatim 텍스트 사용 — 단 본인 소유/명시 허가 확인 질문 1회 (Legal Notes에 연동)
   - clone-spec.js `--real-content`: Text content 섹션 문구를 "verbatim 사용"으로 전환
   - Verify: 플래그 유무 2케이스 renderSpec 테스트
8. [x] **R6 — Foundation 단계 (Phase 2.5)** (`skills/clone/SKILL.md`, `hooks/scripts/clone-extract.js`)
   - clone-extract.js: `link[rel*=icon]`/`og:image`/webmanifest 수집 → `assets/seo/` + asset-map 등록
   - SKILL.md Phase 2.5 신설(섹션 빌드 전 순차): ① 폰트 배선(Next→next/font, 기타→_base.scss @font-face 확인) ② favicon/OG를 public/에 배치 + 메타 배선 ③ 인라인 SVG dedupe → 스택별 아이콘 모듈(예: icons.tsx)
   - Verify: fixture 페이지에서 favicon이 asset-map에 기록되는 vitest
</task>

## Acceptance Criteria
<criteria>
- [x] `npm run build && npx vitest run` 전체 통과 (기존 테스트 무수정 통과 포함)
- [x] clone-merge-responsive.js: MO/PC fixture → mobile-first 병합 SCSS, 중복 선언 0, media 블록 정확
- [x] behaviors.json에 hover/inview/timeDriven/scrollLib 키 추가, 기존 scroll/interactive 스키마 불변
- [x] clone-validate.js exit 계약·robots 기본 차단·--no-interact 동작 불변
- [x] /vibe.test parity: skills/clone ↔ skills/vibe.clone 절차 문구 정합 (금지 문구 잔존 0)
</criteria>

## Out of Scope
- 태블릿(768px) 제3 뷰포트 — MO/PC 병합 안정화 후 후속
- clone-to-scss.js 코드 변경 (초안 생성기로 역할만 강등, 로직 그대로)
- Tailwind 직접 출력 모드 (스택 불문 SCSS 유지)
- 다크모드 캡처
