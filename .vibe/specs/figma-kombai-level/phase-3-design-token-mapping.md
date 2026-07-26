---
status: pending
phase: 3
parent: _index.md
---

# SPEC: Phase 3 — 디자인 토큰 매핑

## Persona
<role>
vibe.figma 스킬 개발자. Figma에서 추출한 디자인 값을 프로젝트의 기존
CSS variables / SCSS tokens / Tailwind config에 매핑하여,
새 토큰을 만들기 전에 기존 토큰을 우선 사용하도록 한다.
</role>

## Context
<context>
### Background
현재 vibe.figma Phase 3 "SCSS Setup" (line 263~279)에서 `_tokens.scss`를 새로 생성한다.
tree.json의 CSS 수치에서 primitive + semantic 토큰을 만든다.

문제: 프로젝트에 이미 디자인 토큰이 있어도 무시하고 새로 만든다.
- 기존 `$color-primary: #3b82f6` 가 있는데 Figma에서 `#3b82f6` → `$color-navy-medium` 새로 생성
- 기존 Tailwind `bg-blue-500` 대신 커스텀 SCSS 토큰 생성
- 기존 CSS variables `--color-primary` 와 중복 토큰 생성

Kombai는 "Design tokens integration for CSS editing"으로 기존 프로젝트 토큰과 연동한다.

### 현재 코드
- `skills/vibe.figma/SKILL.md` Phase 3-0 (line 263~279): SCSS Setup + 토큰 생성
- `skills/vibe.figma.convert/SKILL.md` 섹션 2: _tokens.scss 구조 (primitive/semantic)
- `skills/vibe.figma.extract/SKILL.md` 섹션 4: 재료함 — 색상 팔레트, 폰트 목록, 간격 패턴

### 토큰 소스 (프로젝트별)
| 스택 | 토큰 위치 |
|------|-----------|
| SCSS | `_variables.scss`, `_tokens.scss`, `_colors.scss` |
| Tailwind | `tailwind.config.{js,ts}` → theme.extend |
| CSS Variables | `:root { --color-* }` in `global.css`, `variables.css` |
| CSS-in-JS | `theme.ts`, `tokens.ts` |
</context>

## Task
<task>
### 3-1. 프로젝트 토큰 스캔 (`skills/vibe.figma/SKILL.md`)

Phase 0 "Setup" (line 47~70) 에 토큰 스캔 추가:

1. [ ] 기존 디자인 토큰 수집 절차:
   ```
   6. 기존 디자인 토큰 스캔:

   SCSS 토큰:
     Glob: **/_variables.scss, **/_tokens.scss, **/_colors.scss, **/variables.scss
     → 패턴: $변수명: 값; 추출
     → 결과: { name: '$color-primary', value: '#3b82f6', file: 'styles/_variables.scss' }

   CSS Variables:
     Glob: **/global.css, **/variables.css, **/root.css, **/app.css
     Grep: "--[a-zA-Z].*:" 패턴
     → 결과: { name: '--color-primary', value: '#3b82f6', file: 'styles/global.css' }

   Tailwind:
     tailwind.config.{js,ts,mjs} 존재 시 Read
     → theme.colors, theme.extend.colors 에서 커스텀 색상 추출
     → theme.spacing, theme.fontSize 에서 커스텀 값 추출
     → 결과: { name: 'blue-500', value: '#3b82f6', type: 'tailwind', category: 'color' }

   CSS-in-JS:
     Glob: **/theme.{ts,js}, **/tokens.{ts,js}, **/design-tokens.{ts,js}
     → export 객체에서 color/spacing/typography 키 추출

   통합 결과 → project-tokens:
     {
       colors: [{ name, value, source }],
       spacing: [{ name, value, source }],
       typography: [{ name, value, source }],
       other: [{ name, value, source }]
     }
   ```
   저장: /tmp/{feature}/project-tokens.json에 통합 결과 저장 (Phase 3-0에서 Read로 로드)

   - File: `skills/vibe.figma/SKILL.md` Phase 0 섹션
   - Verify: 토큰 스캔 절차가 4가지 소스(SCSS/CSS/Tailwind/CSS-in-JS)에 대해 명시됨

### 3-2. 토큰 매칭 로직 (`skills/vibe.figma/SKILL.md`)

Phase 3-0 "SCSS Setup" (line 263~279) 수정:

1. [ ] `_tokens.scss` 생성 시 기존 토큰 우선 사용:
   ```
   토큰 매핑 규칙 (Phase 3-0 수정):

   1. Figma 재료함의 각 값에 대해:
      a. project-tokens에서 동일한 값 검색
         - 색상: hex 정규화 후 완전 일치 (Figma RGBA 0-1 → hex 변환, 3자리→6자리 확장, 대소문자 무시)
           ※ alpha < 1 인 경우: 8자리 hex (#RRGGBBAA) 또는 rgba() 함수로 변환하여 매칭
         - 간격: px 값 완전 일치 (rem→px 변환: 1rem=16px)
         - 폰트: family 이름 포함 매칭
      b. 매칭됨 → 기존 토큰 참조
         - SCSS: @use 'path' 로 기존 파일 import, $변수명 사용
         - Tailwind: 해당 유틸리티 클래스 사용 (bg-blue-500)
         - CSS Variables: var(--color-primary) 사용
      c. 매칭 안 됨 → 새 토큰 생성 (기존 방식)

   2. _tokens.scss 구조 변경:
      ```scss
      // ─── 기존 토큰 참조 ────────────────────
      @use '../../styles/variables' as v;

      // ─── 매핑 (기존 토큰 → 피처 시맨틱) ────
      $color-bg-primary: v.$color-navy;          // 기존 토큰 재사용
      $color-text-primary: v.$color-white;       // 기존 토큰 재사용

      // ─── 새 토큰 (매칭 안 된 값만) ─────────
      $color-accent-gold: #ffd700;               // 새 값 (기존 토큰에 없음)
      $space-section-gap: 42px;                  // 새 값
      ```

   3. 매핑 결과 보고:
      "토큰 매핑: 12/18 매칭 (67%), 6개 새 토큰 생성"
   ```
   - File: `skills/vibe.figma/SKILL.md` Phase 3-0 섹션
   - Verify: 매칭 우선 규칙이 명시됨

### 3-3. convert 스킬 토큰 참조 업데이트 (`skills/vibe.figma.convert/SKILL.md`)

1. [ ] `_tokens.scss` 구조 섹션 업데이트:
   ```
   _tokens.scss 구조 (업데이트):

   // 기존 토큰이 있는 프로젝트:
   @use '../../styles/variables' as v;

   // 매핑 — 기존 토큰 → 피처 시맨틱 별칭
   $color-bg-primary: v.$color-navy;

   // 새 토큰 — 기존에 없는 값만
   $color-accent-gold: #ffd700;

   // 기존 토큰이 없는 프로젝트:
   // 현재와 동일 (primitive + semantic 전체 생성)

   규칙:
     - 같은 값의 토큰 중복 생성 금지
     - 기존 토큰의 이름 변경 금지
     - 새 토큰은 피처 스코프 네이밍 ($feature-color-xxx)
   ```
   - File: `skills/vibe.figma.convert/SKILL.md` 섹션 2
   - Verify: 기존 토큰 참조 패턴이 추가됨

### 3-4. extract 스킬 토큰 추출 보강 (`skills/vibe.figma.extract/SKILL.md`)

1. [ ] 재료함 정리에 토큰 매핑 힌트 추가:
   ```
   재료함 정리 (확장):

   색상 팔레트:
     #0a1628 → project-token: $color-navy (매칭)
     #ffd700 → project-token: 없음 (새 토큰 필요)

   간격 패턴:
     8px → project-token: $space-sm (매칭)
     42px → project-token: 없음 (새 토큰 필요)

   매핑 요약 테이블:
     | Figma 값 | 기존 토큰 | 상태 |
     |----------|-----------|------|
     | #0a1628 | $color-navy | ✅ 재사용 |
     | #ffd700 | — | 🆕 생성 |
   ```
   - File: `skills/vibe.figma.extract/SKILL.md` 섹션 4
   - Verify: 매핑 힌트가 재료함에 포함됨
</task>

## Constraints
<constraints>
- 스킬 파일(`.md`)만 수정 — TypeScript 인프라 코드 변경 없음
- 토큰 스캔은 Glob + Grep + Read 기반 (파서 라이브러리 없음)
- 색상 매칭은 hex 완전 일치만 (유사색 매칭 없음)
- 기존 토큰 파일 수정 금지 — 참조만 함
- Tailwind 프로젝트에서는 SCSS 토큰 대신 Tailwind 클래스 우선
- 토큰 소스 우선순위 (복수 시스템 공존 시): Tailwind > CSS Variables > SCSS > CSS-in-JS (프로젝트 주 스택 기준, Tailwind 프로젝트면 Tailwind 최우선)
- 토큰 스캔 성능: 100개 파일 기준 5초 이내 완료
- 토큰 파일 파싱 실패 시 해당 파일 스킵 후 경고 로그 (전체 중단하지 않음)
</constraints>

## Output Format
<output_format>
### Files to Modify
- `skills/vibe.figma/SKILL.md` — Phase 0 토큰 스캔, Phase 3-0 매핑 로직
- `skills/vibe.figma.convert/SKILL.md` — _tokens.scss 구조 업데이트
- `skills/vibe.figma.extract/SKILL.md` — 재료함 매핑 힌트

### Files to Create
- 없음

### Verification Commands
- `grep "project-tokens" skills/vibe.figma/SKILL.md` → 매칭
- `grep "매핑" skills/vibe.figma.convert/SKILL.md` → 매칭
- `grep "매핑" skills/vibe.figma.extract/SKILL.md` → 매칭
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] Phase 0에서 4가지 토큰 소스(SCSS/CSS/Tailwind/CSS-in-JS) 스캔 절차가 명시됨
- [ ] project-tokens 통합 결과 포맷이 정의됨 (colors, spacing, typography)
- [ ] Phase 3-0에서 기존 토큰 우선 매칭 → 매칭 안 되면 새 생성 규칙이 명시됨
- [ ] _tokens.scss에 기존 토큰 @use 참조 + 새 토큰 분리 구조가 정의됨
- [ ] 매핑 결과 보고 포맷이 정의됨 ("12/18 매칭 (67%)")
- [ ] 기존 토큰 파일 수정 금지 원칙이 명시됨
- [ ] Tailwind 프로젝트에서의 토큰 처리 방식이 구분됨
</acceptance>
