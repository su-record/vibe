---
name: vibe.clone
description: 참조할 라이브 사이트 URL이 있고 그 마크업을 현재 스택으로 재현할 때 — 헤드리스 브라우저로 렌더된 DOM·computed CSS·에셋을 캡처해 픽셀 검증까지 루프
argument-hint: "<url> [<url2>...] [--name=<feature>] [--sub] [--mo-only] [--pc-only] [--ignore-robots] [--no-interact] [--real-content]"
user-invocable: true
---

# /vibe.clone

URL을 받아 **마크업 수준으로 정밀 복제**하고 현재 프로젝트 스택에 맞춰 컴포넌트/스타일을 스캐폴딩한다.
휴리스틱·추정·생략은 금지 — 아래 Immutable Rules가 판정 기준이다.

## Usage

```
/vibe.clone <url>                              # 인터랙티브: MO+PC 양쪽 캡처 (기본)
/vibe.clone <url> --mo-only                    # 모바일(375×812)만 캡처
/vibe.clone <url> --pc-only                    # 데스크탑(1440×900)만 캡처
/vibe.clone <url> --name=stripe-clone          # 기능 이름 지정 (기본: 호스트명 kebab-case)
/vibe.clone <url> --sub                        # 사이트맵/메가메뉴 하위 메뉴 URL까지 함께 클론
/vibe.clone <url1> <url2> <url3>               # 다중 페이지 클론 (같은 사이트의 여러 경로)
/vibe.clone <url> --ignore-robots              # robots.txt 무시 (사이트 소유자 허가 있을 때만)
/vibe.clone <url> --no-interact                # 능동 인터랙션 스윕 끄기 (완전 결정론적 캡처)
/vibe.clone <url> --real-content               # 텍스트 verbatim 유지 (본인 소유/허가 확인 1회 필수)
```

## Argument Routing

```
Step 1) 인자 수집
  urls         = http(s):// 로 시작하는 모든 인자
  feature      = --name=<value> | URL host → kebab-case
  scope        = --mo-only | --pc-only | (기본: both)
  sub / ignoreRobots / realContent = 각 플래그 유무
    (realContent 는 소유·허가 확인 질문 1회 후 적용)

Step 2) 인자 검증 — 하나라도 걸리면 중단
  urls.length === 0          → 사용자에게 URL 입력 요청
  ! /^https?:\/\//.test(url) → "유효한 URL이 아닙니다"
  --sub && urls.length > 1   → "--sub는 기준 URL 1개와 함께 사용하세요"

Step 3) 실행 진입 → Execution Plan Phase 0
  URL 다중 입력 시 각 URL마다 별도 feature 디렉토리 (URL path 기반 suffix)
```

## Core Principles

```
The rendered DOM is the source of truth for markup. Screenshots are for pixel verification only.

✅ Puppeteer-rendered DOM (post-JS) → HTML structural mapping
✅ Computed CSS → SCSS direct conversion (no guessing)
✅ All remote assets (images, fonts) → downloaded locally and rewritten to project paths
✅ The active harness handles semantic decisions only: tag selection, component splitting, interactions
✅ Screenshots are used for verification only, not generation
```

## Immutable Rules

이 7개가 클론 품질의 판정 기준이다. 각 Phase의 명령어는 references 에 있지만, **이 규칙은 항상 인라인**이다.

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

## Execution Plan

**Phase 단계 건너뛰기 금지.** 각 Phase의 정확한 명령어와 금지 사항은 `references/phase-commands.md` 가 SSOT다.

| Phase | 하는 일 | 상세 |
|---|---|---|
| **0** Setup | 스택 감지 · feature 이름 · 디렉토리 · 컴포넌트 인덱싱 · 토큰 스캔. `--sub` 면 URL 목록 확장 | `references/setup-and-layout.md` |
| **1** Capture | 헤드리스 브라우저로 MO/PC **병렬** 캡처 → rendered.html · computed.json · screenshot.png · states.json · behaviors.json · assets/ | `references/capture-rules.md` · `references/phase-commands.md` |
| **2** Refine | DOM → sections.json (BP마다 독립). interaction 모델 추정 + 상태 규칙 포함 | `references/refine-rules.md` |
| **2.5** Foundation | **순차, 섹션 빌드 전.** 폰트 배선 · SEO 에셋 → public/ · SVG dedupe → 아이콘 모듈 · scrollLib 페이지 레벨 배선 | `references/phase-commands.md` |
| **3** Scaffold | spec 게이트 → SCSS 초안 → 섹션별 빌더 병렬 디스패치 → 섹션마다 validate PASS. **MO 완주 후 PC** | `references/phase-commands.md` · `references/scaffold-phases.md` |
| **3C** Responsive Merge | MO+PC 모두 Phase 5 통과 후 mobile-first 병합 (MO=기본, PC diff만 `@media`) | `references/phase-commands.md` |
| **4** Compile Gate | 컴파일 성공까지 루프. baseline 대비 **신규** 에러만 수정 | `references/verification-loops.md` |
| **5** Pixel Verification | **필수.** P1=0까지 루프. 병합 후엔 MO·PC 양쪽 재실행 | `references/verification-loops.md` |

⛔ Phase 4 통과 후 Phase 5 진입은 자동이다. Phase 5 완료 전에 "완료 요약"을 출력하지 않는다.

## Prerequisites

- **puppeteer**: optional peer dependency. 미설치 시 Phase 1에서 `npm install puppeteer` 안내 후 중단
- **Chromium**: puppeteer 자동 다운로드 (`npx puppeteer browsers install chrome`)
- **dev 서버**: Phase 4-5에서 `npm run dev` 호출. 스크립트가 미정의면 사용자에게 명시
- **robots.txt 준수**: 기본 차단. `--ignore-robots` 는 사이트 소유자/CTF/학습 명시일 때만

## Legal & Error Recovery

용도 제한(학습·본인 소유·허가받은 리디자인), 금지 사항(저작권 콘텐츠 무단 재게시·브랜드 사칭·robots.txt 우회),
`--real-content` 확인 절차, 오류 복구 표: `references/legal-and-error-recovery.md`

사용자 의도가 사칭이나 기만이면 즉시 거부한다 — 플래그 유무와 무관하다.

## Done Criteria

- [ ] 요청된 모든 BP(scope)에 대해 Phase 1–2 산출물이 존재한다
- [ ] 모든 섹션이 spec의 TODO를 해소한 뒤 빌드됐다
- [ ] 모든 섹션이 `clone-validate.js` PASS를 받았다
- [ ] 원격 에셋이 남아있지 않다 — 모든 `<img>`/background-image가 로컬 경로로 해석된다
- [ ] Phase 4 컴파일 통과 (baseline 대비 신규 에러 0)
- [ ] Phase 5 P1=0 — 병합 후라면 MO·PC 양쪽에서
