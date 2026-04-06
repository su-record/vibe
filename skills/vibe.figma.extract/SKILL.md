---
name: vibe.figma.extract
description: Figma REST API로 노드 트리, CSS, 이미지 추출
triggers: []
tier: standard
---

# vibe.figma.extract — 데이터 추출

Figma REST API(`src/infra/lib/figma/`)를 사용하여 노드 트리, CSS, 이미지를 추출.

---

## 1. 노드 트리 + CSS 추출

```
Bash:
  node -e "
    import { getTree } from './dist/infra/lib/figma/index.js';
    const tree = await getTree({ fileKey: '{fileKey}', nodeId: '{nodeId}', depth: 10 });
    console.log(JSON.stringify(tree));
  "

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
```

### Figma 속성 → CSS 변환표

도구가 자동으로 변환하는 속성:

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
| `style.lineHeightPx` | `line-height` | ❌ (px이지만 상대값으로 취급) |
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

## 2. 이미지 다운로드

```
트리에서 imageRef 수집 → Figma API로 다운로드:

Bash:
  node -e "
    import { getTree, getImages, collectImageRefs } from './dist/infra/lib/figma/index.js';
    const tree = await getTree({ fileKey: '{fileKey}', nodeId: '{nodeId}', depth: 10 });
    const refs = collectImageRefs(tree);
    const result = await getImages({ fileKey: '{fileKey}', imageRefs: refs, outDir: '{outDir}' });
    console.log(JSON.stringify(result));
  "

반환: { total: N, images: { "imageRef": "/path/to/file.png", ... } }

파일명: imageRef 앞 16자 + .png
검증: total = refs.size (누락 0), 0byte 파일 없음
```

---

## 3. 스크린샷

```
Bash:
  node -e "
    import { getScreenshot } from './dist/infra/lib/figma/index.js';
    await getScreenshot({ fileKey: '{fileKey}', nodeId: '{nodeId}', outPath: '{path}' });
  "

시각 검증용. 노드를 PNG로 렌더링하여 저장.
```

---

## 4. 노드 구조 참조

```
트리의 name 속성으로 레이어 용도 파악:
  name="BG" → 배경 레이어 (position:absolute, imageRef 포함)
  name="Contents" → 콘텐츠 영역
  name="Title" → 제목
  name="Step1", "Step2" → 하위 섹션
  name="Btn_Login" → 버튼

type으로 노드 종류 구분:
  FRAME → 컨테이너 (div)
  TEXT → 텍스트 (p/span)
  INSTANCE → 컴포넌트 인스턴스 (자식 있음)
  RECTANGLE/VECTOR with imageRef → 이미지 (img)
  GROUP → 그룹 (div)
```
