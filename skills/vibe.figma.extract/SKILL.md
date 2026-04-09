---
name: vibe.figma.extract
description: Figma REST API로 코드 생성 데이터 확보 — 트리(primary), 이미지, 스크린샷(검증용)
triggers: []
tier: standard
---

# vibe.figma.extract — 코드 생성 데이터 확보

Figma REST API(`src/infra/lib/figma/`)를 사용하여 **구조적 코드 생성에 필요한 모든 데이터**를 추출.

```
추출 우선순위:
  1순위: 노드 트리 + CSS (코드 생성의 PRIMARY 소스)
  2순위: 이미지 에셋 (fill 이미지 + 아이템 노드 렌더링)
  3순위: 스크린샷 (Phase 6 시각 검증용 — 코드 생성에 사용하지 않음)
```

---

## 1. 노드 트리 + CSS — 코드 생성의 원천

```
Bash:
  node "[FIGMA_SCRIPT]" tree {fileKey} {nodeId}

반환 (FigmaNode JSON):
  {
    nodeId, name, type, size: { width, height },
    css: { display, flexDirection, gap, ... },
    text: "텍스트 내용" (TEXT 노드만),
    imageRef: "abc123" (이미지 fill),
    imageScaleMode: "FILL" (FILL/FIT/CROP/TILE),
    layoutSizingH: "HUG" (FIXED/HUG/FILL),
    layoutSizingV: "FILL",
    fills: [...] (2개 이상일 때만),
    isMask: true (마스크 노드만),
    children: [...]
  }

→ /tmp/{feature}/tree.json 에 저장
```

### Figma 속성 → CSS 직접 매핑표

트리 추출 도구가 자동 변환하는 속성. **이 값들이 SCSS에 직접 매핑된다:**

**레이아웃:**

| Figma 속성 | CSS | vw 변환 |
|-----------|-----|---------|
| `layoutMode=VERTICAL` | `display:flex; flex-direction:column` | ❌ |
| `layoutMode=HORIZONTAL` | `display:flex; flex-direction:row` | ❌ |
| `primaryAxisAlignItems` | `justify-content` | ❌ |
| `counterAxisAlignItems` | `align-items` | ❌ |
| `itemSpacing` | `gap` | ✅ |
| `layoutGrow=1` | `flex-grow: 1` | ❌ |
| `padding*` | `padding` | ✅ |
| `absoluteBoundingBox.width/height` | `width/height` | ✅ |
| `layoutPositioning=ABSOLUTE` | `position: absolute` + `top/left` (부모 상대 좌표) | ✅ |
| `layoutSizingHorizontal=HUG` | width 삭제 (auto) | — |
| `layoutSizingHorizontal=FILL` | 메타데이터 `layoutSizingH` (converter가 flex:1/100% 결정) | — |
| `layoutSizingVertical=HUG` | height 삭제 (auto) | — |
| `layoutSizingVertical=FILL` | 메타데이터 `layoutSizingV` (converter가 결정) | — |
| `clipsContent` | `overflow: hidden` | ❌ |

**비주얼:**

| Figma 속성 | CSS | vw 변환 |
|-----------|-----|---------|
| `fills[].SOLID` | `background-color` | ❌ |
| `fills[].IMAGE` | `imageRef` + `imageScaleMode` (FILL/FIT/CROP/TILE) | — |
| `fills[].GRADIENT_LINEAR` | `background-image: linear-gradient(...)` | ❌ |
| `fills[].GRADIENT_RADIAL` | `background-image: radial-gradient(...)` | ❌ |
| `fills[] (2개 이상)` | `fills` 배열 (type, color, imageRef, gradient, blendMode, filters) | — |
| `fills[].blendMode` | `background-blend-mode` | ❌ |
| `fills[].filters.saturation` | `filter: grayscale(X%)` / `saturate(X%)` | ❌ |
| `fills[].color` (TEXT) | `color` | ❌ |
| `strokes[] + strokeAlign=INSIDE` | `border` + `box-sizing: border-box` | ✅ (width만) |
| `strokes[] + strokeAlign=OUTSIDE` | `outline` | ✅ (width만) |
| `individualStrokeWeights` | `border-top/right/bottom/left` 개별 | ✅ (width만) |
| `strokeDashes` | `border-style: dashed` | ❌ |
| `effects[].DROP_SHADOW` | `box-shadow` | ✅ (px만) |
| `effects[].INNER_SHADOW` | `box-shadow` (inset) | ✅ (px만) |
| `effects[].LAYER_BLUR` | `filter: blur()` (누적) | ✅ |
| `effects[].BACKGROUND_BLUR` | `backdrop-filter: blur()` | ✅ |
| `cornerRadius` | `border-radius` | ✅ |
| `opacity` | `opacity` | ❌ |
| `rotation` | `transform: rotate(Xdeg)` | ❌ |
| `blendMode` (노드 레벨) | `mix-blend-mode` | ❌ |

**텍스트:**

| Figma 속성 | CSS | vw 변환 |
|-----------|-----|---------|
| `style.fontFamily` | `font-family` | ❌ |
| `style.fontSize` | `font-size` | ✅ |
| `style.fontWeight` | `font-weight` | ❌ |
| `style.lineHeightPx` | `line-height` | ❌ |
| `style.letterSpacing` | `letter-spacing` | ✅ |
| `style.textAlignHorizontal` | `text-align` | ❌ |
| `style.textCase` | `text-transform` | ❌ |
| `style.textTruncation` | `overflow: hidden; text-overflow: ellipsis` | ❌ |
| `style.paragraphSpacing` | `margin-bottom` | ✅ |
| `characters` | 텍스트 내용 | — |

---

## 2. 이미지 에셋 — 노드 렌더링 기반

```
❌ imageRef 개별 다운로드 금지
   → 텍스처 fill을 공유하는 경우 원본 텍스처(22.7MB)가 다운됨
   → 노드 렌더링하면 해당 노드에 적용된 최종 결과물(364KB)이 나옴

✅ 모든 이미지는 Figma screenshot API로 노드 렌더링
```

### 2-1. BG 프레임 렌더링

```
BG 프레임 판별 기준:
  - name에 "BG", "bg" 포함
  - 또는 부모와 크기 동일(±10%) + 자식 이미지 3개 이상

렌더링:
  node "[FIGMA_SCRIPT]" screenshot {fileKey} {bg.nodeId} --out=/tmp/{feature}/bg/{section}-bg.webp
```

### 2-2. 콘텐츠 노드 렌더링

```
대상 (tree.json에서 식별):
  - 아이콘 (VECTOR/GROUP 크기 ≤ 64px)
  - 아이템/보상 썸네일 (name에 "item", "reward", "token", "coin")
  - 벡터 글자 GROUP (부모 아래 VECTOR 3개 이상, 각 <60px)
  - ⛔ 디자인 텍스트 (다음 중 하나):
    · TEXT 노드 fills 2개 이상 (그래디언트+솔리드 중첩)
    · TEXT 노드에 effects 있음 (DROP_SHADOW, stroke)
    · TEXT 노드 fills에 GRADIENT 타입 포함
    · 프로젝트 웹폰트에 없는 fontFamily
    → 반드시 렌더링 대상에 포함
  - 장식 패널 (목재 간판, 금속 플레이트 등 텍스처 배경)
    → BG 프레임과 동일하게 렌더링

렌더링:
  node "[FIGMA_SCRIPT]" screenshot {fileKey} {node.nodeId} --out=/tmp/{feature}/content/{name}.webp
```

### 2-3. imageRef 다운로드 (폴백)

```
노드 렌더링 불가 시에만 (API 실패, DOCUMENT 레벨):
  파일 크기 5MB 초과 → 텍스처 fill 경고
```

---

## 3. 스크린샷 — Phase 6 검증 참조용

```
코드 생성에 사용하지 않는다.

전체: screenshot → /tmp/{feature}/full-screenshot.webp
섹션별: 1depth 자식 각각 → /tmp/{feature}/sections/{name}.webp
```

---

## 4. 추출 데이터 정리

```
/tmp/{feature}/
├── tree.json                    ← PRIMARY 소스
├── bg/                          ← BG 프레임 렌더링
├── content/                     ← 콘텐츠 노드 렌더링
├── full-screenshot.webp          ← 검증용
└── sections/                    ← 섹션별 검증용

이미지 분류 요약:
  | 분류 | 처리 |
  |------|------|
  | BG 프레임 | 프레임 렌더링 → bg/ |
  | 디자인 텍스트 | 노드 렌더링 → content/ |
  | 벡터 글자 | GROUP 렌더링 → content/ |
  | 콘텐츠 | 노드 렌더링 → content/ |
  | 장식 패널 | 프레임 렌더링 → content/ |
  | 장식 | BG 렌더링에 포함 |
```

---

## 5. 추출 완료 검증 (Phase 3 진입 전 필수)

```
⛔ 하나라도 누락 → 재추출 (Phase 3 진행 금지)

1. tree.json 존재 + 루트 노드 children > 0
2. 각 섹션별 BG → bg/ 에 파일 존재
3. 디자인 텍스트 체크:
   tree.json 순회 → fills 2개 이상 또는 effects 있는 TEXT 노드 목록 생성
   → 해당 노드 전부 content/ 에 렌더링 파일 존재
4. 벡터 글자 체크:
   GROUP 아래 VECTOR 3개 이상 → content/ 에 렌더링 파일 존재
5. 섹션별 검증용 스크린샷 → sections/ 에 파일 존재
6. 파일명 규칙: 모두 kebab-case (해시 파일명 없음)
```
