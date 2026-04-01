---
status: pending
currentPhase: 2
parentSpec: _index.md
---

# SPEC: design-integration — Phase 2: Design References

## Persona
<role>
vibe npm 패키지의 시니어 개발자이자 디자인 시스템 전문가. impeccable의 7개 reference 도메인에서 영감을 받아 vibe 스타일의 deep reference 가이드를 작성한다.
</role>

## Context
<context>

### Background
- 현재 `ui-ux-pro-max`은 CSV 데이터 기반 검색 + Quick Reference 체크리스트를 제공
- 서술적 가이드(왜 이렇게 해야 하는지, 구체적 구현 방법)가 부족
- impeccable은 7개 deep reference 파일을 통해 typography, color, spatial, motion, interaction, responsive, UX writing 가이드를 제공
- 이 reference 파일들을 `skills/ui-ux-pro-max/reference/`에 추가하여 기존 CSV 데이터와 상호 보완

### Tech Stack
- Reference 파일: Markdown (`.md`)
- 위치: `skills/ui-ux-pro-max/reference/{domain}.md`
- 기존 skill에서 `reference/` 디렉토리 참조 패턴 사용

### Related Code
- `skills/ui-ux-pro-max/SKILL.md` — 기존 UI/UX 스킬 (참조 포인트 추가 필요)
- `skills/ui-ux-pro-max/scripts/search.py` — 도메인 검색 스크립트 (변경 불필요)
- impeccable `source/skills/frontend-design/reference/` — 구조 참조 (콘텐츠 재작성)

</context>

## Task
<task>

### Phase 2-1: 7개 Reference 파일 생성

위치: `skills/ui-ux-pro-max/reference/`

**1. `typography.md`** — 타이포그래피 시스템 가이드
- Modular scale 계산법 (ratio 1.25-1.5)
- 계층 구조: ≤5 sizes (display, h1, h2, body, small)
- 최소 본문 크기: 16px
- 줄 간격: body 1.5-1.75, heading 1.1-1.3
- 줄 길이: 45-75ch (`max-width: 65ch` 권장)
- 폰트 페어링 원칙: contrast (serif+sans), 같은 x-height
- 폰트 로딩: `font-display: swap`, WOFF2 포맷 우선
- OpenType features: `font-feature-settings`
- 접근성: ≥16px body, ≥200% zoom 지원

**2. `color-and-contrast.md`** — 색상 시스템 가이드
- OKLCH 색공간: 지각적 균일성, CSS `oklch(L C H)` 사용
- Tinted neutrals: 순수 회색 대신 브랜드 색조가 들어간 중립색
- 60-30-10 rule: 지배색(60%), 보조색(30%), 강조색(10%)
- 다크 모드: 단순 반전 금지, 별도 색상 토큰 세트
- 접근성: WCAG AA (4.5:1 텍스트, 3:1 UI 요소)
- 색상 팔레트 생성: primary에서 lightness 조절로 9단계
- 의미적 색상: success(green), error(red), warning(amber), info(blue)

**3. `spatial-design.md`** — 공간 시스템 가이드
- 4pt 기반 spacing system: 4, 8, 12, 16, 24, 32, 48, 64, 96
- 그리드: `repeat(auto-fit, minmax(280px, 1fr))`
- 시각적 계층: 관련 요소는 가깝게, 무관한 요소는 멀게 (Gestalt proximity)
- Container queries: `@container` 활용
- Squint test: 흐릿하게 봐도 계층이 보여야 함
- 여백의 미학: 더 넓은 여백 = 더 고급스러운 인상
- 일관성: 같은 관계 → 같은 간격

**4. `motion-design.md`** — 모션 디자인 가이드
- Duration rules: micro(100-150ms), medium(200-300ms), large(400-500ms)
- Easing: `ease-out` 진입, `ease-in` 퇴장, `ease-in-out` 이동
- 고급 easing: cubic-bezier (ease-out-quart, ease-out-expo)
- Stagger: 50-100ms 간격, `delay = index * stagger`
- GPU 가속: `transform`, `opacity`만 애니메이션 (width/height 금지)
- `prefers-reduced-motion`: 필수 대응 (장식적 모션 제거, 기능적 모션은 즉시 전환)
- 체감 성능: skeleton screen, optimistic UI
- Scroll-driven animations: `animation-timeline: scroll()`

**5. `interaction-design.md`** — 인터랙션 디자인 가이드
- 8가지 상태: default, hover, focus, active, disabled, loading, error, success
- Focus ring: `outline: 2px solid`, `:focus-visible` 사용 (`:focus` 아닌)
- 폼 디자인: label 필수, 인라인 검증, 에러 메시지는 필드 근처
- 모달: focus trap 필수, Escape 닫기, backdrop click 닫기
- 드롭다운: anchor positioning, 키보드 탐색 (↑↓ Enter Escape)
- 터치 타겟: 최소 44x44px, 8px 이상 간격
- 로딩 패턴: skeleton > spinner > progress bar (상황별 선택)

**6. `responsive-design.md`** — 반응형 디자인 가이드
- Mobile-first: `min-width` 미디어 쿼리
- Content-driven breakpoints: 콘텐츠가 깨지는 지점에서 설정
- 일반적 참조점: 375px(mobile), 768px(tablet), 1024px(desktop), 1440px(wide)
- `pointer`/`hover` 미디어 쿼리: 터치 vs 마우스 구분
- Safe areas: `env(safe-area-inset-*)` (노치, 다이나믹 아일랜드)
- srcset: `<img srcset="..." sizes="...">` 반응형 이미지
- 유동적 타이포그래피: `clamp(1rem, 2.5vw, 2rem)`
- Container queries: 부모 크기 기반 반응형

**7. `ux-writing.md`** — UX 라이팅 가이드
- 버튼 라벨: 동사 + 목적어 (`프로필 저장`, `비밀번호 변경`)
- 에러 메시지 공식: 무엇이 잘못됐는지 + 왜 + 어떻게 해결하는지
- Empty states: 상황 설명 + 다음 행동 CTA
- 확인 대화상자: 결과를 동사로 (`삭제`, `취소` — "확인"/"네" 금지)
- Voice vs Tone: voice는 일관, tone은 상황별 조절
- 번역 팽창: 독일어 +30%, 일본어 -30% → 유동적 레이아웃
- 마이크로카피: 도움말, 툴팁, placeholder는 간결하게
- 수/시간 포매팅: locale-aware (`Intl.NumberFormat`, `Intl.DateTimeFormat`)

### Phase 2-2: ui-ux-pro-max SKILL.md 업데이트

기존 `skills/ui-ux-pro-max/SKILL.md`에 reference 파일 안내 섹션 추가:

```markdown
## Deep Reference Guides

For detailed guidance on specific domains, see the reference files:

| Reference | Domain | Use When |
|-----------|--------|----------|
| [typography](reference/typography.md) | Type systems, font pairing, scales | Setting up type hierarchy |
| [color-and-contrast](reference/color-and-contrast.md) | OKLCH, tinted neutrals, dark mode | Choosing colors, dark mode |
| [spatial-design](reference/spatial-design.md) | Spacing systems, grids, hierarchy | Layout and spacing decisions |
| [motion-design](reference/motion-design.md) | Easing, staggering, reduced motion | Adding animations |
| [interaction-design](reference/interaction-design.md) | States, focus, forms, modals | Building interactive elements |
| [responsive-design](reference/responsive-design.md) | Mobile-first, fluid, containers | Responsive implementation |
| [ux-writing](reference/ux-writing.md) | Labels, errors, empty states | Writing UI copy |
```

</task>

## Constraints
<constraints>
- 각 reference 파일은 1500-2500단어 범위 (너무 짧으면 shallow, 너무 길면 context 낭비). 총 7개 합계 ≤15,000단어 목표
- reference는 필요한 섹션만 선택적 로딩 가능하도록 H2 헤더로 구분 (skill이 관련 섹션만 Read)
- impeccable 콘텐츠 직접 복사 금지 — 같은 도메인의 가이드를 vibe 스타일로 재작성
- 코드 예제는 Tailwind CSS + React 우선 (가장 많은 사용자), 프레임워크 무관한 설명도 병행
- 각 reference는 "DO" / "DON'T" 패턴을 포함하되 과도하지 않게 (3-5개)
- 접근성 가이드라인은 WCAG 2.1 AA 기준
- 기존 ui-ux-pro-max의 Quick Reference와 중복하지 않고 "왜"와 "어떻게"에 집중
</constraints>

## Output Format
<output_format>

### Files to Create (7개)
- `skills/ui-ux-pro-max/reference/typography.md`
- `skills/ui-ux-pro-max/reference/color-and-contrast.md`
- `skills/ui-ux-pro-max/reference/spatial-design.md`
- `skills/ui-ux-pro-max/reference/motion-design.md`
- `skills/ui-ux-pro-max/reference/interaction-design.md`
- `skills/ui-ux-pro-max/reference/responsive-design.md`
- `skills/ui-ux-pro-max/reference/ux-writing.md`

### Files to Modify (1개)
- `skills/ui-ux-pro-max/SKILL.md` — "Deep Reference Guides" 섹션 추가

### Verification Commands
- `ls skills/ui-ux-pro-max/reference/*.md | wc -l` (7개 파일)
- 각 파일 2000-3000단어 확인: `wc -w skills/ui-ux-pro-max/reference/*.md`

</output_format>

## Acceptance Criteria
<acceptance>
- [ ] 7개 reference 파일이 `skills/ui-ux-pro-max/reference/`에 존재
- [ ] 각 파일은 1500-2500단어 범위 (총 합계 ≤15,000단어)
- [ ] typography.md에 modular scale 계산법과 폰트 페어링 원칙 포함
- [ ] color-and-contrast.md에 OKLCH, 60-30-10 rule, dark mode 가이드 포함
- [ ] spatial-design.md에 4pt spacing system과 container queries 포함
- [ ] motion-design.md에 duration rules, easing curves, reduced-motion 대응 포함
- [ ] interaction-design.md에 8가지 상태와 focus ring 가이드 포함
- [ ] responsive-design.md에 mobile-first와 content-driven breakpoints 포함
- [ ] ux-writing.md에 에러 메시지 공식과 번역 팽창 가이드 포함
- [ ] ui-ux-pro-max SKILL.md에 "Deep Reference Guides" 섹션 추가됨
- [ ] 각 reference에 DO/DON'T 패턴 3-5개 포함
- [ ] impeccable 콘텐츠 직접 복사 없음 (재작성)
- [ ] 각 reference 파일 로딩 시간: ≤500ms (Claude 도구 기준)
</acceptance>
