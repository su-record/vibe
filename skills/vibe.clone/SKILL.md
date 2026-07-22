---
name: vibe.clone
description: URL → 마크업 레벨 픽셀 완벽 클론 — 헤드리스 브라우저로 라이브 사이트 캡처 후 현재 프로젝트 스택에 맞게 스캐폴딩
argument-hint: "<url> [<url2>...] [--name=<feature>] [--sub] [--mo-only] [--pc-only] [--ignore-robots] [--no-interact] [--real-content]"
user-invocable: true
---

# /vibe.clone

URL을 받아 **마크업 수준으로 정밀 복제**하고 현재 프로젝트 스택에 맞춰 컴포넌트/스타일을 스캐폴딩한다.

→ 모든 동작은 **`clone` 스킬**의 규칙을 따른다. 이 커맨드는 라우터일 뿐, 휴리스틱·추정·생략은 금지.

## Usage

```
/vibe.clone <url>                              # 인터랙티브: MO+PC 양쪽 캡처 (기본)
/vibe.clone <url> --mo-only                    # 모바일(375×812)만 캡처
/vibe.clone <url> --pc-only                    # 데스크탑(1440×900)만 캡처
/vibe.clone <url> --name=stripe-clone          # 기능 이름 지정 (기본: 호스트명 kebab-case)
/vibe.clone <url> --sub                        # 사이트맵/메가메뉴 하위 메뉴 URL까지 함께 클론
/vibe.clone <url1> <url2> <url3>               # 다중 페이지 클론 (같은 사이트의 여러 경로)
/vibe.clone <url> --ignore-robots              # robots.txt 무시 (사이트 소유자 허가 있을 때만)
/vibe.clone <url> --no-interact                # 능동 인터랙션 스윕 끄기 (완전 결정론적·재현 가능 캡처)
/vibe.clone <url> --real-content               # 텍스트 verbatim 유지 (본인 소유/허가 확인 1회 필수)
```

## Argument Routing

```
Step 1) 인자 수집
  urls         = http(s):// 로 시작하는 모든 인자
  feature      = --name=<value> | URL host → kebab-case
  scope        = --mo-only | --pc-only | (기본: both)
  sub          = --sub 플래그 유무
  ignoreRobots = --ignore-robots 플래그 유무
  realContent  = --real-content 플래그 유무 (소유/허가 확인 질문 1회 후 적용)

Step 2) 인자 검증
  urls.length === 0  → 사용자에게 URL 입력 요청, 중단
  ! /^https?:\/\//.test(url) → "유효한 URL이 아닙니다" 에러, 중단
  --sub && urls.length > 1 → "--sub는 기준 URL 1개와 함께 사용하세요" 에러, 중단

Step 2.5) --sub URL 확장
  - node {{VIBE_PATH}}/hooks/scripts/clone-extract.js suburls <url> \
      --out=/tmp/{feature}/menu-urls.json [--ignore-robots]
  - menu-urls.json.urls 를 urls 로 사용
  - 수집 기준: /sitemap 우선, 없으면 header/nav/mega-menu
  - 포함: 같은 origin + 같은 locale prefix의 하위 메뉴 URL
  - 제외: 외부 링크, 언어 전환, 검색, TOP, 푸터 정책/문의/파트너/뉴스룸 링크

Step 3) 실행 진입
  → 아래 Execution Plan Phase 0부터 순차 실행
  → URL 다중 입력 시 각 URL마다 별도 feature 디렉토리 (URL path 기반 suffix)
```

## Execution Plan

다음을 순차 실행한다. **Phase 단계 건너뛰기 금지**.

```
Phase 0: Setup
  - .vibe/config.json + package.json → 스택 감지
  - feature 이름 결정, 디렉토리 생성
  - --sub이면 /tmp/{feature}/menu-urls.json 생성 후 URL 목록 확장

Phase 1: Capture (병렬 — scope에 따라 MO/PC 동시)
  - node {{VIBE_PATH}}/hooks/scripts/clone-extract.js capture <url> \
      --out=/tmp/{feature}/{bp}/ --viewport={WxH} --bp={mo|pc}
  - 출력: rendered.html, computed.json, screenshot.png, states.json, behaviors.json, asset-map.json, assets/ (images·fonts·seo)
  - behaviors.json = 능동 인터랙션 스윕 4종+ (스크롤 헤더 diff · 탭 클릭 콘텐츠 스왑 · 호버 diff ·
    in-view 등장 애니메이션 · time-driven 캐러셀 후보 · 스무스 스크롤 라이브러리 감지).
    JS로 세팅되는 상태(정적 CSS로는 안 잡힘)를 포착 — 클론 정확도의 핵심. --no-interact 로 비활성화.
  - assets/seo/ = favicon·apple-touch-icon·og:image·webmanifest (Foundation 단계에서 배선)

Phase 2: Refine (BP마다 독립)
  - node {{VIBE_PATH}}/hooks/scripts/clone-refine.js \
      /tmp/{feature}/{bp}/rendered.html /tmp/{feature}/{bp}/computed.json \
      --out=/tmp/{feature}/{bp}/sections.json --states=/tmp/{feature}/{bp}/states.json --bp={mo|pc}
  - sections.json 에 section.interaction(인터랙션 모델 추정) + section.states(상태 규칙) 포함

Phase 2.5: Foundation (순차 — 섹션 빌드 전)
  - 폰트 배선(Next → next/font) · assets/seo/ → public/ (favicon·OG·manifest 메타 배선)
  - 인라인 SVG dedupe → 아이콘 모듈 · scrollLib 감지 시 페이지 레벨 배선

Phase 3: Scaffold (BP 순차 — MO 완료 후 PC / 섹션은 병렬 빌더 디스패치)
  - Step 0: node {{VIBE_PATH}}/hooks/scripts/clone-spec.js \
      /tmp/{feature}/{bp}/sections.json \
      --out=./components/{feature}/_specs/{bp}/ --feature={feature} [--real-content]
    → 섹션별 빌드 계약서(_specs/{bp}/{Section}.spec.md). 디스패치 전 TODO(인터랙션 모델 확정·상태 목록·텍스트 교체) 해결
    → spec 150줄 초과 시 하위 컴포넌트 spec으로 분할 (기계적 체크 — wc -l)
  - Step A: node {{VIBE_PATH}}/hooks/scripts/clone-to-scss.js \
      /tmp/{feature}/{bp}/sections.json \
      --out=./styles/{feature}/{bp}/ --feature={feature}
    → SCSS 초안. 이후 근거(computed/states/behaviors) 인용 시 수정 허용 — clone-validate가 판정자
  - 병렬 디스패치: 섹션별 빌더 서브에이전트 — spec 전문을 프롬프트에 인라인, 병렬 파일 쓰기는 worktree 격리
  - Step B: node {{VIBE_PATH}}/hooks/scripts/clone-validate.js \
      ./styles/{feature}/{bp}/ /tmp/{feature}/{bp}/sections.json --section={Name}
  - 섹션마다 PASS 후 완료 처리 (머지 순서: 하위 컴포넌트 → 래퍼)

Phase 3C: Responsive Merge (MO+PC 모두 Phase 5 통과 후)
  - node {{VIBE_PATH}}/hooks/scripts/clone-merge-responsive.js \
      --mo=./styles/{feature}/mo/ --pc=./styles/{feature}/pc/ \
      --out=./styles/{feature}/ [--breakpoint=1024]
    → mobile-first 병합: MO 선언 = 기본, PC diff만 @media (min-width) 블록
  - 컴포넌트 import를 병합 index.scss로 전환 → Phase 4 → Phase 5를 두 뷰포트 모두 재실행

Phase 4: Compile Gate (clone SKILL.md 규칙)
Phase 5: Pixel Verification (P1=0까지 루프 — clone SKILL.md 규칙; 병합 후엔 MO·PC 양쪽)
```

## Prerequisites

- **puppeteer**: optional peer dependency. 미설치 시 Phase 1에서 `npm install puppeteer` 안내 후 중단
- **Chromium**: puppeteer 자동 다운로드 (`npx puppeteer browsers install chrome`)
- **dev 서버**: Phase 4-5에서 `npm run dev` 호출. 스크립트가 미정의면 사용자에게 명시
- **robots.txt 준수**: 기본 차단. `--ignore-robots` 는 사이트 소유자/CTF/학습 명시일 때만

## Output Locations

```
/tmp/{feature}/                  # 작업 디렉토리 (산출물 원본)
  ├── menu-urls.json             # --sub URL 확장 결과
  ├── mo/, pc/                   # rendered.html, computed.json, screenshot.png, states.json, behaviors.json, sections.json, assets/
  └── project-tokens.json        # 기존 프로젝트 토큰 인덱스

./components/{feature}/          # 빌더가 작성한 컴포넌트 (.tsx/.vue/.svelte/.html)
./components/{feature}/_specs/{mo,pc}/  # clone-spec.js가 생성한 섹션별 빌드 계약서 (*.spec.md)
./styles/{feature}/              # 최종 병합 SCSS (Phase 3C 산출 — mobile-first @media)
  ├── mo/, pc/                   # BP별 SCSS 초안 (clone-to-scss.js + 근거 기반 수정)
  ├── _tokens.scss               # CSS 변수 (병합)
  ├── _base.scss                 # @font-face
  ├── _shared.scss               # 유틸 + 글로벌 동작 (scroll-lib 등)
  ├── sections/_<name>.scss      # 섹션별 partial (병합)
  ├── index.scss                 # 마스터 orchestrator (병합)
  └── class-plan.json            # 노드 id → BEM 클래스 (병합)
./public/images/{feature}/       # 다운로드된 이미지/폰트
./public/ (프로젝트 관례 경로)     # favicon·OG·manifest (assets/seo/ 에서 배선)
```

## Legal Notes

```
이 커맨드는 다음 용도에만 사용:
  ✅ 클론 코딩 학습 (마크업/레이아웃 연구)
  ✅ 본인 소유 사이트 재구축
  ✅ 명시적 허가 받은 리디자인

금지:
  ❌ 저작권 콘텐츠(텍스트/이미지/로고) 무단 재게시
  ❌ 피싱/브랜드 사칭 룩어라이크 사이트
  ❌ robots.txt 우회 (소유자 허가 없는 --ignore-robots)

Claude 기본 행동:
  - 저작권 텍스트 → 플레이스홀더("[Lorem ipsum]") 교체
  - --real-content → 소유/허가 확인 질문 1회 후 verbatim 유지 (본인 사이트 재구축 유스케이스)
  - robots.txt 차단 경로 → 명시적 --ignore-robots 없으면 거부
  - 사용자 의도가 사칭/기만이면 즉시 거부
```

## Bundled implementation


# vibe.clone — Markup-Level Website Clone

## Core Principles

```
The rendered DOM is the source of truth for markup. Screenshots are for pixel verification only.

✅ Puppeteer-rendered DOM (post-JS) → HTML structural mapping
✅ Computed CSS → SCSS direct conversion (no guessing)
✅ All remote assets (images, fonts) → downloaded locally and rewritten to project paths
✅ Claude handles semantic decisions only: tag selection, component splitting, interactions
✅ Screenshots are used for verification only, not generation
```

## Immutable Rules

```
1. Do NOT generate CSS values by guessing or eyeballing screenshots.
   ✅ clone-to-scss.js output is a DRAFT (skeleton), not a frozen artifact. You MAY
      rewrite SCSS values/selectors — but ONLY with evidence cited from computed.json /
      states.json / behaviors.json (value correction, dedupe, selector restructuring).
   ✅ clone-validate.js PASS is the sole judge of value correctness — not self-report.
   ❌ Do NOT invent values with no extraction evidence ("looks like 18px" is forbidden).
   ❌ Do NOT write CSS values directly inside scoped <style> blocks — style LOCATION
      rule: all values live in styles/{feature}/ SCSS (value authority and style
      location are separate rules; both hold).

2. Do NOT hotlink remote assets. All images/fonts must be downloaded and rewritten.

3. Do NOT skip the pixel verification loop (Phase 5). The clone is incomplete without it.

4. Do NOT copy textual content verbatim from copyrighted sources for production use.
   This skill is for layout/markup learning ("클론 코딩"). Replace text with placeholders
   or user-provided copy when shipping a real product.
   Exception: `--real-content` — the user confirms (once, explicitly) they own the site
   or have permission. Then keep text verbatim; clone-spec.js is invoked with
   `--real-content` so specs mark copy as verbatim.

5. Do NOT build a section without confirming its interaction model. The model in
   sections.json is a static-DOM heuristic — verify scroll-driven vs click-driven vs
   time-driven vs hover against the live site. Misidentifying it is the #1 clone failure mode.

6. Do NOT ship default-state-only. Implement every harvested state (hover/focus/active/open/
   tab-switch) from states.json / the section spec.

7. Do NOT ignore behaviors.json. The ACTIVE interaction sweep (scroll-state diffs,
   click-driven tab content-swap detection, hover diffs, in-view entrance animations,
   time-driven mutation candidates, smooth-scroll-lib detection) catches JS-set state
   that static CSS harvesting is blind to. When the spec's "Dynamic behaviors" block
   conflicts with the static interaction heuristic, the active capture wins.
```

## Full Flow

```
Input: a URL (or multiple URLs for multi-page clones)

→ Phase 0: Setup (stack detection, feature naming, working dir)
→ Phase 1: Capture (Puppeteer → rendered HTML + computed CSS + screenshots + assets)
→ Phase 2: Refine (DOM → sections.json per breakpoint; + interaction model + states)
→ Phase 2.5: Foundation (fonts / favicon / OG / SVG icons — sequential, before any section)
→ Phase 3: Scaffold (spec gate → SCSS draft + builder dispatch, parallel per section)
→ Phase 3C: Responsive merge (clone-merge-responsive.js — mobile-first @media)
→ Phase 4: Compile gate
→ Phase 5: Pixel verification loop (BOTH viewports after merge)
```

> Read `references/setup-and-layout.md` for the working-directory layout and code-output paths.

---

## Phase 0: Setup

> Read `references/setup-and-layout.md` for the full Phase 0 setup steps (stack detection, feature naming, directories, component indexing, design token scan).

---

## Phase 1: Capture ← Headless browser (parallel MO/PC)

**Coordinator pattern: run MO/PC capture as parallel workers.**

### BLOCKING Command — Use only clone-extract.js for capture

```bash
# [CLONE_SCRIPT] = {{VIBE_PATH}}/hooks/scripts/clone-extract.js

# Mobile (375×812)
node {{VIBE_PATH}}/hooks/scripts/clone-extract.js capture <URL> \
  --out=/tmp/{feature}/mo/ \
  --viewport=375x812 \
  --bp=mo

# Desktop (1440×900)
node {{VIBE_PATH}}/hooks/scripts/clone-extract.js capture <URL> \
  --out=/tmp/{feature}/pc/ \
  --viewport=1440x900 \
  --bp=pc
```

⛔ **Writing custom capture scripts (puppeteer-fetch.mjs, etc.) is forbidden.**
⛔ **Do NOT use WebFetch or curl** — they cannot render JS-driven SPAs.
✅ Use clone-extract.js. If output is unsatisfactory, modify the script.

> Read `references/capture-rules.md` for the full per-breakpoint output directory listing and the deterministic capture rule set (networkidle wait, asset resolution, states/behaviors harvesting, SEO asset harvest).

---

## Phase 2: Refine ← DOM → sections.json (independent per BP)

### BLOCKING Command — Writing custom refine scripts is forbidden

```bash
# MO  (--states is optional — auto-resolved as states.json next to computed.json)
node {{VIBE_PATH}}/hooks/scripts/clone-refine.js \
  /tmp/{feature}/mo/rendered.html \
  /tmp/{feature}/mo/computed.json \
  --out=/tmp/{feature}/mo/sections.json \
  --states=/tmp/{feature}/mo/states.json \
  --bp=mo

# PC
node {{VIBE_PATH}}/hooks/scripts/clone-refine.js \
  /tmp/{feature}/pc/rendered.html \
  /tmp/{feature}/pc/computed.json \
  --out=/tmp/{feature}/pc/sections.json \
  --states=/tmp/{feature}/pc/states.json \
  --bp=pc
```

⛔ **Phase 3 is blocked until refine completes for all required BPs.**
⛔ **Do NOT parse rendered.html with custom Python/Node scripts.**
✅ Use clone-refine.js output as-is. If unsatisfactory, modify the script.

> Read `references/refine-rules.md` for the full refinement rule set and the sections.json output schema.

---

## Phase 2.5: Foundation ← sequential, BEFORE any section build

Nothing renders right until the foundation exists. Do this yourself (not delegated) — it
touches shared files:

```
1. Fonts: verify _base.scss @font-face srcs point at downloaded assets/fonts/ files.
   Next.js stack → wire via next/font/local in the layout instead of raw @font-face.
2. Favicon / OG / manifest: copy assets/seo/* → public/ (project convention path),
   wire metadata (layout.tsx metadata / <head>) to the local files.
3. SVG icons: collect inline <svg> from rendered.html, dedupe by path data,
   emit one stack-appropriate icon module (e.g. components/{feature}/icons.tsx).
   Name by visual function (SearchIcon, ArrowRightIcon, LogoIcon).
4. Global behaviors from behaviors.json: scrollLib detected → install/wire page-level
   (Lenis etc.); global keyframes/scroll-snap → styles/{feature}/_shared.scss.
5. Verify: compile passes before moving on.
```

---

## Phase 3: Scaffold ← stack-specific code generation

**⛔ Implement MO fully first → pass verification → then PC. No responsive conversion in this phase.**
**⛔ CSS values must use computed.json output as-is. No vw/clamp/@media in this phase.**

### BLOCKING Command — SCSS must only use script output

```bash
# Step 0: Generate per-section build-contract specs (run once per BP)
node {{VIBE_PATH}}/hooks/scripts/clone-spec.js \
  /tmp/{feature}/{bp}/sections.json \
  --out=/path/to/project/components/{feature}/_specs/{bp}/ \
  --feature={feature} [--real-content]

# Step A: Auto-generate SCSS draft (run once per BP — note the per-BP out dir)
node {{VIBE_PATH}}/hooks/scripts/clone-to-scss.js \
  /tmp/{feature}/{bp}/sections.json \
  --out=/path/to/project/styles/{feature}/{bp}/ \
  --token-file=/tmp/{feature}/project-tokens.json

# Step B: Per-section validation (after writing each section's component code)
node {{VIBE_PATH}}/hooks/scripts/clone-validate.js \
  /path/to/project/styles/{feature}/{bp}/ \
  /tmp/{feature}/{bp}/sections.json \
  --section={SectionName}
```

⛔ **No section is built without a completed spec.** Step 0 emits `_specs/{Section}.spec.md`
   (interaction model + **active-capture Dynamic behaviors** (scroll/tab/hover/in-view/
   time-driven/scroll-lib) + states + computed CSS + assets + text + checklist).
   clone-spec.js auto-loads `behaviors.json` from the sections.json dir and attaches matching
   behaviors per section. Before dispatching a section's builder, Claude reviews its spec and
   resolves every `TODO` (confirm interaction model, list states to implement, choose tags,
   replace copyrighted text — skipped with --real-content). The spec is the contract AND the
   audit trail — it forces extraction rigor before any code is written.
⛔ **clone-to-scss.js must run first (Step A) — its output is the DRAFT every section starts
   from.** After that, SCSS edits are allowed per Immutable Rule 1 (evidence-cited only);
   clone-validate.js PASS is the judge.
⛔ **Do NOT write custom SCSS / spec generation scripts.**
⛔ **Do NOT proceed past a section without a clone-validate.js PASS for it.**

Phase 3A: MO Scaffold — parallel builder dispatch
  Input: /tmp/{feature}/mo/sections.json
  → Phase 4 (MO compile) → Phase 5 (MO pixel verification)

Phase 3B: PC Scaffold
  Same process as MO, input /tmp/{feature}/pc/sections.json → styles/{feature}/pc/
  → Phase 4 (PC compile) → Phase 5 (PC pixel verification)

Phase 3C: Responsive Integration (after both MO+PC pass Phase 5)
  1. node {{VIBE_PATH}}/hooks/scripts/clone-merge-responsive.js \
       --mo=/path/to/project/styles/{feature}/mo/ \
       --pc=/path/to/project/styles/{feature}/pc/ \
       --out=/path/to/project/styles/{feature}/ \
       [--breakpoint=1024]
     → mobile-first merge: MO declarations = base, PC diffs → @media (min-width) block
  → Phase 4 (compile) → Phase 5 at BOTH viewports against each BP's screenshot.
     ⛔ The clone is NOT complete until the MERGED build passes Phase 5 at both.
```

> Read `references/scaffold-phases.md` for the full Phase 3A prep/dispatch/merge builder contract (framework mapping, 150-line split rule, clone-validate.js PASS/FAIL loop detail), Phase 3C steps 2–3 (import switch, pc-only/mo-only selector review), and Claude's role checklist.

---

## Phase 4: Compile Gate

```
No round cap. Loop until compile succeeds (or stuck → ask user).

0. Capture baseline (before Phase 3): record existing tsc + build errors
   → Phase 4 only fixes NEW errors

1. TypeScript: vue-tsc / svelte-check / tsc --noEmit
2. Build: npm run build (120s timeout)
3. Dev server: npm run dev → detect port → polling

On error: parse → auto-fix → re-check
Termination:
  ✅ Success: all checks pass → enter Phase 5
  ⚠️ Stuck: same errors as previous round → ask user
     1. Direct fix instructions → retry
     2. "proceed" — record remaining errors as TODO, proceed to Phase 5
     3. "abort" — halt
  ultrawork mode: on stuck, record TODO without prompting and proceed

⛔ Must enter Phase 5 after Phase 4 passes. Do NOT output a "completion summary".
```

---

## Phase 5: Pixel Verification Loop ← MANDATORY

**⛔ Phase 5 is mandatory, not optional. Enter automatically after Phase 4.**
**⛔ Skipping Phase 5 makes the entire clone "incomplete".**

```
No round cap. Loop until P1=0 (or stuck → ask user).
Infrastructure: src/infra/lib/browser/ (Puppeteer + CDP) — same as figma Phase 6.

1. Render scaffolded page in dev server at matching viewport
2. Capture screenshot → pixelmatch comparison against /tmp/{feature}/{bp}/screenshot.png
   diffRatio > 0.05 (clone target is tighter than figma) → P1
3. CSS comparison: live computed CSS vs /tmp/{feature}/{bp}/computed.json
   delta > 2px → P1, ≤ 2px → P2
4. Asset audit: every <img>/background-image resolves to local public/images/ path → else P1
5. Fix P1 first (refer to computed.json, no guessing) → revalidate compile → reload

Narrowing scope:
  Round 1: P1+P2+P3
  Round 2: P1+P2
  Round 3+: P1 only

Termination:
  ✅ P1=0 AND no new findings → complete
  ⚠️ Stuck: same findings → ask user (resolve / proceed / abort)
  ultrawork mode: on stuck, record TODO without prompting and complete

Responsive: after MO verification → change viewport → repeat against PC screenshot
Post-merge (Phase 3C): re-run at BOTH viewports (375×812 vs mo/screenshot.png,
  1440×900 vs pc/screenshot.png) — either failing means the merge regressed; fix the
  merged SCSS (evidence: the per-BP sections.json), never by re-guessing values
Cleanup: shut down browser + dev server

⛔ "Completion summary" output only allowed after Phase 5 completes.
```

---

## Legal, Ethical & Error Recovery Reference

> Read `references/legal-and-error-recovery.md` for the full legal/ethical usage notes (intended use, prohibited use, --real-content flow) and the Error Recovery troubleshooting table.
