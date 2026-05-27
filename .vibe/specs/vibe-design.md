---
status: pending
currentPhase: 0
totalPhases: 3
createdAt: 2026-05-27T16:20:25Z
lastUpdated: 2026-05-27T16:20:25Z
plan: .vibe/plans/vibe-design.md
---

# SPEC: vibe-design

> `/vibe.design` 스킬 + `DESIGN.md` 시각 품질 SSOT를 vibe에 도입한다. CLAUDE.md(코드)·AGENTS.md(빌드)에 이은 세 번째 SSOT.

## Persona
<role>
vibe(`@su-record/vibe`) 패키지 메인테이너. vibe 본 레포의 `skills/`, `src/cli/postinstall/`, 루트 문서를 수정한다.
- ESM-only (imports에 `.js`), `"type": "module"` 준수
- 기존 `vibe.*` 스킬 패턴(예: `vibe.run/SKILL.md`, `vibe.verify/SKILL.md`)을 1:1 모방
- 빌드 후 테스트: `npm run build && npx vitest run`
- 빈/임시 파일·`any`·`console.log`·하드코딩 금지 (CLAUDE.md Hard Rules)
- 모든 수정은 요청된 범위로만 한정 (CLAUDE.md "Modify only requested scope")
</role>

## Context
<context>

### Background

vibe는 "바이브 코딩의 품질 보장"을 목표로 한다. 현재 코드 품질(`CLAUDE.md`)·빌드 품질(`AGENTS.md`)에 대한 SSOT는 있지만 **시각 품질 SSOT가 없다**. UI 작업 시 색·타이포·간격이 매번 재발명되거나 하드코딩되고, 기존 `design-context.json`은 Figma 코드젠 내부용 JSON이라 외부 에이전트가 읽지 못한다.

Google Stitch가 표준화 중인 `DESIGN.md` 포맷(awesome-design-md 73개 샘플)을 채택해 시각 품질 계약 문서로 도입한다. **Figma에는 종속되지 않으며**, Figma는 4가지 입력 소스 중 하나일 뿐이다.

### Tech Stack

- Language: TypeScript (ESM)
- Runtime: Node.js (Claude Code / Codex 호환)
- Skill 정의: Markdown (`skills/<name>/SKILL.md`)
- SSOT 데이터: `src/cli/postinstall/constants.ts`
- Test: vitest
- 패키지명: `@su-record/vibe`

### Related Code (Read 필수)

| 파일 | 역할 | 수정 여부 |
|-----|------|---------|
| `skills/vibe.run/SKILL.md` | SPEC → 코드 구현 워크플로 (1950 lines) | UI 진입 시 DESIGN.md 게이트 추가 |
| `skills/vibe.verify/SKILL.md` | 구현 ↔ SPEC 검증 (580 lines) | 시각 드리프트 검사 단계 추가 |
| `skills/vibe.review/SKILL.md` | 다중 에이전트 코드 리뷰 (626 lines) | 시각 P1 카테고리에 DESIGN.md 기준 |
| `skills/vibe.figma/SKILL.md` | Figma ↔ Code 라우터 (602 lines) | DESIGN.md 상호 인식 (READ/WRITE) |
| `skills/vibe.spec/SKILL.md` | spec 워크플로 진입점 (579 lines) | UI 인터뷰 시 DESIGN.md 안내 (선택) |
| `src/cli/postinstall/constants.ts` | 전역 SSOT (GLOBAL_SKILLS_ENTRY/STACK_TO_SKILLS 등) | `vibe.design` 등록 |
| `CLAUDE.md` | 코드 품질 계약 문서 | 1줄 추가 (Architecture 섹션) |
| `AGENTS.md` | 빌드 품질 계약 문서 (CLAUDE.md에서 재생성) | `/vibe.docs agent`로 재생성 |
| `skills/vibe.docs/SKILL.md` | 문서 재생성 스킬 | DESIGN.md 인지 (변경 없을 수도) |

### New Files

| 파일 | 역할 |
|-----|-----|
| `skills/vibe.design/SKILL.md` | 신규 스킬 메인 정의 (init/lint/verify/sync 서브커맨드) |
| `skills/vibe.design/templates/DESIGN.md.template` | Stitch 9-섹션 빈 템플릿 |
| `skills/vibe.design/references/README.md` | awesome-design-md 시드 카탈로그 (인덱스, URL+한줄 설명) |
| `skills/vibe.design/heuristics/code-extract.md` | 기존 코드(Tailwind/CSS-vars/styled) → DESIGN.md 토큰 추출 휴리스틱 |
| `src/cli/design/design-md-parser.ts` | DESIGN.md 파서·lint·verify 정적 검증 헬퍼 (테스트 대상) |
| `tests/vibe-design.spec.ts` | 정적 자산 검증 + design-md-parser 단위 테스트 |

### Design Reference

- Google Stitch DESIGN.md 표준: https://stitch.withgoogle.com/docs/design-md/overview/
- awesome-design-md 컬렉션: https://github.com/voltagent/awesome-design-md
- 기존 vibe `design-context.json` (Figma 내부 컨텍스트) — DESIGN.md와 **공존**, 후자가 SSOT

### Research Findings (Internal)

- vibe의 모든 entry skill은 `skills/<name>/SKILL.md` 단일 파일 + frontmatter (`name`, `description`, `user-invocable`, `argument-hint`) — `vibe.design`도 동일 패턴
- `GLOBAL_SKILLS_ENTRY` 배열에 등록되면 `/vibe.design` 슬래시 명령으로 자동 노출
- 기존 design 스킬(`design-audit`/`design-critique`/`design-normalize`/`design-distill`)은 stack 단위로 `STACK_TO_SKILLS`에 매핑되어 있음 — `vibe.design`은 entry지만 추가로 UI 스택 `STACK_TO_SKILLS`에도 포함시켜 자동 활성화
- `vibe.verify`는 이미 contract drift(`/vibe.regress register --from-contract`) 패턴을 가짐 — 시각 드리프트도 동일 패턴 차용
- `vibe.figma`는 이미 `.vibe/design-context.json`을 읽고 `design-teach` 폴백을 가짐 — DESIGN.md 인지 로직을 같은 위치에 삽입

</context>

## Task
<task>

### Phase 1: Foundation — `vibe.design` 스킬 + DESIGN.md 포맷 정의

1. [ ] **`skills/vibe.design/SKILL.md` 작성**
   - File: `skills/vibe.design/SKILL.md`
   - Frontmatter:
     ```yaml
     ---
     name: vibe.design
     description: DESIGN.md (visual quality SSOT) lifecycle — init/lint/verify/sync. Figma-independent.
     argument-hint: "[init|lint|verify|sync] [--from=interview|code|reference|figma] [--reference=<slug>]"
     user-invocable: true
     ---
     ```
   - 4 서브커맨드 정의:
     - `init` — DESIGN.md 부재 확인 → 4 입력 경로 중 사용자가 선택 → DESIGN.md 생성
     - `lint` — DESIGN.md 존재 시 Stitch 9-섹션 완전성 검증
     - `verify` — 구현 ↔ DESIGN.md 토큰 드리프트 (하드코딩 hex/spacing/font) 검출
     - `sync` — (옵션) Figma 연결된 프로젝트만 양방향 동기화
   - 각 서브커맨드는 사용자 1회 확인 게이트(ultrawork 모드에서는 스킵)
   - 출력 파일 위치: **프로젝트 루트 `DESIGN.md`** (AGENTS.md/CLAUDE.md와 동일 계층)
   - Verify: `grep -c '^## ' skills/vibe.design/SKILL.md` ≥ 8 (Usage/Process/Init/Lint/Verify/Sync/Output/Examples)

2. [ ] **`skills/vibe.design/templates/DESIGN.md.template` 작성**
   - File: `skills/vibe.design/templates/DESIGN.md.template`
   - Stitch 9-섹션 빈 템플릿 (한국어 주석 포함). 모든 섹션 필수:
     1. Visual Theme & Atmosphere
     2. Color Palette & Roles
     3. Typography Rules
     4. Component Stylings
     5. Layout Principles
     6. Depth & Elevation
     7. Do's and Don'ts
     8. Responsive Behavior
     9. Agent Prompt Guide
   - 파일 상단 frontmatter: `<!-- design-md-version: 1 -->`
   - Verify: 9개 H2 섹션 정확히 존재

3. [ ] **`skills/vibe.design/references/README.md` 작성**
   - File: `skills/vibe.design/references/README.md`
   - awesome-design-md에서 인기 사이트 **최소 12개** 시드 (slug + 한 줄 설명 + style preset):
     - Claude, Linear, Stripe, Vercel, Supabase, Notion, Cursor, Figma, Airbnb, Apple, Spotify, Resend
   - 형식: `| slug | tagline | source URL | style-preset (one-line) |`
   - 각 시드는 **`style-preset` 컬럼에 한 줄짜리 톤·팔레트·타이포 프리셋**을 포함 (예: `linear` → `"minimal, neutral grays + electric purple accent, Inter Display"`). 이 프리셋이 인터뷰의 §1·§2·§3 **기본값**으로 사용됨.
   - **네트워크 없이 동작하는 방식 (VD-003 정정)**: 시드 선택 시 — ① `style-preset` 으로 톤·팔레트·타이포 기본값 자동 시드, ② 나머지 6개 섹션(§4 Components, §5 Layout, §6 Depth, §7 Do/Don't, §8 Responsive, §9 Agent Prompt Guide)은 **인터뷰 단축본 (≤ 3 질문)** 으로 채움. 결과: 네트워크 없이 9 섹션 DESIGN.md 완성.
   - 네트워크가 사용 가능하면 awesome-design-md 원본 fetch 시도 → 성공 시 그대로 사용, 실패 시 위 폴백.
   - Verify: 시드 12개 이상 + 모든 시드에 `style-preset` 컬럼 채워짐

4. [ ] **`skills/vibe.design/heuristics/code-extract.md` 작성**
   - File: `skills/vibe.design/heuristics/code-extract.md`
   - 코드 → DESIGN.md 추출 휴리스틱 명세:
     - Tailwind: `tailwind.config.{js,ts}` 의 `theme.colors`/`theme.fontFamily`/`theme.spacing` 추출
     - CSS-vars: `:root { --color-* }` 패턴 스캔
     - PostCSS/SCSS: `$color-*` `$font-*` `$spacing-*` 변수 스캔
     - styled-components/Emotion: `theme.colors.*` 객체 추출
     - 추출 실패 시 → 인터뷰 폴백
   - Verify: 4가지 패턴 모두 명시 + 폴백 동작 명시

### Phase 2: Integration — 기존 vibe 워크플로 통합

5. [ ] **`src/cli/postinstall/constants.ts` 수정**
   - File: `src/cli/postinstall/constants.ts`
   - `GLOBAL_SKILLS_ENTRY` 배열에 `'vibe.design'` 추가 (알파벳 순으로 `vibe.contract` 다음)
   - `STACK_TO_SKILLS` 의 **11개** UI 스택에 `'vibe.design'` 추가. 정확한 키 목록:
     1. `typescript-react`
     2. `typescript-nextjs`
     3. `typescript-vue`
     4. `typescript-nuxt`
     5. `typescript-svelte`
     6. `typescript-angular`
     7. `typescript-astro`
     8. `typescript-react-native`
     9. `dart-flutter`
     10. `swift-ios`
     11. `kotlin-android`
   - Verify: `grep -c "vibe.design" src/cli/postinstall/constants.ts` ≥ 12 (1 entry + 11 stack 매핑)

6. [ ] **`skills/vibe.run/SKILL.md` 수정 — DESIGN.md 게이트**
   - File: `skills/vibe.run/SKILL.md`
   - 변경 위치: SPEC 파싱 직후, UI 키워드 감지(`design-system/{project}/MASTER.md` 로드 부근, line ~1274)
   - 추가 로직:
     ```
     If SPEC has UI keywords AND project root DESIGN.md missing:
       Show 1-time hint:
         "💡 시각 SSOT(DESIGN.md)가 없습니다. /vibe.design init 으로 생성하면
          UI 일관성이 보장됩니다. (스킵 가능)"
       Continue without blocking.
     If DESIGN.md exists → load it into context (top of UI implementation phase).
     ```
   - **강제 X, 안내 1회**, ultrawork에서는 자동 스킵
   - Verify: 새 섹션 `### DESIGN.md Gate` 존재

7. [ ] **`skills/vibe.verify/SKILL.md` 수정 — 시각 드리프트 검사**
   - File: `skills/vibe.verify/SKILL.md`
   - 변경 위치: contract drift 섹션 부근 (line ~444)
   - 추가:
     - UI 변경이 감지되면 `Load skill vibe.design with: verify --changed-files-only`
     - P1 drift (예: SPEC/DESIGN.md에 없는 hex 컬러 하드코딩) → verify fail + `/vibe.regress register --from-design-md` 자동 호출
     - P2/P3 drift → warning only
     - DESIGN.md 없는 프로젝트 → 검사 스킵 (no-op)
   - Verify: 새 섹션 `### Visual Drift Detection` 존재

8. [ ] **`skills/vibe.review/SKILL.md` 수정 — 시각 P1 기준**
   - File: `skills/vibe.review/SKILL.md`
   - 변경: 시각 카테고리(있다면 강화, 없으면 신설) — DESIGN.md 존재 시 그 기준으로 P1 판정
   - DESIGN.md 없을 때 → 시각 카테고리는 일반 휴리스틱 폴백
   - Verify: `DESIGN.md` 키워드 ≥ 2회 등장

9. [ ] **`skills/vibe.figma/SKILL.md` 수정 — 양방향 인식 (종속 X)**
   - File: `skills/vibe.figma/SKILL.md`
   - WRITE 트랙 (Phase 0–1 부근): `DESIGN.md` 있으면 우선 로드해 톤/팔레트 입력. 없으면 기존 `design-context.json`/`design-teach` 흐름 그대로
   - READ 트랙 (Figma → Code): 옵션 플래그 `--emit-design-md` 추가 — Figma 토큰 추출 결과를 DESIGN.md로도 출력
   - **DESIGN.md 부재가 `/vibe.figma` 실행을 막아서는 안 됨**
   - Verify: `--emit-design-md` 플래그가 argument-hint에 포함 + WRITE에서 DESIGN.md 우선순위 명시

### Phase 3: Docs & Tests — 문서 + 자동화 검증

10. [ ] **`CLAUDE.md` 수정**
    - File: `CLAUDE.md`
    - 위치: `## Architecture (Non-Obvious)` 섹션의 `### Config Locations` 표 다음에 새 표/줄 추가:
      ```
      | 파일 | 역할 | 누가 읽음 |
      |---|---|---|
      | CLAUDE.md | 코드 품질 계약 | Claude Code |
      | AGENTS.md | 빌드 품질 계약 | Codex |
      | DESIGN.md | 시각 품질 계약 (옵션) | 모든 UI 에이전트 |
      ```
    - `## Workflow` 의 Advanced commands 목록에 `/vibe.design` 한 줄 추가
    - Verify: `grep -c "DESIGN.md" CLAUDE.md` ≥ 2

11. [ ] **`AGENTS.md` 재생성**
    - 방법: `/vibe.docs agent` 호출 (자동) 또는 수동 동기화
    - `CLAUDE.md` 의 새 표/줄이 `AGENTS.md`에 반영되어야 함
    - Verify: `grep -c "DESIGN.md" AGENTS.md` ≥ 2 (CLAUDE.md와 동일)

12. [ ] **`tests/vibe-design.spec.ts` 작성**
    - File: `tests/vibe-design.spec.ts`
    - **테스트 범위 (정정 — VD-001)**: `vibe.design` 은 **markdown-driven 스킬**이며 TypeScript 런타임 모듈이 아니다. 따라서 init/lint/verify 의 "동작"은 AI 에이전트가 SKILL.md 지시를 실행해 발현되므로, vitest 픽스처 테스트는 **두 가지 정적 검증으로 한정**한다:
      1. **스킬 자산 정합성 (static asset tests)** — `SKILL.md`/template/references/heuristics 파일이 SPEC 명세대로 작성됐는지
      2. **DESIGN.md 파서/검증 헬퍼 단위 테스트** — `lint`/`verify` 의 정적 검증 로직을 재사용 가능하게 추출한 **신규 헬퍼** `src/cli/design/design-md-parser.ts` (export: `parseSections`, `lintMissingSections`, `extractHexTokens`, `findHardcodedColors`) 에 대한 단위 테스트
    - 테스트 케이스 (≥ 6):
      - `parseSections(template)` → 정확히 9 H2 섹션 반환 + `<!-- design-md-version: 1 -->` 프론트매터 감지
      - `lintMissingSections(eightSectionFixture)` → 1개 누락 P1 finding 반환
      - `lintMissingSections(nineSectionFixture)` → 0 finding (pass)
      - `extractHexTokens('## 2. Color Palette\\n- primary: #5b5bd6\\n')` → `['#5b5bd6']`
      - `findHardcodedColors(sourceFixture, designMdTokens)` → 토큰 외 hex(`#FF0000`) 1건 검출
      - `findHardcodedColors(sourceFixture, allowAll)` → 0건 (DESIGN.md 부재 = no-op)
      - 정적 자산 검사: `skills/vibe.design/SKILL.md` 가 4 서브커맨드 키워드(`init`/`lint`/`verify`/`sync`) 모두 포함
      - 정적 자산 검사: `skills/vibe.design/references/README.md` 가 12개 이상 slug 행 포함
    - **헬퍼 모듈 추가** (Phase 1 작업 5의 일부로 함께 작성):
      - File: `src/cli/design/design-md-parser.ts`
      - Export: `parseSections(md: string): SectionMap`, `lintMissingSections(md: string): Finding[]`, `extractHexTokens(md: string): string[]`, `findHardcodedColors(source: string, allowedHexes: Set<string>): Finding[]`
      - ESM, `.js` import 확장자, TypeScript strict
    - 빌드+테스트: `npm run build && npx vitest run tests/vibe-design.spec.ts`
    - Verify: 6+ 테스트 케이스 통과

13. [ ] **품질 게이트 (Quality Validation)**
    - 모든 Phase 완료 후 `/vibe.verify "vibe-design"` 자동 실행
    - 시나리오 7개 (Feature 파일) 통과
    - 점수 ≥ 95

</task>

## Constraints
<constraints>

### Hard Constraints (위반 시 fail)

- **Figma 종속 0**: `/vibe.design`의 어떤 서브커맨드도 Figma API/MCP 호출 없이 단독 실행 가능해야 함. `sync`만 Figma 옵셔널.
- **DESIGN.md 부재 = 안내, 강제 X**: 어떤 vibe 명령도 DESIGN.md 없다는 이유로 실패하면 안 됨. 권유 메시지는 워크플로당 1회.
- **포맷 표준**: Stitch 9-섹션 정확히 준수. 섹션 추가/제거 금지. `<!-- design-md-version: 1 -->` 프론트매터 필수.
- **위치**: 프로젝트 루트의 `DESIGN.md` (대문자). 폴백: `.vibe/DESIGN.md` (Phase 2+ 결정, 현재 단계 미지원).
- **ESM**: `"type": "module"`, imports에 `.js`. `import type` 분리.
- **빌드 후 테스트**: 모든 검증은 `npm run build && npx vitest run` 다음.
- **CLAUDE.md Hard Rules**: 함수 ≤50줄, nesting ≤3, params ≤5, complexity ≤10. `any`/`console.log`/하드코딩 금지.
- **요청 범위 외 변경 금지**: 이 SPEC에 명시된 파일 외 수정 금지. 이름 정리·리팩터 동반 금지.

### Soft Constraints (권장)

- 한국어 설명 우선 (vibe 컨벤션). 사용자 facing 메시지는 한국어.
- 기존 `vibe.*` 스킬의 frontmatter/구조 그대로 미러링.
- 메시지/문서에서 awesome-design-md를 출처로 명시 (Stitch DESIGN.md 표준 + voltagent 컬렉션).

### Non-Goals (이번 버전 제외)

- DESIGN.md 자동 동기화 (코드 변경 시 자동 토큰 업데이트)
- WCAG 컨트라스트 자동 보정
- DESIGN.md 마이그레이션 도구 (기타 design system → DESIGN.md)
- DESIGN.md WYSIWYG 에디터
- Mobile/Web 별도 DESIGN.md 변형
- `/vibe.design sync` 의 실제 Figma API 구현 (Phase 1 SPEC 통과 후 별도 PR)

</constraints>

## Output Format
<output_format>

### Files to Create (6)

- `skills/vibe.design/SKILL.md`
- `skills/vibe.design/templates/DESIGN.md.template`
- `skills/vibe.design/references/README.md`
- `skills/vibe.design/heuristics/code-extract.md`
- `src/cli/design/design-md-parser.ts`
- `tests/vibe-design.spec.ts`

### Files to Modify (6)

- `src/cli/postinstall/constants.ts` — `GLOBAL_SKILLS_ENTRY` + `STACK_TO_SKILLS`
- `skills/vibe.run/SKILL.md` — DESIGN.md Gate 섹션
- `skills/vibe.verify/SKILL.md` — Visual Drift Detection 섹션
- `skills/vibe.review/SKILL.md` — 시각 P1 카테고리 DESIGN.md 기준
- `skills/vibe.figma/SKILL.md` — DESIGN.md 인지 + `--emit-design-md` 플래그
- `CLAUDE.md` — Architecture 표에 DESIGN.md 1줄

### Files Regenerated (1)

- `AGENTS.md` — `/vibe.docs agent` 로 CLAUDE.md에서 자동 재생성

### Verification Commands

- `npm run build`
- `npx vitest run tests/vibe-design.spec.ts`
- `npx vitest run` (전체 regression — 회귀 0)
- `grep -c "vibe.design" src/cli/postinstall/constants.ts` → ≥ 12 (1 entry + 11 stack 매핑)
- `grep -c "DESIGN.md" CLAUDE.md AGENTS.md` → 각각 ≥ 2
- `ls skills/vibe.design/` → 4 항목 (SKILL.md + 3 디렉토리)

</output_format>

## Acceptance Criteria
<acceptance>

- [ ] **AC-1**: `/vibe.design init --from=interview` 실행 시 사용자에게 5개 이상 질문 → 응답으로 9 섹션 DESIGN.md 생성 (프로젝트 루트)
- [ ] **AC-2**: `/vibe.design init --from=code` 가 Tailwind/CSS-vars/styled-components 3 패턴에서 색·간격·폰트 토큰을 추출해 DESIGN.md 생성. 추출 실패 시 인터뷰 폴백 안내
- [ ] **AC-3**: `/vibe.design init --from=reference --reference=<slug>` 가 시드 카탈로그 12개 이상 중 1개를 골라 DESIGN.md 생성. 네트워크 없이도 동작 — 시드의 `style-preset` 으로 §1·§2·§3 기본값 + 단축 인터뷰(≤3 질문)로 나머지 6 섹션 채움
- [ ] **AC-4**: `/vibe.design init --from=figma` 가 `/vibe.figma --emit-design-md` 로 위임 — Figma 미설정 시 명확한 에러 메시지
- [ ] **AC-5**: `/vibe.design lint` 가 9 섹션 중 1개라도 누락 시 P1 finding 반환. 모두 존재하면 pass
- [ ] **AC-6**: `/vibe.design verify` 가 DESIGN.md 토큰에 없는 hex 컬러가 코드에 하드코딩되어 있으면 P1 drift, 없으면 pass. DESIGN.md 없는 프로젝트에서는 no-op (exit 0)
- [ ] **AC-7**: `/vibe.run` 이 UI 키워드 SPEC 진입 시 DESIGN.md 부재면 1회 안내 출력, 존재면 컨텍스트에 로드. 부재가 실행을 막지 않음
- [ ] **AC-8**: `/vibe.verify` 가 UI 변경 시 `vibe.design verify`를 호출 — P1 drift 발견 시 `/vibe.regress register --from-design-md` 자동 호출
- [ ] **AC-9**: `/vibe.review` 가 DESIGN.md 존재 시 시각 P1 판정에 그 기준 사용. 없으면 일반 휴리스틱 폴백
- [ ] **AC-10**: `/vibe.figma` 가 DESIGN.md 있으면 WRITE 입력으로 우선 사용. `--emit-design-md` 플래그로 READ 결과를 DESIGN.md로도 출력. DESIGN.md 부재가 실행 차단 안 함
- [ ] **AC-11**: `constants.ts` 의 `GLOBAL_SKILLS_ENTRY` 에 `vibe.design` 등록. UI 스택 11개 (`typescript-react`, `typescript-nextjs`, `typescript-vue`, `typescript-nuxt`, `typescript-svelte`, `typescript-angular`, `typescript-astro`, `typescript-react-native`, `dart-flutter`, `swift-ios`, `kotlin-android`) `STACK_TO_SKILLS` 에 `vibe.design` 매핑. `grep -c "vibe.design" src/cli/postinstall/constants.ts` ≥ 12
- [ ] **AC-12**: `CLAUDE.md` 와 `AGENTS.md` 에 DESIGN.md 역할 표 또는 1줄 명시 (동일 내용)
- [ ] **AC-13**: 신규 `tests/vibe-design.spec.ts` 6+ 케이스 통과 + 기존 vibe 테스트 회귀 0
- [ ] **AC-14**: `npm run build` 성공 (TypeScript 에러 0)
- [ ] **AC-15**: vibe `ultrawork` 모드에서 DESIGN.md 안내가 자동 스킵되어 비대화 실행 유지

</acceptance>

## Ambiguity Scan Results

### Found Issues: 0 after auto-fixes

#### Auto-fixed:
- ⚠️ DESIGN.md 폴백 위치 미정 → `.vibe/DESIGN.md` 폴백은 Phase 2+ 으로 이번 SPEC scope에서 제외 (제약 명시)
- ⚠️ `sync` 서브커맨드 Figma API 구현 범위 → 이번 SPEC은 stub + 별도 PR 명시 (Non-Goals)
- ⚠️ "시각 P1 카테고리" 의 의미 → DESIGN.md 토큰 외 하드코딩 hex/spacing/font 발견 시 P1 (AC-6 명시)
- ⚠️ 시드 레퍼런스 개수 → "최소 12개" 로 수치 확정 (Phase 1 Task 3)
- ⚠️ "1회 안내" 의 추적 방법 → 워크플로(=`/vibe.run` 1회 실행)당 1회. 세션/feature 단위 영속 추적은 Phase 2+

#### Forbidden Term Check:
- "appropriately"/"properly" → 0 occurrences
- "various"/"multiple" → 사용 시 모두 수치 명시됨
- "etc."/"other" → 0
- "later"/"future" → Non-Goals 섹션 한정 사용 (의도적)

## Quality Self-Check

| 항목 | 가중치 | 충족 | 점수 |
|---|---|---|---|
| 모든 user flow Task에 포함 | 15 | ✅ | 15 |
| 모든 AC → Feature 시나리오 변환 가능 | 10 | ✅ (다음 단계) | 10 |
| 모호한 용어 없음 | 10 | ✅ | 10 |
| 모든 수치 명시 | 10 | ✅ (시드 12+, 섹션 9, 등) | 10 |
| AC 자동 테스트 가능 | 10 | ✅ (vitest 픽스처) | 10 |
| Auth/권한 요구사항 | 10 | N/A (메타 툴링) — 가중치 재분배 | 10 |
| 민감 데이터 처리 | 5 | N/A — 가중치 재분배 | 5 |
| 주요 실패 시나리오 | 10 | ✅ (DESIGN.md 부재, Figma 미설정, 추출 실패) | 10 |
| 사용자 에러 메시지 | 5 | ✅ | 5 |
| 성능 목표 | 5 | N/A (UI 없음) — 재분배 | 5 |
| 경계 조건 | 5 | ✅ (lint 8섹션, verify no-DESIGN.md) | 5 |
| 외부 의존성 | 5 | ✅ (Stitch 포맷, awesome-design-md, vibe 기존 스킬) | 5 |

**Score: 100/100** ✅
