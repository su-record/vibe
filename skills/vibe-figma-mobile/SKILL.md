---
name: vibe-figma-mobile
description: Step B — 모바일 디자인 추출, 이미지 다운로드, 모바일 코드 생성 및 검증
triggers: []
tier: standard
---

# Skill: vibe-figma-mobile — Step B: 모바일 디자인 반영

## B-1. 모바일 디자인 URL 입력

AskUserQuestion (options 사용 금지):
```
question: "📱 모바일 디자인 Figma URL을 입력해주세요."
→ ⏸️ 응답 대기
→ URL 저장: mobileUrl
```

## B-2. 모바일 디자인 추출 (MCP)

```
1. get_design_context(fileKey, nodeId) → 코드 + 스크린샷 + 에셋 URL
→ 스크린샷으로 전체 디자인 분석 (레이아웃, 타이포, 색상, 컴포넌트 구조)
```

URL에서 fileKey, nodeId 추출:
```
https://www.figma.com/design/:fileKey/:fileName?node-id=:nodeId
→ nodeId: 하이픈을 콜론으로 ("1-109" → "1:109")
```

## B-3. 이미지 에셋 다운로드 (BLOCKING)

> **⛔ 이미지 다운로드 완료 전 코드 생성 진행 금지.**

```
1. get_design_context 응답에서 모든 이미지 URL 추출
   (패턴: https://www.figma.com/api/mcp/asset/...)
2. WebFetch로 각 URL 다운로드
3. 프로젝트 에셋 디렉토리에 저장 (Nuxt: static/images/{feature}/)
4. 파일명: 레이어 이름 기반 kebab-case
5. URL→로컬경로 매핑 테이블 생성
6. SVG: 작은 아이콘 → 인라인, 큰 SVG → 파일
```

### 이미지 분류 (vibe-figma-rules Phase 2-A 참조)

get_design_context 응답의 `fills` 배열에서 `type: "IMAGE"` 레이어를 분류:

| 판별 조건 | 분류 | 코드 패턴 |
|----------|------|----------|
| 레이어가 프레임/섹션의 **직계 배경**이고, 위에 텍스트/UI 요소가 겹침 | **Background Image** | `background-image` + `background-size` |
| 레이어가 독립적이고, 위에 겹치는 요소 없음 | **Content Image** | `<img>` 또는 `<picture>` |
| 레이어 이름에 `icon`, `logo`, `avatar` 포함 | **Inline Asset** | `<img>` (작은 크기) |
| 레이어가 반복 패턴(`scaleMode: "TILE"`) | **Pattern/Texture** | `background-image` + `background-repeat` |
| 레이어가 전체 프레임을 덮고 opacity < 1 또는 blendMode 적용 | **Overlay Image** | `background-image` + overlay `::before`/`::after` |

## B-4. 모바일 코드 생성

```
1. 모바일 기준으로 컴포넌트 코드 생성 (vibe-figma-rules Phase 4~6 적용)
2. 이미지 에셋은 매핑 테이블의 로컬 경로 사용
3. 스토리보드 스펙 반영 (인터랙션, 애니메이션)
4. 모바일 전용 스타일 작성 (desktop 미고려)
```

### Codex 병렬 활용 (codex-plugin-cc 설치 시)

```
섹션 3개 이상 → /codex:rescue --background (gpt-5.3-codex-spark)
각 섹션 컴포넌트를 Codex에 병렬 위임, Claude는 루트 페이지 + 토큰 담당

Codex 미설치 시 자동 스킵 — Claude만으로 순차 생성.
```

### Model Routing (Step B)

| 작업 | 모델 |
|------|------|
| 모바일 추출 (MCP + 이미지 다운로드) | **Haiku** |
| 모바일 코드 생성 | **Sonnet** + **gpt-5.3-codex-spark** (병렬) |
| 모바일 검증 | **Sonnet** |

## B-5. 모바일 검증 루프

```
🔄 vibe-figma-rules Phase 9 검증 루프 실행:
  - Figma 모바일 스크린샷 vs 생성된 코드 비교
  - P1=0 될 때까지 수정 반복
  - 이미지 에셋 전부 표시되는지 확인
```

Step B 완료 후:
- PC URL이 있으면 → Step C (vibe-figma-desktop) 로 진행
- PC URL이 없으면 (single viewport mode) → Step D (vibe-figma-consolidate) 로 직행
