---
name: vibe.design
description: DESIGN.md(시각 품질 SSOT) 생성·검증·드리프트 검사·동기화. Figma 독립.
argument-hint: "init [--from=interview|code|reference|figma] | lint | verify | sync | preview"
user-invocable: true
---

# /vibe.design

**vibe 의 세 번째 SSOT — 시각 품질 계약 문서(`DESIGN.md`)** 의 라이프사이클을 전담한다.

> `CLAUDE.md`(코드) · `AGENTS.md`(빌드) 에 이은 시각 규약. **Figma 에 종속되지 않는다** — Figma 는 4 가지 입력 소스 중 하나.

## Usage

```
/vibe.design init                       # 인터뷰 (디폴트)
/vibe.design init --from=interview      # 대화형 9 섹션 작성
/vibe.design init --from=code           # 기존 코드 토큰 역추출
/vibe.design init --from=reference --reference=linear   # awesome-design-md 시드 선택
/vibe.design init --from=figma --file=<key>             # /vibe.figma 위임 (옵션)
/vibe.design lint                       # Stitch 9 섹션 완전성 검증
/vibe.design verify [--files=<glob>]    # 구현 ↔ DESIGN.md hex 드리프트 (v1)
/vibe.design sync                       # Figma 연결 시 양방향 동기화 (Should, Phase 2)
/vibe.design preview "description"      # UI 프리뷰 (Antigravity 목업 또는 ASCII 폴백)
```

## Philosophy

- **Figma 독립**: 모든 서브커맨드는 Figma 없이 동작. Figma 연결 시에만 sync 활성.
- **권유 > 강제**: DESIGN.md 부재 = 안내 메시지 1 회. `/vibe.run` · `/vibe.verify` 는 막지 않는다.
- **Stitch 9 섹션 표준**: 외부 에이전트 호환 (Google Stitch, awesome-design-md 생태계).
- **버전 frontmatter**: `<!-- design-md-version: 1 -->` 로 미래 호환.
- **루트 배치**: `CLAUDE.md` · `AGENTS.md` 와 동일하게 프로젝트 루트.

## Process

> **⏱️ Timer**: 시작 시 `getCurrentTime` 호출, `{start_time}` 으로 기록.

### Subcommand: `init`

**진입 조건**: 프로젝트 루트에 `DESIGN.md` 없음 (있으면 덮어쓰기 확인).

**경로 결정**:

| `--from` | 동작 |
|---------|------|
| 미지정 / `interview` | 대화형 9 섹션 인터뷰 (디폴트) |
| `code` | 기존 코드에서 토큰 역추출 → 인터뷰 보강 |
| `reference` | `--reference=<slug>` 로 시드 카탈로그 선택 → §1·§2·§3 시드 + §4–§9 단축 인터뷰 |
| `figma` | `/vibe.figma --emit-design-md` 위임 (Figma MCP 필요) |

**공통 출력**:
- 위치: `<프로젝트 루트>/DESIGN.md`
- 첫 줄: `<!-- design-md-version: 1 -->`
- 9 H2 섹션 (Visual Theme / Color Palette / Typography / Components / Layout / Depth / Do's & Don'ts / Responsive / Agent Prompt Guide)
- 템플릿: `templates/DESIGN.md.template`

#### `--from=interview` 흐름

1. 사용자가 9 섹션을 순차 답변 (브랜드 톤, 컬러, 폰트, 컴포넌트 스타일, 그리드, 그림자/뎁스, 금기, 브레이크포인트, 에이전트 가이드)
2. 빈 섹션은 템플릿 기본값(주석) 으로 채움
3. `DESIGN.md` 저장 + `lint` 자동 실행 → P1 없으면 성공

#### `--from=code` 흐름

1. `.vibe/config.json` 의 `stacks[].type` 으로 추출기 결정 (`heuristics/code-extract.md`)
2. v1 필수 패턴: **Tailwind config / CSS custom properties / styled-components theme**
3. 추출된 토큰을 §2·§3·§4 시드로 사용
4. 나머지 6 섹션은 단축 인터뷰 (≤3 질문) 또는 템플릿 기본값

#### `--from=reference` 흐름

1. `references/README.md` 시드 카탈로그에서 `--reference=<slug>` 매칭 (`linear`, `vercel`, `stripe` …)
2. 시드의 `style-preset` 한 줄 (예: `"minimal, neutral grays + electric purple accent, Inter Display"`) 로 §1·§2·§3 기본값 채움
3. §4–§9 는 단축 인터뷰 (≤3 질문)
4. 네트워크 차단 환경에서도 동작 (시드는 로컬 시드)

#### `--from=figma` 흐름

1. `/vibe.figma --emit-design-md --file=<key>` 호출 (위임)
2. 산출물(`DESIGN.md`) 받아서 lint 통과 확인

### Subcommand: `lint`

**입력**: 프로젝트 루트 `DESIGN.md`

**체크**:
- 9 섹션 모두 존재 (`lintMissingSections` from `design-md-parser.ts`)
- frontmatter 버전 주석 존재
- §2 (Color Palette) 에 최소 1 개 hex 토큰
- §9 (Agent Prompt Guide) 비어있지 않음

**출력**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ DESIGN.md lint PASS
   9 sections, 12 color tokens, version 1
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

또는:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ DESIGN.md lint FAIL (P1: 2)
   Missing: Typography, Responsive
   → Run /vibe.design init to regenerate, or edit DESIGN.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**성능 목표**: <200ms (100 줄 DESIGN.md 기준).

### Subcommand: `verify`

**입력**:
- 프로젝트 루트 `DESIGN.md` (없으면 안내 후 종료)
- `--files=<glob>` (기본: 최근 변경 파일 — `/vibe.verify` 의 changed-files 정책 따름)

**체크 (v1 범위)**:
- `extractHexTokens(DESIGN.md)` → 허용 토큰 셋
- `findHardcodedColors(files, allowed)` → 허용 셋 밖 hex = P1 후보

**v1 비범위** (Phase 2+):
- spacing / font-family 드리프트
- HSL/RGB/named color
- Tailwind arbitrary value `bg-[#xxxxxx]`

**출력**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ DESIGN.md verify PASS (32 files scanned)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

또는:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ DESIGN.md verify FAIL (P1: 3 hex drifts)
   src/Button.tsx:42  #FF5733 not in DESIGN.md tokens
   src/Card.tsx:18    #123456 not in DESIGN.md tokens
   src/Nav.tsx:7      #ABCDEF not in DESIGN.md tokens
   → Add to DESIGN.md §2 Color Palette, or replace with token
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**성능 목표**: <1s / 100 파일.

### Subcommand: `sync` (Should, Phase 2)

**진입 조건**: `~/.vibe/config.json#figma.token` 존재 + `--file=<key>` 또는 프로젝트에 figma 연결 메타.

**v1 동작**: "Phase 2 에서 활성됩니다. 현재는 `/vibe.figma --emit-design-md` 를 사용하세요." 메시지 후 종료.

### Subcommand: `preview`

Generate the UI preview directly in the main session (native capability — no dedicated agent). DESIGN.md 와 독립적으로 동작 — 임시 프리뷰용.

Generate UI preview from a text description, a design folder, or a single file.

- **Antigravity enabled**: UI mockup image + component code generation
- **Antigravity disabled**: ASCII art fallback

**Input types:**

| Input | Example |
| ----- | ------- |
| Text description | `"Login form with email, password"` |
| Design folder | `./design/` |
| Single file | `./mockups/login.html` |

> Read `references/ui-preview.md` for the full supported file-format list and example invocations.

## Integration

| Skill | 통합 지점 |
|------|---------|
| `/vibe.run` | UI 스택 진입 시 `DESIGN.md` 없으면 `### DESIGN.md Gate` 에서 권유 (ultrawork 시 silent skip) |
| `/vibe.verify` | `### 3.2 Visual Drift Detection` 에서 `vibe.design verify` 호출 — P1 → fail |
| `/vibe.review` | `### Phase 2.5 Visual P1 Baseline` 에서 DESIGN.md 우선, 없으면 WCAG AA 폴백 |
| `/vibe.figma` | WRITE 는 DESIGN.md 읽어 톤·팔레트 우선, READ 는 `--emit-design-md` 플래그로 출력 |

## Figma Credential Handling (init/sync only)

- 토큰 출처: `~/.vibe/config.json#figma.token` (chmod 0o600)
- 메모리 외 노출 금지. 로그에는 마지막 4 자만 노출 (`****abc1`)
- `--from=figma` · `sync` 외 서브커맨드는 토큰 읽지 않음

## Output

| 파일 | 생성/수정 |
|-----|---------|
| `<root>/DESIGN.md` | `init` / `sync` |
| 콘솔 리포트 | `lint` / `verify` |
| ASCII 프리뷰 또는 목업 이미지 | `preview` |

## Heuristics & References

- 코드 역추출 패턴: `heuristics/code-extract.md`
- 시드 카탈로그: `references/README.md`
- UI 프리뷰 포맷·예시: `references/ui-preview.md`
- 템플릿: `templates/DESIGN.md.template`

ARGUMENTS: $ARGUMENTS
