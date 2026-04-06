---
name: vibe.figma.extract
description: Figma MCP에서 이미지 다운로드 + CSS 값 추출
triggers: []
tier: standard
---

# vibe.figma.extract — 데이터 추출

`get_design_context` 응답에서 이미지와 CSS 값을 추출하는 절차.

---

## 1. 이미지 에셋 추출 + 다운로드

### URL 추출

```
참조 코드에서 모든 에셋 URL을 수집:
  패턴: const {변수명} = "https://www.figma.com/api/mcp/asset/{uuid}"

예:
  const img21 = "https://www.figma.com/api/mcp/asset/76e951df-..."
  const imgTitle = "https://www.figma.com/api/mcp/asset/f97dad41-..."
  const imgSnowParticle12 = "https://www.figma.com/api/mcp/asset/3de2eeed-..."
```

### 파일명 결정

```
변수명 → kebab-case 파일명:
  img21 → img-21.webp
  imgTitle → title.webp
  imgSnowParticle12 → snow-particle-12.webp
  imgSnowmanItem11 → snowman-item-11.webp
  imgImgBannerStatic → banner-static.webp
```

### 다운로드

```
for each (변수명, url) in assets:
  Bash: curl -sL "{url}" -o public/images/{feature}/{파일명}.webp

다운로드 후 검증:
  Bash: ls -la public/images/{feature}/
  → 모든 파일 존재 + 0byte 아닌지 확인
  → 실패한 파일 → 재시도 1회
```

### 누락 에셋 처리

```
스크린샷에 보이는 이미지가 참조 코드에 에셋 URL로 없을 때:

1. get_metadata(섹션 nodeId)로 하위 노드 목록 확보
2. 이미지로 의심되는 하위 nodeId에 get_design_context 재호출
   → 에셋 URL 발견 시 다운로드
3. 그래도 없으면 → get_screenshot(해당 nodeId)으로 이미지 직접 저장
```

### 이미지 매핑 테이블

```
다운로드 완료 후 매핑 생성:

  imageMap = {
    img21: '/images/{feature}/img-21.webp',
    imgTitle: '/images/{feature}/title.webp',
    imgSnowParticle12: '/images/{feature}/snow-particle-12.webp',
    ...
  }

이 매핑은 코드 변환 시 src={변수명}을 로컬 경로로 교체하는 데 사용.
```

---

## 2. CSS 값 추출

### Tailwind → CSS 변환표

참조 코드의 Tailwind 클래스에서 CSS 속성 + 값을 추출:

| Tailwind | CSS | 스케일 적용 |
|----------|-----|-----------|
| `text-[48px]` | `font-size: 48px` | ✅ × scaleFactor |
| `text-[#1B3A1D]` | `color: #1B3A1D` | ❌ |
| `font-black` | `font-weight: 900` | ❌ |
| `font-bold` | `font-weight: 700` | ❌ |
| `font-semibold` | `font-weight: 600` | ❌ |
| `font-medium` | `font-weight: 500` | ❌ |
| `leading-[1.4]` | `line-height: 1.4` | ❌ (단위 없음) |
| `tracking-[-0.36px]` | `letter-spacing: -0.36px` | ✅ |
| `bg-[#0A1628]` | `background-color: #0A1628` | ❌ |
| `bg-[rgba(13,40,61,0.5)]` | `background: rgba(13,40,61,0.5)` | ❌ |
| `pt-[120px]` | `padding-top: 120px` | ✅ |
| `gap-[24px]` | `gap: 24px` | ✅ |
| `rounded-[12px]` | `border-radius: 12px` | ✅ |
| `shadow-[...]` | `box-shadow: ...` | 부분 (px만) |
| `w-[720px]` | `width: 720px` | ✅ |
| `h-[1280px]` | `height: 1280px` | ✅ |
| `opacity-40` | `opacity: 0.4` | ❌ |
| `blur-[3.5px]` | `filter: blur(3.5px)` | ✅ |
| `mix-blend-lighten` | `mix-blend-mode: lighten` | ❌ |
| `mix-blend-multiply` | `mix-blend-mode: multiply` | ❌ |
| `overflow-clip` | `overflow: clip` | ❌ |
| `absolute` | `position: absolute` | ❌ |
| `relative` | `position: relative` | ❌ |
| `inset-0` | `inset: 0` | ❌ |
| `flex` | `display: flex` | ❌ |
| `flex-col` | `flex-direction: column` | ❌ |
| `items-center` | `align-items: center` | ❌ |
| `justify-center` | `justify-content: center` | ❌ |
| `object-cover` | `object-fit: cover` | ❌ |
| `object-contain` | `object-fit: contain` | ❌ |
| `whitespace-nowrap` | `white-space: nowrap` | ❌ |
| `text-center` | `text-align: center` | ❌ |
| `text-white` | `color: #FFFFFF` | ❌ |
| `size-full` | `width: 100%; height: 100%` | ❌ |
| `max-w-none` | `max-width: none` | ❌ |
| `pointer-events-none` | `pointer-events: none` | ❌ |

### CSS 변수 패턴

```
참조 코드에 Figma 디자인 토큰이 CSS 변수로 포함될 수 있음:
  font-[family-name:var(--font/family/pretendard,...)]
  text-[length:var(--font/size/heading/24,24px)]
  text-[color:var(--color/grayscale/950,#171716)]

→ var() 안의 fallback 값(24px, #171716)을 사용.
→ CSS 변수명은 프로젝트 토큰 네이밍에 참고.
```

---

## 3. HTML 구조 추출

```
참조 코드의 JSX 구조가 HTML 구조.
data-name 속성으로 레이어 용도 파악:
  data-name="BG" → 배경 레이어
  data-name="Title" → 제목 영역
  data-name="Period" → 기간 정보 영역
  data-name="Light" → 장식 조명
  data-name="BTN_Share" → 공유 버튼

구조 변환은 vibe.figma.convert에서 처리.
```
