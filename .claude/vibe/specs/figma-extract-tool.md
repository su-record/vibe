---
status: pending
currentPhase: 0
totalPhases: 3
createdAt: 2026-04-06T12:00:00+09:00
lastUpdated: 2026-04-06T12:00:00+09:00
---

# SPEC: figma-extract-tool

## Persona
<role>
Figma REST API를 직접 호출하여 노드 트리, CSS 속성, 이미지를 추출하는 도구.
현재 Figma MCP 플러그인(plugin:figma:figma)을 대체한다.
</role>

## Context
<context>
### Background
현재 Figma MCP 플러그인의 한계:
- `get_metadata`: 인스턴스 내부 자식 노드를 노출하지 않음 → 분할 불가
- `get_design_context`: 큰 섹션(1500px+)에서 타임아웃 → 스크린샷 폴백
- Tailwind 참조 코드를 역변환하는 비효율적 파이프라인
- 이미지 URL 7일 만료

Figma REST API는 이 모든 것을 해결:
- `/v1/files/:key/nodes?ids=:ids&depth=N` → 인스턴스 내부 자식 포함 전체 트리
- 노드 속성에서 CSS 직접 추출 (fills, strokes, effects, style)
- `/v1/images/:key?ids=:ids` → 이미지 렌더링 + 즉시 다운로드
- depth 제어로 타임아웃 없음

### Tech Stack
- TypeScript strict + ESM (`"type": "module"`, `.js` 확장자)
- native `fetch` (Node 18+, 외부 HTTP 라이브러리 없음)
- `GlobalConfigManager` (토큰 관리)
- 빌드: `tsc` → `dist/`

### Related Code
- `src/cli/commands/figma.ts`: 기존 Figma CLI (토큰 설정/상태)
- `src/infra/lib/config/GlobalConfigManager.ts`: 설정 관리
- `hooks/scripts/llm-orchestrate.js`: 스크립트 패턴 참조
- `src/infra/lib/gemini/capabilities.ts`: API 호출 패턴 참조

### Figma REST API Endpoints
- `GET /v1/files/:key/nodes?ids=:ids&depth=N` → 노드 트리 + 속성
- `GET /v1/images/:key?ids=:ids&format=png&scale=2` → 이미지 렌더링
- Header: `X-Figma-Token: {token}`

### 사용 방식
vibe-figma 스킬의 Phase 2에서 MCP 도구 대신 Bash로 호출:
```bash
node hooks/scripts/figma-extract.js tree <fileKey> <nodeId> [--depth=5]
node hooks/scripts/figma-extract.js images <fileKey> <nodeIds> --out=<dir>
node hooks/scripts/figma-extract.js screenshot <fileKey> <nodeId> --out=<path>
```
</context>

## Task
<task>
### Phase 1: Figma API 클라이언트 + 노드 트리

1. [ ] `hooks/scripts/figma-extract.js` 생성
   - CLI 인터페이스: `tree`, `images`, `screenshot` 서브커맨드
   - 토큰 로드: `~/.vibe/config.json` → `credentials.figma.accessToken`
   - env fallback: `FIGMA_ACCESS_TOKEN`
   - Verify: `node hooks/scripts/figma-extract.js tree --help`

2. [ ] `tree` 서브커맨드 구현
   - `GET /v1/files/:key/nodes?ids=:id&depth=N`
   - 응답에서 노드 트리 파싱 (children 재귀 순회)
   - 각 노드에서 CSS 속성 추출:

   | Figma 속성 | CSS |
   |-----------|-----|
   | `fills[0].color {r,g,b,a}` | `background-color: rgba(...)` |
   | `fills[0].type=IMAGE` | `background-image` (imageRef 기록) |
   | `strokes[0].color` | `border-color` |
   | `strokeWeight` | `border-width` |
   | `effects[].type=DROP_SHADOW` | `box-shadow` |
   | `effects[].type=LAYER_BLUR` | `filter: blur()` |
   | `effects[].type=BACKGROUND_BLUR` | `backdrop-filter: blur()` |
   | `cornerRadius` | `border-radius` |
   | `opacity` | `opacity` |
   | `blendMode` | `mix-blend-mode` |
   | `style.fontFamily` | `font-family` |
   | `style.fontSize` | `font-size` |
   | `style.fontWeight` | `font-weight` |
   | `style.lineHeightPx` | `line-height` |
   | `style.letterSpacing` | `letter-spacing` |
   | `style.textAlignHorizontal` | `text-align` |
   | `characters` | 텍스트 내용 |
   | `absoluteBoundingBox.width` | `width` |
   | `absoluteBoundingBox.height` | `height` |
   | `layoutMode=VERTICAL` | `display: flex; flex-direction: column` |
   | `layoutMode=HORIZONTAL` | `display: flex; flex-direction: row` |
   | `primaryAxisAlignItems` | `justify-content` |
   | `counterAxisAlignItems` | `align-items` |
   | `itemSpacing` | `gap` |
   | `paddingLeft/Right/Top/Bottom` | `padding` |
   | `clipsContent` | `overflow: hidden` |
   | `layoutPositioning=ABSOLUTE` | `position: absolute` |
   | `constraints` | `top/left/right/bottom` |

   - 출력: JSON → stdout
   ```json
   {
     "nodeId": "641:78153",
     "name": "Daily",
     "type": "INSTANCE",
     "size": { "width": 720, "height": 3604 },
     "css": { "display": "flex", "flexDirection": "column", ... },
     "children": [
       {
         "nodeId": "xxx:yyy",
         "name": "BG",
         "css": { "position": "absolute", "inset": "0", ... },
         "imageRef": "abc123",
         "children": []
       },
       ...
     ]
   }
   ```
   - Verify: `node figma-extract.js tree jitSR2yFctITa9N1rVYIZD 641:78152 --depth=3`

3. [ ] 큰 노드 자동 분할
   - `--depth` 미지정 시 기본값 10
   - 노드 높이 1500px+ → depth=2로 먼저 조회 → 자식별로 개별 조회
   - 결과를 합쳐서 하나의 JSON으로 출력
   - Verify: Daily 인스턴스(3604px)에서 자식 노드 목록 확인

### Phase 2: 이미지 다운로드

4. [ ] `images` 서브커맨드 구현
   - Phase 1 tree 결과에서 `imageRef`가 있는 노드 수집
   - `GET /v1/images/:key?ids=:nodeIds&format=png&scale=2`
   - 응답의 이미지 URL → `curl -sL` 다운로드 → `--out` 디렉토리
   - 파일명: `{sectionPrefix}-{nodeName}.webp` (kebab-case)
   - 검증: 0byte 파일 체크
   - 출력: imageMap JSON
   ```json
   {
     "xxx:yyy": "/images/winter-pcbang/hero-bg.webp",
     "xxx:zzz": "/images/winter-pcbang/hero-title.webp"
   }
   ```
   - Verify: Hero 섹션 이미지 전부 다운로드

5. [ ] `screenshot` 서브커맨드 구현
   - `GET /v1/images/:key?ids=:nodeId&format=png&scale=2`
   - 단일 노드의 렌더링 이미지 저장
   - Verify: KID 섹션 스크린샷 저장

### Phase 3: vibe-figma 스킬 연동

6. [ ] vibe-figma SKILL.md 수정
   - Phase 2 섹션 루프에서 MCP 호출 → `figma-extract.js` 호출로 교체
   - a단계: `node figma-extract.js tree ...` (get_design_context/get_metadata 대체)
   - b단계: `node figma-extract.js images ...` (이미지 다운로드)
   - c단계: 매핑 테이블은 tree 출력의 name/css 기반으로 생성
   - d단계: SCSS 작성은 tree 출력의 css 속성을 직접 사용 (Tailwind 역변환 불필요)

7. [ ] vibe-figma-extract SKILL.md 수정
   - Tailwind→CSS 변환표 → Figma 속성→CSS 변환표로 교체
   - 이미지 다운로드 절차를 `figma-extract.js images`로 교체

8. [ ] Figma MCP 플러그인 제거
   - `.claude/settings.local.json`에서 plugin:figma 제거
   - 관련 스킬 트리거/참조 정리
</task>

## Constraints
<constraints>
- native `fetch` 사용 (외부 HTTP 라이브러리 금지)
- Figma API rate limit: 30 req/min → 재시도 로직 (exponential backoff)
- 토큰 로그 마스킹 (figa_*** 형태)
- 에러 시 JSON 형태로 stderr 출력: `{"error": "message", "status": 403}`
- 파일 권한: 토큰 포함 파일 0o600
- ESM (`import`/`export`, `.js` 확장자)
- hooks/scripts/ 디렉토리에 단일 파일로 구현 (의존성 없이 self-contained)
</constraints>

## Output Format
<output_format>
### Files to Create
- `hooks/scripts/figma-extract.js` — 메인 도구 (self-contained)

### Files to Modify
- `skills/vibe-figma/SKILL.md` — Phase 2 MCP→도구 교체
- `skills/vibe-figma-extract/SKILL.md` — 추출 방식 교체

### Verification Commands
- `node hooks/scripts/figma-extract.js tree jitSR2yFctITa9N1rVYIZD 641:78152 --depth=3`
- `node hooks/scripts/figma-extract.js images jitSR2yFctITa9N1rVYIZD 641:78152 --out=./test-images`
- `node hooks/scripts/figma-extract.js screenshot jitSR2yFctITa9N1rVYIZD 641:78152 --out=./test.png`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] KID 인스턴스(641:78152, 487px): tree 출력에 자식 노드 5개+ 포함
- [ ] Daily 인스턴스(641:78153, 3604px): tree 출력에 자식 노드 포함 (MCP에서 불가했던 것)
- [ ] 각 노드의 css 속성에 font-size, color, background-color 등 포함
- [ ] Hero 이미지 전부 다운로드 (34개) + 0byte 없음
- [ ] Figma MCP 플러그인 제거 후 vibe-figma 스킬 정상 동작
- [ ] rate limit 재시도 동작 확인
</acceptance>
