---
name: vibe.figma.extract
description: Figma REST API로 재료 확보 — 스크린샷, 이미지, CSS, 트리, 텍스트
triggers: []
tier: standard
---

# vibe.figma.extract — 재료 확보

Figma REST API(`src/infra/lib/figma/`)를 사용하여 **퍼즐 조립에 필요한 모든 재료**를 추출.
추출한 데이터는 코드 변환용이 아닌 **재료함(material inventory)**으로 사용된다.

---

## 1. 스크린샷 — 정답 사진

```
가장 먼저 확보. 이것이 "만들어야 할 결과물"의 기준.

전체 스크린샷:
  node "[FIGMA_SCRIPT]" screenshot {fileKey} {nodeId} --out=/tmp/{feature}/full-screenshot.png

섹션별 스크린샷 (1depth 자식 프레임 각각):
  node "[FIGMA_SCRIPT]" screenshot {fileKey} {child.nodeId} --out=/tmp/{feature}/sections/{name}.png
```

---

## 2. 이미지 에셋 — 시각 재료

```
트리에서 imageRef 수집 → Figma API로 다운로드:

Bash:
  node "[FIGMA_SCRIPT]" images {fileKey} {nodeId} --out=/tmp/{feature}/images/ --depth=10

반환: { total: N, images: { "imageRef": "/path/to/file.png", ... } }

검증: total = refs.size (누락 0), 0byte 파일 없음
```

---

## 3. 노드 트리 + CSS — 수치 재료

```
Bash:
  node "[FIGMA_SCRIPT]" tree {fileKey} {nodeId} --depth=10

반환 (FigmaNode JSON):
  {
    nodeId: "641:78152",
    name: "KID",
    type: "INSTANCE",
    size: { width: 720, height: 487 },
    css: { display: "flex", flexDirection: "column", gap: "32px", ... },
    text: "텍스트 내용" (TEXT 노드만),
    imageRef: "abc123" (이미지 fill이 있는 노드만),
    children: [...]
  }

⚠️ 주의: 이 트리는 HTML 구조로 변환하지 않는다.
용도는 오직:
  - 정확한 CSS 수치 참조 (색상, 크기, 간격)
  - 텍스트 콘텐츠 추출
  - 이미지 참조 매핑
  - 디자인 토큰 추출
```

### Figma 속성 → CSS 변환표

도구가 자동으로 변환하는 속성 (재료로 활용):

| Figma 속성 | CSS | 스케일 적용 |
|-----------|-----|-----------|
| `fills[].color` | `background-color` | ❌ |
| `fills[].type=IMAGE` | `imageRef` (다운로드 대상) | — |
| `strokes[].color` + `strokeWeight` | `border` | ✅ (width만) |
| `effects[].DROP_SHADOW` | `box-shadow` | ✅ (px만) |
| `effects[].LAYER_BLUR` | `filter: blur()` | ✅ |
| `effects[].BACKGROUND_BLUR` | `backdrop-filter: blur()` | ✅ |
| `cornerRadius` | `border-radius` | ✅ |
| `opacity` | `opacity` | ❌ |
| `blendMode` | `mix-blend-mode` | ❌ |
| `style.fontFamily` | `font-family` | ❌ |
| `style.fontSize` | `font-size` | ✅ |
| `style.fontWeight` | `font-weight` | ❌ |
| `style.lineHeightPx` | `line-height` | ❌ |
| `style.letterSpacing` | `letter-spacing` | ✅ |
| `style.textAlignHorizontal` | `text-align` | ❌ |
| `fills[].color` (TEXT) | `color` | ❌ |
| `characters` | 텍스트 내용 | — |
| `absoluteBoundingBox.width/height` | `width/height` | ✅ |
| `layoutMode=VERTICAL` | `display:flex; flex-direction:column` | ❌ |
| `layoutMode=HORIZONTAL` | `display:flex; flex-direction:row` | ❌ |
| `primaryAxisAlignItems` | `justify-content` | ❌ |
| `counterAxisAlignItems` | `align-items` | ❌ |
| `itemSpacing` | `gap` | ✅ |
| `padding*` | `padding` | ✅ |
| `clipsContent` | `overflow: hidden` | ❌ |
| `layoutPositioning=ABSOLUTE` | `position: absolute` | ❌ |

---

## 4. 재료함 정리 (material-inventory)

```
추출 완료 후 재료를 카테고리별로 정리:

이미지 목록:
  파일명 | 크기 | 용도 추정
  hero-bg.png | 720×1280 | 배경 (큰 사이즈, BG 레이어)
  title.png | 620×174 | 타이틀 이미지
  btn-share.png | 48×48 | 아이콘 (작은 사이즈)

색상 팔레트 (tree.json에서 고유값 추출 + 토큰 매핑 힌트):
  #0a1628, #00264a, #ffffff, #dadce3, #003879, #419bd3, ...

  토큰 매핑 테이블 (project-tokens.json 존재 시):
    | Figma 값 | 기존 토큰 | 상태 |
    |----------|-----------|------|
    | #0a1628 | $color-navy | ✅ 재사용 |
    | #ffd700 | — | 🆕 생성 |
    | #3b82f6 | $color-primary | ✅ 재사용 |

폰트 목록:
  Pretendard: 400/500/700, 16px~48px
  Roboto Condensed: 700, 24px~36px

텍스트 콘텐츠 (모든 TEXT 노드):
  "겨울 이벤트", "12.1 ~ 12.31", "참여 대상 : PC 유저", ...

간격 패턴 (빈도 높은 값):
  gap: 8px, 16px, 24px, 32px
  padding: 16px, 24px, 32px
```

---

## 5. 노드 참조 (보조)

```
트리의 name/type은 재료 분류에만 사용:

name 패턴 → 용도 힌트:
  "BG" → 배경 이미지 (스크린샷에서 확인)
  "Title", "Txt_*" → 텍스트 영역
  "Btn_*", "CTA" → 버튼/인터랙티브
  "Icon_*" → 아이콘
  "Step1", "Item_*" → 반복 요소

type → 재료 종류:
  TEXT → 텍스트 콘텐츠 제공
  RECTANGLE/VECTOR + imageRef → 다운로드 대상 이미지
  INSTANCE → 반복 사용 가능성 (컴포넌트 후보)

⚠️ 이 정보로 HTML을 생성하지 않는다. 스크린샷을 보고 판단한다.
```
