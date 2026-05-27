# PLAN: /vibe.design — DESIGN.md 시각 품질 SSOT 도입

## Metadata

- **Created**: 2026-05-27
- **Author**: su-record (interview skipped — brief 직접 입력)
- **Status**: DRAFT
- **Type**: feature
- **Language**: ko
- **Downstream**: spec

---

## 1. 개요 (Overview)

> vibe에 **시각 품질 계약 문서(DESIGN.md)** 를 도입한다. CLAUDE.md(코드)·AGENTS.md(빌드)에 이은 세 번째 SSOT.

`/vibe.design` 스킬이 DESIGN.md의 생성·검증·동기화 라이프사이클을 전담하며, 기존 `/vibe.run`·`/vibe.verify`·`/vibe.review`·`/vibe.figma`가 이 파일을 시각 품질 게이트로 활용한다. **Figma에 종속되지 않으며**, Figma는 4가지 입력 소스 중 하나일 뿐이다.

---

## 2. 배경 (Why)

**왜 만드는가?**

- vibe의 두 SSOT(`CLAUDE.md`·`AGENTS.md`)는 코드/빌드 규약은 정의하지만 **시각 규약은 없다**. UI 작업 시 색·타이포·간격이 매번 재발명되거나 하드코딩됨 → "바이브 코딩의 품질 보장"이라는 vibe 본질과 어긋남.
- 기존 `design-context.json`은 Figma 코드젠 내부용 JSON — 외부 에이전트가 못 읽고, 휴먼-리더블 아님.
- Google Stitch가 `DESIGN.md` 포맷을 푸시 중이며 awesome-design-md 같은 생태계가 형성됨. `AGENTS.md`처럼 외부 표준에 올라타는 게 장기적으로 유리.

**왜 지금인가?**

- vibe가 `/vibe.spec`·`/vibe.run`·`/vibe.verify` 워크플로를 SPEC 중심으로 잡았지만 시각 트랙은 `/vibe.figma`에 흩어져 있고, "Figma 없는 프로젝트"는 시각 SSOT가 0인 상태.
- DESIGN.md 표준이 굳어지기 전에 vibe의 4 입력 경로(인터뷰·코드 역추출·레퍼런스·Figma)로 차별화 가능.

---

## 3. 타깃 사용자 (Who)

**주요 사용자**

- **vibe 사용자(UI 작업 중)**: 색·간격을 매번 다시 정하지 않고 한 번 정한 시스템을 모든 AI 에이전트가 일관되게 따르길 원함.
- **vibe 사용자(레거시 프로젝트)**: 이미 코드가 있고 토큰화가 안 된 상태에서 design system을 역추출해 정착시키고 싶음.
- **Claude Code/Codex 외 다른 AI 에이전트**: 표준 `DESIGN.md`를 프로젝트 루트에서 읽고 UI 코드를 일관되게 생성.

**사용 맥락**

- 언제: 프로젝트 초기(`vibe init` 직후) 또는 UI 변경 작업 진입 시점
- 어디서: `.vibe/` 또는 프로젝트 루트
- 어떤 환경: CLI (Claude Code / Codex)

---

## 4. 목표 & 성공 기준 (Goals)

**달성하려는 것**

- UI 작업 시 색/타이포/간격을 SSOT에서 단일 출처로 결정 → 하드코딩·드리프트 0 지향
- Figma 없이도 시각 SSOT를 만들 수 있는 4가지 진입 경로
- `/vibe.verify`·`/vibe.review`에 시각 드리프트 자동 검사 통합

**성공 지표 (측정 가능)**

| 지표 | 현재 | 목표 | 측정 방법 |
|-----|-----|-----|---------|
| UI 프로젝트의 DESIGN.md 존재율 | 0% | `vibe init` 시 stack=UI면 100% 안내 | `vibe init` 시뮬레이션 |
| `/vibe.verify`의 시각 드리프트 검출 | 미지원 | 하드코딩 hex/spacing 100% 잡힘 | 픽스처 테스트 |
| `/vibe.design init` 4 경로 동작 | 0/4 | 4/4 | 스킬 시뮬레이션 |
| Figma 의존성 | 부분 의존 | 0 (옵션) | grep "figma" in skill |

---

## 5. 핵심 기능/섹션 (What)

| 우선순위 | 항목 | 설명 |
|--------|-----|-----|
| Must | `/vibe.design init` | DESIGN.md 부재 시 4 경로(인터뷰·코드 역추출·레퍼런스·Figma) 중 1개로 생성 |
| Must | `/vibe.design lint` | Stitch 9-섹션 포맷 완전성 검증, P1/P2 finding |
| Must | `/vibe.design verify` | 구현 ↔ DESIGN.md 토큰 드리프트(하드코딩 hex/spacing/font) 검출 |
| Must | `/vibe.run` 통합 | UI 작업 진입 시 DESIGN.md 없으면 `/vibe.design init` 권유 (강제 X) |
| Must | `/vibe.verify` 통합 | UI 변경에 `vibe.design verify` 호출 — P1 drift → fail |
| Must | `/vibe.review` 통합 | 시각 P1 카테고리에 DESIGN.md 기준 적용 |
| Must | SSOT 업데이트 | `constants.ts`에 `vibe.design` 등록, UI 스택 `STACK_TO_SKILLS`에 매핑 |
| Must | 문서 업데이트 | `CLAUDE.md`·`AGENTS.md`에 DESIGN.md 역할 1줄 + `/vibe.docs` 재생성 |
| Should | `/vibe.design sync` | Figma 연결된 프로젝트 한정 양방향 동기화 |
| Should | `/vibe.figma` 양방향 | WRITE는 DESIGN.md 읽고, READ는 DESIGN.md 출력 옵션 — 상호 인식 |
| Should | awesome-design-md 레퍼런스 카탈로그 | 인기 사이트 N개 로컬 시드 (네트워크 없이 선택 가능) |
| Could | DESIGN.md → `design-context.json` 변환 | 기존 Figma 코드젠 호환성 |
| Could | `/vibe.docs design` | DESIGN.md를 ↔ Figma 토큰 export 동기화 명령 |

---

## 6. 범위 (Scope)

**이번 버전 포함**

- 신규 스킬 `skills/vibe.design/SKILL.md` (init/lint/verify/sync 서브커맨드)
- 신규 스킬 `skills/design.md/` 또는 인라인 — DESIGN.md 표준 포맷 정의 (Stitch 9-섹션)
- `constants.ts`의 `GLOBAL_SKILLS_ENTRY`에 `vibe.design` 추가
- `STACK_TO_SKILLS`의 UI 스택들에 `vibe.design` 매핑(또는 capability 단위)
- `skills/vibe.run/SKILL.md` — UI 진입 시 DESIGN.md 존재 체크 + 권유 로직
- `skills/vibe.verify/SKILL.md` — 시각 드리프트 검사 단계 추가
- `skills/vibe.review/SKILL.md` — 시각 P1 기준 DESIGN.md 참조
- `skills/vibe.figma/SKILL.md` — DESIGN.md 상호 인식 (READ/WRITE)
- `CLAUDE.md`·`AGENTS.md` 문서 업데이트
- 4 init 경로 중 **3개 우선**: 인터뷰(필수)·코드 역추출(필수)·레퍼런스(필수). Figma 추출은 기존 `/vibe.figma` 위임으로 연결만.
- 픽스처/시뮬레이션 테스트 (생성된 DESIGN.md가 Stitch 9-섹션 포함하는지)

**제외 (Non-goals)**

- DESIGN.md 자동 동기화(코드 변경 시 토큰 자동 업데이트) — Phase 2
- Figma API 직접 호출 (기존 `/vibe.figma` 위임)
- 컬러 시스템 자동 보정(WCAG 컨트라스트 자동 수정) — 별도 스킬
- DESIGN.md WYSIWYG 에디터 — vibe 범위 밖
- Mobile-only DESIGN.md 변형 — 일반 포맷이 mobile도 커버
- DESIGN.md 마이그레이션 도구 (다른 design system → DESIGN.md) — Phase 3

---

## 7-9. Look & Feel / 레이아웃 / 반응형

생략 (type=feature, UI 산출물 없음).

---

## 10. 기술 스택 & 제약

**선호 스택**

- 스킬: Markdown(SKILL.md), 기존 vibe 패턴 동일
- SSOT 수정: `src/cli/postinstall/constants.ts` TypeScript
- 테스트: vitest (기존 vibe 테스트 인프라)

**제약사항**

- ESM only, imports에 `.js` 확장자 필수
- 빌드 후 테스트: `npm run build && npx vitest run`
- DESIGN.md 위치: **프로젝트 루트** (AGENTS.md·CLAUDE.md와 동일 — 외부 에이전트 호환)
- 포맷: Stitch 9-섹션 표준 (Visual Theme/Color/Typography/Components/Layout/Depth/Do's & Don'ts/Responsive/Agent Prompt Guide)
- Figma 종속 0 — `/vibe.design` 어떤 서브커맨드도 Figma 없이 실행 가능해야 함
- `/vibe.verify` 통합 시 P1 drift만 fail, P2/P3는 warning (기존 `vibe.verify` 정책 따름)

---

## 11. 가정 & 리스크

**가정한 것**

| # | 가정 | 검증 방법 | 틀렸을 때 리스크 |
|---|-----|---------|--------------|
| 1 | Stitch 9-섹션이 모든 UI 프로젝트에 충분 | awesome-design-md 73개 샘플 검토 | 섹션 확장 필요 → 포맷 fragmentation |
| 2 | 코드 역추출이 Tailwind/CSS-vars/PostCSS 토큰을 합리적으로 잡아냄 | 픽스처 3종(plain CSS, Tailwind, styled-components)에서 시뮬레이션 | 추출 실패 → 인터뷰 폴백으로 우회 가능 |
| 3 | DESIGN.md 루트 배치가 다른 vibe 파일과 충돌 안 함 | `vibe init` 드라이런 | 위치 변경 필요 → `.vibe/DESIGN.md`로 폴백 |
| 4 | 사용자가 `/vibe.design init`을 거부해도 워크플로가 막히지 않음 | 권유는 옵트인, 강제 X | UX 마찰 → 권유 메시지 1회로 제한 |
| 5 | `/vibe.verify`의 토큰 드리프트 검사가 false positive 적음 | 픽스처에서 정상 케이스 보장 | 노이즈 → 검사 OFF 플래그 제공 |

**알려진 리스크**

- **포맷 표준 변동**: Stitch 포맷이 진화 중 → 버전 필드(`<!-- design-md-version: 1 -->`) frontmatter로 미래 호환
- **DESIGN.md vs `design-context.json` 중복**: 동일 정보 두 곳 → `/vibe.design sync`로 후자를 derived로 격하
- **사용자 피로**: 새 컨벤션 1개 추가 → 권유는 최대 1회/feature, `ultrawork`에서 자동 스킵
- **CI/build에 영향**: 시각 드리프트 검사가 vibe.verify 시간 증가 → 변경 파일만 스캔(`/vibe.verify` 기존 정책)

---

## 12. 다음 단계 (Handoff)

| 커맨드 | 결과물 |
|-------|------|
| `/vibe.spec "vibe-design"` | `.vibe/specs/vibe-design.md` + `.vibe/features/vibe-design.feature` |
| `/vibe.run "vibe-design"` | 신규 스킬 + 통합 패치 구현 |
| `/vibe.verify "vibe-design"` | BDD 시나리오 통과 검증 |

**권장 순서**

1. `/vibe.spec "vibe-design"` — PTCF SPEC 작성 (이 plan을 입력으로)
2. `/vibe.spec` Phase 4 — Race Review (P1=0 수렴까지)
3. `/vibe.run "vibe-design"` — 구현 (Logic Track only, type=feature)
4. `/vibe.verify` + `/vibe.trace` — 완주
