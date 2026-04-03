---
name: vibe-figma-frame
tier: standard
description: "디자인 URL → 프레임별 개별 추출 → 스타일/이미지/코드 반영 → 검증 루프. Step B/C 공통."
triggers: []
---

# Design Frame (프레임별 정밀 추출 + 코드 반영)

디자인 URL 하나를 받아서 **프레임별로 쪼개서 추출**하고, Step A에서 만든 컴포넌트에 스타일/이미지를 채움.
어떤 뷰포트든 동일한 프로세스. 두 번째 호출 시 반응형 레이어만 추가.

> **실행 지시: 분석만 하지 말 것.**
> - 이미지: WebFetch로 다운로드 → 파일 저장
> - 스타일: Write 도구로 SCSS/CSS 파일 생성
> - 코드: Edit 도구로 Step A 컴포넌트의 template/style 채움
> - 토큰: Edit 도구로 _tokens 파일에 추출한 값 추가

## HARD RULES (위반 시 Step B 미완성)

```
1. PLACEHOLDER 금지
   코드에 "placeholder", "Key Visual Image", 빈 dashed box,
   alt="placeholder", src="" 등이 남아있으면 → Step B 미완성.
   이미지를 추출 못하면 placeholder가 아니라 대체 추출(B-3.3 Step e)을 실행한다.

2. 이미지 없는 섹션은 완료가 아니다
   스크린샷에 이미지(배경/캐릭터/일러스트/아이콘)가 보이는 섹션에서
   생성 코드에 실제 이미지 파일이 없으면 → 해당 섹션 미완성.
   다음 섹션으로 넘어가지 않고 현재 섹션의 이미지를 확보할 때까지 머문다.

3. 단색 배경으로 대체 금지
   원본에 이미지 배경이 있는데 생성 코드가 CSS gradient/단색으로 대체하면 → P1.
   이미지를 반드시 다운로드하여 background-image로 적용해야 한다.

4. 이미지 추출 실패 = 전체 실패
   인벤토리의 이미지 중 하나라도 확보 못하면 Step B를 완료로 마킹하지 않는다.
   대체 추출 경로(하위 노드 탐색 → 개별 스크린샷 → 크롭)를 전부 시도한 후,
   그래도 실패하면 사용자에게 해당 이미지를 직접 제공해달라고 요청한다.

5. 텍스트 스타일 미적용 = 미완성
   스크린샷에서 읽은 모든 텍스트 스타일을 코드에 반영해야 한다:
     - font-size (스케일 팩터 적용)
     - font-weight
     - color
     - line-height
     - letter-spacing (있으면)
     - text-align
   제목, 본문, 버튼 텍스트, 설명 등 스크린샷에 보이는 모든 텍스트 요소에 적용.
   스타일이 적용되지 않은 텍스트 요소가 있으면 → P1.
   브라우저 기본 스타일(검은색 16px)로 보이는 텍스트가 있으면 → 미완성.

6. 스타일은 반드시 외부 파일에 작성
   컴포넌트 파일(.vue/.tsx) 안에 <style> 블록이나 인라인 스타일을 작성하지 않는다.
   모든 스타일은 외부 파일에 작성:
     --new 모드: styles/{feature}/layout/_섹션.scss, components/_요소.scss
     기본 모드: 프로젝트 기존 스타일 패턴에 따름

   작성 후 검증:
     Grep: "<style" in components/{feature}/ → 0건
     Grep: "style=" in components/{feature}/ → 0건 (동적 바인딩 제외)
   위반 시 → 해당 스타일을 외부 파일로 이동 후 재검증.
```

## 입력

- 디자인 Figma URL (전체 페이지)
- Step A에서 생성된 컴포넌트 파일들
- 호출 횟수 (첫 번째 = base, 두 번째 이후 = responsive 추가)

## B-1. 디자인 URL 입력

AskUserQuestion (options 사용 금지, 자유 텍스트만):

```
첫 번째 호출:
  question: "디자인 Figma URL을 입력해주세요."
  → 응답 대기 → URL 저장 → B-2~B-5 실행

검증 완료 후:
  question: "추가 디자인 URL이 있나요? (없으면 '없음')"
  → URL 입력 → responsive 모드로 B-2~B-5 재실행
  → "없음" → Step D(공통화)로 진행

모바일/PC 순서를 강제하지 않음. 어떤 뷰포트든 먼저 입력 가능.
첫 번째 URL = base 스타일, 추가 URL = 반응형 레이어 추가.
```

## B-2. 전체 → 섹션 프레임 매핑

```
1. get_metadata(fileKey, nodeId) → 전체 페이지 하위 프레임 목록

2. 프레임 이름으로 Step A 컴포넌트와 매핑:
   - 프레임 이름 키워드 매칭
   - 매칭 안 되면 순서(위→아래)로 Step A 섹션과 1:1 대응
   - 그래도 안 되면 get_screenshot으로 비주얼 비교

3. 매핑 결과 출력:
   "디자인 프레임 N개 → 컴포넌트 N개 매핑 완료"
   매핑 안 된 프레임이 있으면 사용자에게 확인
```

## B-3. 섹션별 개별 추출

**각 매핑된 섹션에 대해 순서대로:**

### 3-1. 스크린샷 시각 분석 + 이미지 인벤토리 (1순위)

```
get_screenshot(fileKey, designFrame.nodeId)
→ 원본 디자인 이미지 확보 — 이것이 코드 생성의 1차 소스

스크린샷에서 읽는 항목 (vibe-figma-rules R-7 참조):
  → 레이아웃 구조 (섹션 경계, flex/grid 방향, 요소 배치)
  → 색상 (배경, 텍스트, 버튼, 보더)
  → 타이포 (크기 비율, 굵기, 줄간격) — 스케일 팩터 적용 (R-3)
  → 간격 (패딩, gap, 마진) — 스케일 팩터 적용 (R-3)
  → z-index 관계 (겹침 구조, 투명도)
```

**이미지 인벤토리 작성 (필수):**

```
스크린샷을 보고 해당 섹션에 보이는 모든 이미지를 목록화:

  imageInventory = [
    { name: "hero-bg", type: "background", description: "눈 테마 풀스크린 배경" },
    { name: "hero-character", type: "overlay", description: "캐릭터 일러스트 우하단" },
    { name: "hero-vehicle", type: "content", description: "차량 이미지 중앙" },
    { name: "hero-logo", type: "content", description: "이벤트 로고 상단" },
    { name: "hero-particle", type: "overlay", description: "눈 파티클 효과" },
  ]

→ 이 인벤토리가 B-3.3 다운로드의 체크리스트가 됨
→ B-5 검증에서 인벤토리 vs 코드의 이미지를 1:1 대조
→ 인벤토리에 있는데 코드에 없으면 = P1
```

### 3-2. 참조 코드 + 에셋 추출 (2순위)

```
get_design_context(fileKey, designFrame.nodeId)
→ 참조 코드 + 에셋 URL

참조 코드에서 가져오는 것:
  ✅ 이미지 에셋 URL (https://figma.com/api/mcp/asset/...)
  ✅ 정확한 hex 색상값 (스크린샷 추정보다 정확할 때)
  ✅ 폰트 패밀리명, border-radius, shadow 값
  ⚠️ 레이아웃/구조 — 스크린샷과 대조 후 채택
  ❌ px 값 그대로 사용 금지 — 반드시 스케일 팩터 적용
```

### 3-3. 이미지 에셋 다운로드 (BLOCKING — 코드 반영 전 필수)

> **인벤토리의 모든 이미지가 로컬에 존재해야 다음 단계로 넘어갈 수 있다.**

```
Step a: 참조 코드에서 에셋 URL 추출
  → 모든 https://www.figma.com/api/mcp/asset/ URL 수집
  → 각 URL을 imageInventory 항목과 매칭

Step b: 인벤토리 vs 에셋 URL 대조
  → 인벤토리에 있는데 에셋 URL이 없는 이미지 = 누락 후보
  → 누락 후보에 대해 대체 추출 실행 (Step e)

Step c: 매칭된 에셋 다운로드
  Bash: curl -L "{url}" -o static/images/{feature}/{name}.webp
  파일명: 인벤토리 name 기반 kebab-case

Step d: 다운로드 검증
  → 파일 존재 + 0byte 아닌지 확인
  → 누락/실패 시 재다운로드

Step e: 대체 추출 (참조 코드에 에셋 URL이 없는 이미지)
  레이어가 비정형("Frame 633372")이면 참조 코드에 이미지가 누락될 수 있음.
  이 경우 다음 순서로 시도:

  1. 하위 노드 탐색:
     get_metadata로 섹션 하위 프레임 목록 확보
     → 이미지로 의심되는 하위 nodeId에 대해 get_design_context 재호출
     → 에셋 URL 확보되면 다운로드

  2. 하위 노드 개별 스크린샷:
     이미지로 의심되는 하위 nodeId에 대해 get_screenshot
     → 해당 스크린샷 자체를 이미지 에셋으로 저장
     → 배경 이미지: 스크린샷을 background-image로 사용
     → 콘텐츠 이미지: 스크린샷을 <img>로 사용

  3. 섹션 전체 스크린샷 크롭:
     위 방법이 다 실패하면, 섹션 스크린샷에서 해당 영역을 잘라서 사용
     → 최후 수단이지만 이미지 누락보다는 낫다

Step f: 최종 인벤토리 체크
  인벤토리 항목 수 = 다운로드된 파일 수
  하나라도 빠지면 → Step e 재시도
  모든 이미지가 로컬에 있어야 → 3-4로 진행
```

### 3-4. 이미지 코드 패턴 적용

이미지 분류 결과에 따라 코드 생성:

**Background Image → Multi-Layer 패턴 (vibe-figma-rules R-4 참조)**

**Content Image:**
```tsx
// React / Next.js — Image 컴포넌트 우선
<Image src="/images/{feature}/product.webp" alt="설명" width={600} height={400} />

// Vue / Nuxt — NuxtImg 우선
<NuxtImg src="/images/{feature}/product.webp" alt="설명" width="600" height="400" loading="lazy" />
```

**반응형 Content Image:**
```html
<picture>
  <source media="(min-width: {breakpoint}px)" srcset="/images/{feature}/hero-pc.webp" />
  <img src="/images/{feature}/hero-mobile.webp" alt="설명" loading="eager" />
</picture>
```

**반응형 Background Image:**
```css
.heroBg { background-image: url('/images/{feature}/hero-mobile.webp'); }
@media (min-width: {breakpoint}px) {
  .heroBg { background-image: url('/images/{feature}/hero-pc.webp'); }
}
```

### 3-5. 외부 스타일 파일 생성 (Write 도구)

> **스타일은 컴포넌트 파일이 아닌 외부 파일에 작성한다. (HARD RULE 6)**

```
섹션별로 2개 파일 생성:

1. layout 파일 — 섹션 배치/구조/배경
   Write: styles/{feature}/layout/_{section}.scss

   포함 내용:
     - 섹션 position, display, flex/grid, padding, margin
     - Multi-Layer 배경 (.{section}Bg, .{section}BgOverlay, .{section}Content)
     - 섹션 min-height, overflow

2. components 파일 — UI 요소 모양/텍스트
   Write: styles/{feature}/components/_{section}-elements.scss

   포함 내용:
     - 모든 텍스트 스타일 (아래 텍스트 스타일 추출 참조)
     - 버튼/카드/배지 모양 (color, border, border-radius, shadow)
     - hover/focus/active 상태
     - 아이콘/로고 크기
```

### 3-6. 텍스트 스타일 추출 + 적용

> **스크린샷에 보이는 모든 텍스트 요소에 스타일을 적용해야 한다.**

```
스크린샷에서 텍스트 요소별로 추출:

  textStyles = [
    {
      selector: ".heroTitle",
      fontSize: "스크린샷에서 읽은 값 × scaleFactor",
      fontWeight: "스크린샷에서 판단 (bold/semibold/normal)",
      color: "참조 코드 hex 또는 스크린샷 추정",
      lineHeight: "스크린샷에서 판단",
      textAlign: "center/left/right",
    },
    {
      selector: ".heroDescription",
      fontSize: "...",
      ...
    },
    // 섹션 내 모든 텍스트 요소
  ]

적용 위치: styles/{feature}/components/_{section}-elements.scss

  .heroTitle {
    font-size: figma.$figma-text-hero;    // 토큰으로 정의
    font-weight: 900;
    color: #1B3A1D;                       // 참조 코드에서 정확한 hex
    line-height: 1.2;
    text-align: center;
  }

  .heroDescription {
    font-size: figma.$figma-text-sub;
    font-weight: 400;
    color: #333;
    line-height: 1.6;
    text-align: center;
  }

텍스트 스타일 누락 검증:
  → 스크린샷의 텍스트 요소 수 = 스타일 파일의 font-size 선언 수
  → 브라우저 기본 스타일(검은색 16px serif)로 보이는 텍스트 = P1
```

### 3-7. 컴포넌트 파일에 반영 (Edit 도구)

```
컴포넌트 파일에는 template + script만 수정한다.
스타일은 3-5에서 생성한 외부 파일에만 존재.

a. template 수정:
   - placeholder → 실제 마크업으로 교체
   - 클래스명 추가 (외부 스타일 파일의 셀렉터와 매칭)
   - 이미지 태그에 로컬 경로 설정

b. Step A 코드 보존:
   - 기능 주석/핸들러/인터페이스 유지
   - 목 데이터/이벤트 바인딩 유지

c. 스타일 import 설정:
   - 루트 페이지 또는 설정 파일에서 외부 스타일 파일 import
   - 컴포넌트 파일 안에 <style> 블록 작성 금지

주의:
  - 스크린샷에 보이는 이미지가 코드에 없으면 → 누락
  - Figma 임시 URL이 코드에 남으면 안 됨
  - 컴포넌트에 style="" 인라인 스타일 금지 (동적 바인딩 제외)
```

## B-4. 뷰포트 모드에 따른 스타일 적용

### 첫 번째 URL (base)

```
- 모든 스타일을 base로 작성 (반응형 미고려)
- 토큰 파일에 추출한 값 저장
- 이미지 다운로드 + 로컬 경로 매핑
```

### 추가 URL (responsive)

```
기존 코드를 수정하지 않고 반응형 레이어만 추가:

1. 프레임 width로 뷰포트 자동 판별
2. 값이 다른 속성 → clamp() fluid 토큰 (계산: vibe-figma-rules R-3)
3. 레이아웃 구조가 다른 부분 → @media (min-width: {breakpoint}px)
4. 뷰포트별 배경 이미지 → @media 분기
5. 추가 이미지 에셋 다운로드 (base와 동일하면 스킵)
6. 기존 base 코드/주석/핸들러는 절대 삭제하지 않음
```

## B-5. 검증 루프

공통 프로세스: **vibe-figma-rules R-6** (6-1 ~ 6-7) 전체 적용.

### Step B 검증 흐름

```
for each section in mappings:

  1. 원본 확보: B-3.1에서 이미 get_screenshot한 섹션 이미지
  2. 생성 결과 확보: /vibe.utils --preview 또는 dev 서버 스크린샷 (R-6.2)
  3. 섹션별 비교: 레이아웃, 배경, 색상, 타이포, 간격, 이미지 (R-6.3~4)
  4. Diff Report 출력 (R-6.5)
  5. P1 → 해당 섹션 수정 → 재비교 (R-6.6)
```

### Step B 추가 검증 항목

```
1. 이미지 인벤토리 대조:
   for each item in imageInventory:
     □ 로컬 파일 존재 (Glob)
     □ 0byte 아님 (ls -la)
     □ 코드에서 참조됨 (Grep: 파일명으로 검색)
     □ 올바른 패턴 적용됨:
       - background → .{section}Bg { background-image: url(...) }
       - content → <img src="..." /> 또는 <Image />
       - overlay → .{section}Character { background-image: url(...) }
   하나라도 실패 → P1 → 수정 → 재검증

2. 텍스트 스타일 검증:
   for each section:
     □ 외부 스타일 파일 존재 (Glob: styles/{feature}/**/*.scss)
     □ 스크린샷의 텍스트 요소 수 ≈ font-size 선언 수
       Grep: "font-size" in styles/{feature}/
     □ 브라우저 기본 스타일로 보이는 텍스트 0건
       → 모든 텍스트에 font-size, color, font-weight 지정 확인
     □ color 값이 적용됨 (원본 스크린샷 색상과 매칭)
   미적용 텍스트 발견 → P1

3. 스타일 분리 검증:
   □ Grep: "<style" in components/{feature}/**/*.vue → 0건
   □ Grep: "<style" in components/{feature}/**/*.tsx → 0건
   □ Grep: 'style="' in components/{feature}/ → 0건 (v-bind:style 동적 바인딩 제외)
   위반 → 외부 파일로 이동 → 재검증

4. Figma 임시 URL + placeholder 잔존 체크:
   □ Grep: "figma.com/api/mcp/asset" → 0건
   □ Grep: "placeholder" (대소문자 무시) → 0건
   □ Grep: "Key Visual" → 0건

5. 배경 이미지 Multi-Layer 검증:
   스크린샷에 배경 이미지가 보이는 섹션:
     □ .{section}Bg 클래스 존재 (Grep)
     □ .{section}Content 클래스 존재 (z-index 최상위)
     □ 배경 위 텍스트 가독성 확보 (오버레이 유무)
   누락 → P1

6. (responsive) 뷰포트별:
   □ 뷰포트별 다른 배경 이미지 → @media 분기 있는지
   □ 이전 뷰포트 스타일/이미지 깨지지 않았는지
```

## 참조 스킬

코드 생성 시 다음 스킬의 규칙을 적용:
- `vibe-figma-rules` — 공통 규칙 (R-1~R-7)
- `vibe-figma-style` — 토큰/스타일 아키텍처
- `vibe-figma-codegen` — 마크업/코드 생성 규칙
