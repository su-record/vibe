# Feature: vibe-design — DESIGN.md visual quality SSOT

**SPEC**: `.vibe/specs/vibe-design.md`

## User Story

**As a** vibe 사용자 (UI 작업 중)
**I want** 색·타이포·간격 토큰을 단일 출처(DESIGN.md)로 정의하고, 모든 AI 에이전트와 vibe 명령이 이 SSOT를 일관되게 사용하길 원한다
**So that** Figma 없이도 시각 품질이 보장되고, 하드코딩·드리프트가 자동 검출된다

## Scenarios

### Scenario 1: DESIGN.md 인터뷰 생성 (Happy Path)
```gherkin
Scenario: /vibe.design init --from=interview 로 DESIGN.md 생성
  Given 프로젝트 루트에 DESIGN.md 가 존재하지 않는다
  And 사용자가 `/vibe.design init --from=interview` 를 실행한다
  When 시스템이 톤·컬러·타이포·레이아웃·반응형 등 5개 이상 질문을 한다
  And 사용자가 각 질문에 응답한다
  Then 프로젝트 루트에 DESIGN.md 가 생성된다
  And DESIGN.md 는 Stitch 9 섹션을 모두 포함한다
  And DESIGN.md 첫 줄에 `<!-- design-md-version: 1 -->` 가 있다
```
**Verification**: SPEC AC-1, AC-5

### Scenario 2: 기존 코드에서 토큰 역추출
```gherkin
Scenario: Tailwind 프로젝트에서 DESIGN.md 자동 생성
  Given 프로젝트에 `tailwind.config.ts` 가 있고 `theme.colors` 에 3개 이상 색이 정의되어 있다
  And 프로젝트 루트에 DESIGN.md 가 없다
  When 사용자가 `/vibe.design init --from=code` 를 실행한다
  Then 추출된 색·폰트·spacing 토큰이 DESIGN.md `## 2. Color Palette` 등에 채워진다
  And 추출 토큰 ≥ 3 개
  And 추출 실패 영역(예: 폰트 미정의)은 인터뷰 폴백으로 안내된다

Scenario: CSS-vars 프로젝트
  Given 프로젝트에 `src/styles/tokens.css` 의 `:root { --color-primary: #5b5bd6; ... }` 가 있다
  When `/vibe.design init --from=code` 를 실행한다
  Then DESIGN.md 토큰이 CSS-vars 값과 일치한다

Scenario: styled-components theme
  Given 프로젝트에 `theme.ts` export 객체에 `colors`, `space`, `fonts` 가 있다
  When `/vibe.design init --from=code` 를 실행한다
  Then 동일하게 토큰이 추출된다
```
**Verification**: SPEC AC-2

### Scenario 3: 레퍼런스 카탈로그 선택
```gherkin
Scenario: awesome-design-md 시드 1개 선택해 시작 (네트워크 차단 환경)
  Given 프로젝트 루트에 DESIGN.md 가 없다
  And `skills/vibe.design/references/README.md` 시드 카탈로그에 `linear` 가 있다
  And `linear` 시드의 `style-preset` 컬럼이 채워져 있다
  And 네트워크가 차단되어 있다
  When 사용자가 `/vibe.design init --from=reference --reference=linear` 를 실행한다
  Then `style-preset` 값으로 §1 Visual Theme / §2 Color Palette / §3 Typography 기본값이 시드된다
  And 단축 인터뷰(≤ 3 질문)로 나머지 6 섹션(§4–§9)이 채워진다
  And 생성된 DESIGN.md 는 9 섹션을 모두 포함한다
```
**Verification**: SPEC AC-3

### Scenario 4: Figma 추출 위임
```gherkin
Scenario: /vibe.figma 로 위임해 DESIGN.md 출력
  Given Figma URL 이 제공된다
  When 사용자가 `/vibe.design init --from=figma <url>` 또는 `/vibe.figma <url> --emit-design-md` 를 실행한다
  Then `/vibe.figma` READ 트랙이 호출되어 토큰이 추출된다
  And 프로젝트 루트에 DESIGN.md 가 생성된다
  And `/vibe.design init` 단독으로 Figma 없이도 (다른 from 옵션으로) 항상 실행 가능하다 (종속 X)

Scenario: Figma 미설정 시 명확한 에러
  Given Figma 액세스 토큰이 설정되어 있지 않다
  When 사용자가 `/vibe.design init --from=figma <url>` 를 실행한다
  Then "Figma 미설정 — 다른 from 옵션을 사용하거나 `vibe figma key` 설정 필요" 메시지가 출력된다
  And 다른 vibe 명령은 영향을 받지 않는다
```
**Verification**: SPEC AC-4

### Scenario 5: lint — 9 섹션 완전성
```gherkin
Scenario: 섹션 누락 시 P1 finding
  Given 프로젝트 루트 DESIGN.md 가 9 섹션 중 8 섹션만 가지고 있다 (`## 6. Depth & Elevation` 누락)
  When 사용자가 `/vibe.design lint` 를 실행한다
  Then P1 finding 이 1건 반환된다
  And 메시지는 "Section '6. Depth & Elevation' is missing" 형식이다

Scenario: 모든 섹션 존재 시 pass
  Given 프로젝트 루트 DESIGN.md 가 9 섹션을 모두 가진다
  When `/vibe.design lint` 를 실행한다
  Then exit 0, finding 0건
```
**Verification**: SPEC AC-5

### Scenario 6: verify — 시각 드리프트 검출
```gherkin
Scenario: 하드코딩된 hex 컬러가 토큰에 없음
  Given 프로젝트 루트 DESIGN.md 의 `## 2. Color Palette` 에 `#5b5bd6` 만 정의되어 있다
  And 소스 코드 어딘가에 `#FF0000` 이 하드코딩되어 있다
  When 사용자가 `/vibe.design verify` 를 실행한다
  Then P1 drift 가 1건 이상 반환된다
  And 메시지는 위반 파일·라인·발견한 hex 값을 포함한다

Scenario: DESIGN.md 없는 프로젝트
  Given 프로젝트 루트에 DESIGN.md 가 존재하지 않는다
  When `/vibe.design verify` 를 실행한다
  Then no-op 으로 종료된다 (exit 0)
  And "DESIGN.md not found — skipping visual drift check" 메시지가 출력된다
  And 다른 vibe 명령에 영향을 주지 않는다
```
**Verification**: SPEC AC-6

### Scenario 7: 통합 — /vibe.run UI 진입 게이트
```gherkin
Scenario: DESIGN.md 부재 시 1회 안내 (강제 X)
  Given SPEC 에 UI 키워드(`UI`, `landing`, `dashboard` 등)가 포함되어 있다
  And 프로젝트 루트에 DESIGN.md 가 없다
  When `/vibe.run "<feature>"` 가 UI Phase 에 진입한다
  Then "💡 시각 SSOT(DESIGN.md)가 없습니다…" 안내가 출력된다
  And 워크플로는 차단되지 않고 계속 진행된다
  And 동일 워크플로 내 재진입 시 안내는 반복되지 않는다

Scenario: ultrawork 자동 스킵
  Given ultrawork 모드가 활성화되어 있다
  When 동일 조건 진입
  Then 안내가 출력되지 않는다
  And TODO 로만 기록된다

Scenario: DESIGN.md 존재 시 자동 로드
  Given 프로젝트 루트에 DESIGN.md 가 있다
  When UI 구현 Phase 에 진입한다
  Then DESIGN.md 가 컨텍스트에 자동 로드된다
```
**Verification**: SPEC AC-7, AC-15

### Scenario 8: 통합 — /vibe.verify 시각 드리프트
```gherkin
Scenario: UI 변경에 vibe.design verify 자동 호출
  Given 변경 파일에 `.tsx` 또는 `.css` 가 포함된다
  When `/vibe.verify <feature>` 가 실행된다
  Then 내부적으로 `Load skill vibe.design with: verify --changed-files-only` 가 호출된다
  And P1 drift 발견 시 verify 가 fail 상태로 표시된다
  And `/vibe.regress register --from-design-md` 가 자동 호출된다
  And P2/P3 drift 는 warning 만 출력하고 verify 는 pass 로 진행한다
```
**Verification**: SPEC AC-8

### Scenario 9: 통합 — /vibe.review 시각 P1
```gherkin
Scenario: DESIGN.md 기준 시각 P1 (v1: hex-only)
  Given 프로젝트 루트에 DESIGN.md 가 있다
  When `/vibe.review` 가 실행된다
  Then 시각 카테고리 P1 판정은 DESIGN.md 토큰을 기준으로 한다
  And DESIGN.md 토큰에 없는 **hex 컬러** 하드코딩은 P1 후보가 된다 (v1 범위)
  And spacing/font 드리프트는 v1 에서 P1 으로 판정하지 않는다 (Phase 2+)

Scenario: DESIGN.md 없는 프로젝트 — 폴백
  Given DESIGN.md 가 없다
  When `/vibe.review` 가 실행된다
  Then 시각 카테고리는 일반 휴리스틱 폴백으로 진행된다
```
**Verification**: SPEC AC-9

### Scenario 10: 통합 — /vibe.figma 양방향 인식 (종속 X)
```gherkin
Scenario: WRITE 트랙 — DESIGN.md 우선
  Given 프로젝트 루트에 DESIGN.md 가 있다
  When `/vibe.figma <plan.md> --create-design` 이 실행된다
  Then WRITE 트랙은 DESIGN.md 의 톤·팔레트·타이포를 우선 입력으로 사용한다
  And `design-context.json`/`design-teach` 흐름은 폴백으로만 동작한다

Scenario: READ 트랙 — DESIGN.md 출력 옵션
  Given 사용자가 `/vibe.figma <url> --emit-design-md` 를 실행한다
  When Figma 토큰 추출이 완료된다
  Then 프로젝트 루트에 DESIGN.md 가 생성/갱신된다
  And 기존 Figma 코드젠 출력물도 함께 생성된다

Scenario: DESIGN.md 부재가 /vibe.figma 차단 안 함
  Given 프로젝트 루트에 DESIGN.md 가 없다
  When `/vibe.figma <url>` 가 실행된다
  Then 기존 동작 그대로 진행된다 (DESIGN.md 강제 생성 X)
```
**Verification**: SPEC AC-10

### Scenario 11: SSOT 등록 (constants.ts)
```gherkin
Scenario: constants.ts 에 vibe.design 등록
  Given `src/cli/postinstall/constants.ts` 수정 후 빌드
  When `node -e "import('./dist/cli/postinstall/constants.js').then(m => console.log(m.GLOBAL_SKILLS_ENTRY))"`
  Then 출력에 `vibe.design` 이 포함된다
  And UI 스택 11개(`typescript-react`, `typescript-nextjs`, `typescript-vue`, `typescript-nuxt`, `typescript-svelte`, `typescript-angular`, `typescript-astro`, `typescript-react-native`, `dart-flutter`, `swift-ios`, `kotlin-android`)의 STACK_TO_SKILLS 매핑에도 포함된다
```
**Verification**: SPEC AC-11

### Scenario 12: 문서 동기화 (CLAUDE.md / AGENTS.md)
```gherkin
Scenario: CLAUDE.md 에 DESIGN.md 역할 명시
  When `grep "DESIGN.md" CLAUDE.md` 실행
  Then 매칭 줄이 2건 이상 (역할 표 + workflow 언급)

Scenario: AGENTS.md 동기화
  Given CLAUDE.md 수정 완료
  When `/vibe.docs agent` 또는 수동 동기화
  Then `grep "DESIGN.md" AGENTS.md` 도 동일하게 2건 이상 매칭
```
**Verification**: SPEC AC-12

### Scenario 13: 자동화 테스트
```gherkin
Scenario: 신규 테스트 통과 + 회귀 0
  When `npm run build && npx vitest run tests/vibe-design.spec.ts`
  Then 6개 이상 테스트 케이스 모두 통과
  When `npx vitest run`
  Then 기존 vibe 테스트도 모두 통과 (회귀 0)
```
**Verification**: SPEC AC-13, AC-14

## Coverage

| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1, AC-5 | ⬜ |
| 2 | AC-2 | ⬜ |
| 3 | AC-3 | ⬜ |
| 4 | AC-4 | ⬜ |
| 5 | AC-5 | ⬜ |
| 6 | AC-6 | ⬜ |
| 7 | AC-7, AC-15 | ⬜ |
| 8 | AC-8 | ⬜ |
| 9 | AC-9 | ⬜ |
| 10 | AC-10 | ⬜ |
| 11 | AC-11 | ⬜ |
| 12 | AC-12 | ⬜ |
| 13 | AC-13, AC-14 | ⬜ |
