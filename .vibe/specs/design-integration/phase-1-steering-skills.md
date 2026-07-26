---
status: pending
currentPhase: 1
parentSpec: _index.md
---

# SPEC: design-integration — Phase 1: Steering Skills

## Persona
<role>
vibe npm 패키지의 시니어 개발자. 기존 skill 패턴(YAML frontmatter + Markdown body)을 따르며, impeccable의 디자인 커맨드 체계에서 영감을 받아 vibe 스타일로 재작성한다.
</role>

## Context
<context>

### Background
- vibe는 UI/UX 에이전트(8개)와 데이터 기반 skill(`ui-ux-pro-max`)을 갖고 있으나, 사용자가 직접 호출하는 디자인 steering command가 없음
- impeccable 프로젝트는 `/audit`, `/critique`, `/polish` 등 20개의 사용자 호출 가능한 디자인 커맨드를 제공
- vibe에 핵심 5개 + context gathering 1개 = 총 6개의 design steering skill을 추가

### Tech Stack
- Skills: `skills/{name}/SKILL.md` (YAML frontmatter + Markdown body)
- 설치 매핑: `src/cli/postinstall/constants.ts` → `STACK_TO_SKILLS`
- 기존 패턴: `techdebt`, `seo-checklist` 등 steering skill 참조

### Related Code
- `skills/ui-ux-pro-max/SKILL.md` — 기존 UI/UX 스킬 (참조용)
- `skills/techdebt/SKILL.md` — steering skill 포맷 참조
- `agents/ui/ui-antipattern-detector.md` — AI slop 패턴 보강 대상
- `src/cli/postinstall/constants.ts:25-41` — STACK_TO_SKILLS 매핑

### Design Reference
- impeccable `source/skills/` — 커맨드 구조와 흐름 참조 (콘텐츠는 재작성)
</context>

## Task
<task>

### Phase 1-1: 6개 Design Steering Skills 생성

각 skill은 다음 구조를 따른다:

```yaml
---
name: design-{name}
description: "한 줄 설명. Use when..."
triggers: [관련 키워드들]
priority: 50
---
```

**1. `skills/design-audit/SKILL.md`** — 디자인 기술 품질 점검
- 역할: a11y, 성능, 반응형, 테마, AI slop 탐지를 포함한 기술적 품질 감사
- 5개 차원 스코어링: Accessibility(0-4), Performance(0-4), Responsive(0-4), Theming(0-4), AI Slop(0-4)
- P0-P3 심각도 태깅
- 출력: 수정 없이 리포트만 (read-only)
- 의존: `ui-ux-pro-max` skill의 Pre-Delivery Checklist 확장
- triggers: `[design-audit, ui-audit, a11y-check, design-check]`

**2. `skills/design-critique/SKILL.md`** — UX 디자인 리뷰
- 역할: 시각 계층, 명확성, 감성, 인지 부하 평가
- Nielsen의 10가지 휴리스틱 기반 스코어링 (0-4점)
- 5가지 페르소나 테스트 (파워 유저, 초보자, 접근성 필요, 스트레스 상황, 모바일)
- 출력: 디자인 리뷰 리포트 (수정 없음)
- triggers: `[design-critique, ux-review, design-review]`

**3. `skills/design-polish/SKILL.md`** — 출시 전 최종 패스
- 역할: 픽셀 단위 정렬, 일관성, 마이크로 디테일 최종 점검 + 수정
- 체크리스트: 정렬, 간격, 인터랙션 상태(hover/focus/active/disabled/loading/error/success), 카피, console.log 제거
- 출력: 직접 수정 적용
- triggers: `[design-polish, ui-polish, final-pass, ship-ready]`

**4. `skills/design-normalize/SKILL.md`** — 디자인 시스템 정렬
- 역할: 디자인 토큰 일관성 확보, 하드코딩된 값을 CSS 변수로 교체
- 프로세스: MASTER.md 로드 → 불일치 탐지 → 토큰 교체
- 대상: 색상, 타이포그래피, 간격, 그림자, 라운딩
- triggers: `[design-normalize, design-system, token-align]`

**5. `skills/design-distill/SKILL.md`** — 불필요한 복잡도 제거
- 역할: 불필요한 시각 요소 제거, 점진적 공개, 단순화
- 원칙: 모든 요소가 존재 이유를 증명해야 함
- 대상: 장식적 요소, 중복 정보, 과도한 애니메이션, 불필요한 카드 래핑
- triggers: `[design-distill, simplify-ui, ui-simplify, strip-ui]`

**6. `skills/design-teach/SKILL.md`** — 프로젝트 디자인 컨텍스트 수집
- 역할: 프로젝트별 디자인 컨텍스트 수집 및 저장
- 프로세스: 코드베이스 탐색 → 사용자 질문 (대상 사용자, 브랜드 성격, 미학 방향, 제약조건) → `.claude/vibe/design-context.json` 저장
- 다른 design-* 스킬이 이 컨텍스트를 자동 참조
- triggers: `[design-teach, design-setup, design-context]`

### Phase 1-2: AI Slop 패턴 보강

**파일: `agents/ui/ui-antipattern-detector.md`**

기존 Anti-Pattern Categories에 "AI Generated Aesthetic" 섹션 추가:

```markdown
### AI Generated Aesthetic (AI Slop Tells)
- [ ] Color: cyan-on-dark, purple-to-blue gradients, neon accents, gradient text on metrics
- [ ] Layout: hero metric template (big number + label), nested cards, identical card grids, centered everything
- [ ] Typography: Inter/Roboto/Open Sans as lazy default, monospace as decoration
- [ ] Effects: glassmorphism everywhere, one-sided colored border rounded rect, generic drop shadows, sparklines as decoration
- [ ] Motion: bounce/elastic easing, animations >500ms for feedback
- [ ] Copy: cliched loading messages ("Herding pixels"), redundant headers repeating intros
```

### Phase 1-3: STACK_TO_SKILLS 등록

**파일: `src/cli/postinstall/constants.ts`**

5개 steering skill을 web frontend 스택에 추가:

```typescript
// 추가할 스킬 목록
const DESIGN_SKILLS = ['design-audit', 'design-critique', 'design-polish', 'design-normalize', 'design-distill'];
```

매핑 변경:
- `typescript-react`: 기존 + `design-audit`, `design-critique`, `design-polish`, `design-normalize`, `design-distill`
- `typescript-nextjs`: 동일
- `typescript-vue`: 동일
- `typescript-nuxt`: 동일
- `typescript-svelte`: 동일
- `typescript-angular`: 동일
- `typescript-astro`: 동일
- Mobile 스택 (`react-native`, `flutter`, `ios`, `android`): `design-audit`, `design-critique`만 추가 (polish/normalize/distill은 CSS/Tailwind 기반이므로 네이티브 모바일에 부적합)
- Mobile 스택용 design-audit/critique는 웹 전용 항목(CSS, Tailwind, @container, srcset 등)을 자동 스킵하고 플랫폼 공통 항목(시각 계층, 인지 부하, 접근성, AI slop)만 평가

`design-teach`는 GLOBAL_SKILLS에 추가 (모든 프로젝트에서 사용 가능):

```typescript
export const GLOBAL_SKILLS: ReadonlyArray<string> = [
  // ... 기존 목록
  'design-teach',
];
```

</task>

## Constraints
<constraints>
- 각 SKILL.md는 기존 vibe skill 포맷(YAML frontmatter + Markdown body) 준수
- impeccable 콘텐츠 직접 복사 금지 — 영감만 받아 vibe 스타일로 재작성
- `ui-ux-pro-max`의 기존 기능과 중복하지 않되, 상호 보완적으로 설계
- design-audit은 read-only (리포트만), design-polish/normalize/distill은 수정 적용
- 함수 길이 ≤50줄, 네스팅 ≤3레벨 (constants.ts 수정 시)
- design-teach 저장 경로: `.claude/vibe/design-context.json`
- design-normalize에서 MASTER.md 없을 때: "Run /design-teach or create MASTER.md first" 안내 후 기본 토큰으로 대체
- 각 skill 실행 시 대상 파일이 없을 때: 명확한 에러 메시지 + 사용법 안내 출력
</constraints>

## Output Format
<output_format>

### Files to Create (6개)
- `skills/design-audit/SKILL.md`
- `skills/design-critique/SKILL.md`
- `skills/design-polish/SKILL.md`
- `skills/design-normalize/SKILL.md`
- `skills/design-distill/SKILL.md`
- `skills/design-teach/SKILL.md`

### Files to Modify (2개)
- `agents/ui/ui-antipattern-detector.md` — AI Slop Tells 섹션 추가
- `src/cli/postinstall/constants.ts` — STACK_TO_SKILLS + GLOBAL_SKILLS 업데이트

### Verification Commands
- `npm run build` (TypeScript 컴파일 성공)
- `npx vitest run src/cli/postinstall/` (기존 테스트 통과)
- `ls skills/design-*/SKILL.md` (6개 파일 존재 확인)

</output_format>

## Acceptance Criteria
<acceptance>
- [ ] 6개 design-* skill 파일이 `skills/` 디렉토리에 존재
- [ ] 각 skill의 YAML frontmatter에 name, description, triggers, priority 포함
- [ ] design-audit은 5차원 스코어링 체계 포함 (Accessibility, Performance, Responsive, Theming, AI Slop)
- [ ] design-critique은 Nielsen 10 heuristics + 5 personas 포함
- [ ] design-teach는 `.claude/vibe/design-context.json` 저장 로직 명시
- [ ] ui-antipattern-detector.md에 "AI Generated Aesthetic" 섹션 추가됨
- [ ] constants.ts의 STACK_TO_SKILLS에 web frontend 스택 업데이트됨
- [ ] constants.ts의 GLOBAL_SKILLS에 `design-teach` 추가됨
- [ ] Mobile 스택에는 design-audit, design-critique만 추가됨
- [ ] `npm run build` 성공
- [ ] 기존 postinstall 테스트 통과
</acceptance>
