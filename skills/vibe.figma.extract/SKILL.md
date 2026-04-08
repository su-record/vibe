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
  3순위: 스크린샷 (Phase 4 시각 검증용 — 코드 생성에 사용하지 않음)
```

---

## 1. 노드 트리 + CSS — 코드 생성의 원천

```
가장 먼저 확보. 이것이 HTML + SCSS 코드의 직접적 소스.

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

→ /tmp/{feature}/tree.json 에 저장

트리 데이터의 용도 (vibe.figma.convert에서 직접 매핑):
  - Auto Layout → CSS Flexbox (direction, gap, padding, align 1:1)
  - absoluteBoundingBox → width, height (→ vw 변환)
  - fills/strokes/effects → background, border, shadow 등
  - TEXT 노드 → 텍스트 콘텐츠 + 타이포그래피 CSS
  - imageRef → 이미지 에셋 매핑
  - name/type → 시맨틱 태그 판단 힌트 (Claude 사용)
```

### Figma 속성 → CSS 직접 매핑표

트리 추출 도구가 자동 변환하는 속성. **이 값들이 SCSS에 직접 매핑된다:**

| Figma 속성 | CSS | vw 변환 |
|-----------|-----|-----------------|
| `layoutMode=VERTICAL` | `display:flex; flex-direction:column` | ❌ |
| `layoutMode=HORIZONTAL` | `display:flex; flex-direction:row` | ❌ |
| `primaryAxisAlignItems` | `justify-content` | ❌ |
| `counterAxisAlignItems` | `align-items` | ❌ |
| `itemSpacing` | `gap` | ✅ |
| `padding*` | `padding` | ✅ |
| `absoluteBoundingBox.width/height` | `width/height` | ✅ |
| `layoutPositioning=ABSOLUTE` | `position: absolute` | ❌ |
| `clipsContent` | `overflow: hidden` | ❌ |
| `fills[].color` | `background-color` | ❌ |
| `fills[].type=IMAGE` | `imageRef` (다운로드 대상) | — |
| `fills[].color` (TEXT) | `color` | ❌ |
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
| `characters` | 텍스트 내용 | — |

---

## 2. 이미지 에셋 — 노드 렌더링 기반 (imageRef 개별 다운로드 금지)

```
❌ imageRef 개별 다운로드 금지
   → 텍스처 fill을 공유하는 경우 원본 텍스처(22.7MB)가 다운됨
   → 노드 렌더링하면 해당 노드에 적용된 최종 결과물(364KB)이 나옴

✅ 모든 이미지는 Figma screenshot API로 노드 렌더링
```

### 2-1. BG 프레임 렌더링 (섹션 배경)

```
각 섹션의 BG 프레임을 식별 → 합성된 배경 1장으로 렌더링:

⚠️ 주의: BG 프레임만 렌더링한다 (텍스트 포함된 상위 프레임 렌더링 금지)
  ❌ 섹션 전체를 렌더링 → 텍스트가 이미지에 포함 → HTML 텍스트와 중복
  ❌ TEXT 자식이 있는 프레임을 렌더링 → 이미지 텍스트 + HTML 텍스트 이중 표시
  ✅ BG 하위 프레임만 렌더링 → 텍스트 없는 배경만 → CSS background-image
  ✅ 텍스트는 tree.json에서 추출하여 HTML로 작성

  렌더링 전 TEXT 자식 검증 (BLOCKING):
    BG 프레임의 전체 자식 트리를 순회하여 TEXT 노드 존재 여부 확인
    TEXT 노드 발견 시:
      → TEXT 노드가 포함된 하위 프레임은 렌더링에서 제외
      → BG 프레임 내 순수 시각 요소(이미지, 벡터, 장식)만 렌더링
      → 또는 TEXT가 없는 가장 깊은 BG 하위 프레임을 개별 렌더링

BG 프레임 판별 기준:
  - name에 "BG", "bg" 포함
  - 또는 부모와 크기 동일(±10%) + 자식 이미지 3개 이상
  - 또는 1depth 첫 번째 자식이면서 이미지 노드 다수 보유

렌더링:
  node "[FIGMA_SCRIPT]" screenshot {fileKey} {bg.nodeId} --out=/tmp/{feature}/bg/{section}-bg.webp

→ BG 하위 20+ 레이어가 합성된 1장
→ CSS background-image로 처리
→ 개별 레이어(눈, 나무, 파티클 등) 다운로드하지 않음
```

### 2-1.5. 렌더링 금지 노드 (HTML로 구현할 것)

```
다음 조건에 해당하는 노드는 이미지로 렌더링하지 않는다:

1. TEXT 자식 보유 프레임 → HTML로 구현
   - 기간, 가격, 수량, 설명 등 텍스트 → HTML
   - "1,000", "보상 교환하기", "2025.12.22" 등 → 이미지에 넣지 않음
   - 텍스트가 이미지에 포함되면 수정/번역/접근성 불가

2. INSTANCE 반복 패턴 (카드/아이템 그리드) → HTML 반복 구조
   - 같은 부모 아래 동일 구조 INSTANCE 2개 이상
   - ❌ 카드 그리드를 통째 이미지 1장으로 렌더링 금지
   - ✅ 각 카드 내부의 이미지 에셋(아이콘, 썸네일)만 개별 추출
   - ✅ 카드 레이아웃, 텍스트, 버튼은 HTML+CSS

3. 인터랙티브 요소 → HTML <button>/<a>
   - name에 "btn", "button", "CTA", "link" 포함
   - 클릭 이벤트가 필요한 요소는 이미지 금지

4. 정보 표시 영역 → HTML 텍스트
   - 기간 표시 ("이벤트 기간", "교환/응모 종료일")
   - 가격/수량 ("1,000", "500")
   - 상태 표시 ("참여 대상", "로그인")
```

### 2-2. 콘텐츠 노드 렌더링

```
BG가 아닌 콘텐츠 이미지를 개별 노드 렌더링:

⚠️ 렌더링 전 2-1.5 체크 필수 — 하나라도 해당하면 이미지 렌더링 금지

대상 식별 (tree.json에서 — TEXT 자식 미보유 노드만):
  - 타이틀/서브타이틀 이미지 (name에 "title", "sub title") — 벡터 글자만, TEXT 노드 아님
  - 아이콘 (VECTOR/GROUP 크기 ≤ 64px)
  - 아이템/보상 썸네일 (name에 "item", "reward", "token", "coin") — 이미지 에셋만

렌더링 (imageRef 다운로드 아님!):
  node "[FIGMA_SCRIPT]" screenshot {fileKey} {node.nodeId} --out=/tmp/{feature}/content/{name}.webp

→ 텍스처 fill이 적용된 최종 결과물이 나옴
→ 22.7MB 텍스처 대신 364KB 렌더링 이미지
```

### 2-3. 벡터 글자 그룹 렌더링

```
커스텀 폰트 텍스트가 글자별 벡터로 분리된 경우:

판별:
  - 부모 GROUP/FRAME 아래 VECTOR 타입 3개 이상
  - 각 VECTOR 크기 < 60x60
  - 같은 imageRef를 공유 (텍스처 fill)

렌더링:
  부모 GROUP을 통째로 렌더링 (개별 글자 다운로드 금지)
  node "[FIGMA_SCRIPT]" screenshot {fileKey} {group.nodeId} --out=/tmp/{feature}/content/{name}.webp

예시:
  "MISSION 01" GROUP (174x42, 벡터 9개) → 렌더링 1장 (58KB)
  "일일/누적 출석" GROUP (327x51, 벡터 7개) → 렌더링 1장 (93KB)
```

### 2-4. imageRef 다운로드를 사용하는 유일한 경우

```
노드 렌더링이 불가능한 경우에만 imageRef 다운로드 폴백:
  - Figma screenshot API 실패 (rate limit, 권한 등)
  - 노드가 DOCUMENT 레벨이라 렌더링 불가

이 경우에도 파일 크기 확인:
  - 5MB 초과 → 텍스처 fill 가능성 높음 → 경고 로그
```

---

## 3. 스크린샷 — 검증 참조용

```
코드 생성에는 사용하지 않는다. Phase 4 시각 검증에서만 사용.

전체 스크린샷:
  node "[FIGMA_SCRIPT]" screenshot {fileKey} {nodeId} --out=/tmp/{feature}/full-screenshot.webp

섹션별 스크린샷 (1depth 자식 프레임 각각):
  node "[FIGMA_SCRIPT]" screenshot {fileKey} {child.nodeId} --out=/tmp/{feature}/sections/{name}.webp

용도:
  ✅ Phase 4에서 렌더링 결과와 pixelmatch 비교
  ✅ 시각 diff > 임계값 → 수정 판단 참고
  ❌ Phase 3 코드 생성의 입력으로 사용하지 않음
```

---

## 4. 추출 데이터 정리

```
추출 완료 후 /tmp/{feature}/ 구조:

/tmp/{feature}/
├── tree.json                    ← 코드 생성의 PRIMARY 소스
├── bg/                          ← BG 프레임 렌더링 (섹션당 1장)
│   ├── hero-bg.webp
│   ├── daily-bg.webp
│   └── ...
├── content/                     ← 콘텐츠 노드 렌더링
│   ├── hero-title.webp
│   ├── hero-subtitle.webp
│   ├── mission-01.webp           ← 벡터 글자 그룹 렌더링
│   ├── btn-login.webp
│   └── ...
├── full-screenshot.webp          ← Phase 4 검증용
└── sections/                    ← Phase 4 섹션별 검증용
    ├── hero.webp
    └── ...

이미지 분류 (실제 테스트 기준):
  | 분류 | 처리 | 예시 |
  |------|------|------|
  | BG 프레임 (89개) | 프레임 렌더링 → bg/ | hero-bg.webp (4.2MB) |
  | 벡터 글자 (33개) | GROUP 렌더링 → content/ | mission-01.webp (58KB) |
  | 콘텐츠 (8개) | 노드 렌더링 → content/ | hero-title.webp (364KB) |
  | 장식 (29개) | BG 렌더링에 포함 | — |
  → 전체 159개 → 실제 파일 약 18장

색상 팔레트 (tree.json의 backgroundColor/color 고유값):
  #0a1628, #00264a, #ffffff, ...

  토큰 매핑 테이블 (project-tokens.json 존재 시):
    | Figma 값 | 기존 토큰 | 상태 |
    |----------|-----------|------|
    | #0a1628 | $color-navy | ✅ 재사용 |
    | #ffd700 | — | 🆕 생성 |

폰트 목록 (tree.json의 fontFamily/fontSize/fontWeight):
  Pretendard: 400/500/700, 16px~48px

텍스트 콘텐츠 (모든 TEXT 노드의 characters):
  "겨울 이벤트", "12.1 ~ 12.31", "참여 대상 : PC 유저", ...

간격 패턴 (tree.json의 gap/padding 빈도 분석):
  gap: 8px, 16px, 24px, 32px
  padding: 16px, 24px, 32px
```

---

## 5. 노드 참조 (시맨틱 판단 힌트)

```
트리의 name/type은 Claude의 시맨틱 판단에 힌트로 사용:

name 패턴 → HTML 태그 힌트:
  "BG" → 배경 레이어 (position:absolute + z-index:0)
  "Title", "Txt_*" → 제목/텍스트 (<h2>, <p>)
  "Btn_*", "CTA" → 버튼 (<button>)
  "Icon_*" → 아이콘 (<img>)
  "Step1", "Item_*" → 반복 요소 (v-for 후보)
  "Period", "Info" → 정보 영역 (<div>)

type → 코드 매핑 기준:
  TEXT → <span> (Claude가 h2/p/button으로 승격)
  RECTANGLE/VECTOR + imageRef → <img src="다운로드된 파일">
  FRAME + Auto Layout → <div> + CSS flex
  FRAME + no Auto Layout → <div> + position:relative
  INSTANCE 반복 → 컴포넌트 후보 (v-for)
  GROUP → 논리적 래퍼 (보통 <div>)

이 정보는 트리→HTML 매핑의 보조 힌트이다.
레이아웃과 스타일은 tree.json의 css 객체에서 직접 매핑한다.
```
