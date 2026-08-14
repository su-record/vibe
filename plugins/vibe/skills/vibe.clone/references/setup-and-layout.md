# Clone — Setup Steps & Output Layout

> Loaded by vibe.clone SKILL.md Full Flow / Phase 0 (Setup) — working-directory + code-output layout and the full Phase 0 setup steps.

```
Working directory:
  /tmp/{feature}/
  ├── mo/ (375×812)  — rendered.html, computed.json, screenshot.png, assets/, sections.json
  ├── pc/ (1440×900) — rendered.html, computed.json, screenshot.png, assets/, sections.json
  └── tokens.json    — extracted design tokens (colors/fonts/spacing)

Code output: placed directly in the project directory per detected stack
  components/{feature}/, components/{feature}/_specs/{mo,pc}/,
  styles/{feature}/{mo,pc}/ (per-BP drafts) → styles/{feature}/ (Phase 3C merged),
  public/images/{feature}/, public/ (favicons/OG from assets/seo/)
```

```
1. Stack detection:
   - .vibe/config.json → stack (react/vue/next/svelte/vanilla, scss/tailwind/css-modules)
   - Fallback: package.json deps
2. Feature name: URL hostname → kebab-case (e.g. stripe.com → stripe-clone)
   - User may override with --name=<custom>
3. Directories:
   - components/{feature}/, styles/{feature}/, public/images/{feature}/
4. Component indexing → /tmp/{feature}/component-index.json
   (scan up to 50 existing components, extract props/slots/classes, within 2 minutes)
5. Design token scan → /tmp/{feature}/project-tokens.json
   (SCSS > CSS Variables > Tailwind > CSS-in-JS)
```

## Full output locations

```
/tmp/{feature}/                  # 작업 디렉토리 (산출물 원본)
  ├── menu-urls.json             # --sub URL 확장 결과
  ├── mo/, pc/                   # rendered.html, computed.json, screenshot.png, states.json,
  │                              #   behaviors.json, sections.json, assets/
  └── project-tokens.json        # 기존 프로젝트 토큰 인덱스

./components/{feature}/                  # 빌더가 작성한 컴포넌트 (.tsx/.vue/.svelte/.html)
./components/{feature}/_specs/{mo,pc}/   # clone-spec.js가 생성한 섹션별 빌드 계약서 (*.spec.md)
./styles/{feature}/                      # 최종 병합 SCSS (Phase 3C 산출 — mobile-first @media)
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

## Capture artifacts (Phase 1 output per breakpoint)

`rendered.html`, `computed.json`, `screenshot.png`, `states.json`, `behaviors.json`,
`asset-map.json`, `assets/` (images·fonts·seo).

- `behaviors.json` = active interaction sweep, 4+ kinds (scroll header diff · tab-click content
  swap · hover diff · in-view entrance animation · time-driven carousel candidates · smooth-scroll
  library detection). It captures JS-set state that static CSS harvesting is blind to — the core of
  clone accuracy. Disable with `--no-interact`.
- `assets/seo/` = favicon · apple-touch-icon · og:image · webmanifest, wired during Phase 2.5.
