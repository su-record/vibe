---
name: vibe-figma-frame
tier: standard
description: "디자인 URL → 섹션별 get_design_context → 이미지 다운로드 + CSS 스타일 파일 작성"
triggers: []
---

# Design Frame — 디자인 URL → 코드

디자인 URL을 받아서 섹션별로 `get_design_context`를 호출하고,
**이미지를 전부 다운로드**하고 **CSS 값을 외부 스타일 파일에 작성**한다.

## 금지 사항

```
❌ CSS로 이미지 재현 (삼각형으로 나무, 원으로 눈사람 등)
❌ CSS gradient로 이미지 배경 대체
❌ placeholder / 빈 dashed box / src="" 남기기
❌ 이미지 없이 다음 섹션으로 넘어가기
❌ 컴포넌트 파일 안에 <style> 블록 / 인라인 style=""
❌ 스타일 값 추정 (참조 코드에 정확한 값이 있음)
```

## 플로우

```
디자인 URL 입력
  → get_metadata → 섹션 프레임 목록
  → Step A 컴포넌트와 매핑
  → 첫 번째 섹션 처리 전에 스타일 파일 구조 생성
  → 섹션별 루프:
      get_design_context → 참조 코드(CSS값 + 이미지URL)
      → 이미지 전부 다운로드
      → CSS 값을 외부 스타일 파일에 작성
      → 컴포넌트 template에 클래스명 + 이미지 경로 반영
  → 추가 디자인 URL? → 반응형 레이어 추가
  → 시각 검증 (스크린샷 비교)
```

---

## 1. URL 입력 + 섹션 매핑

```
AskUserQuestion: "디자인 Figma URL을 입력해주세요."

URL에서 fileKey, nodeId 추출
get_metadata(fileKey, nodeId) → 하위 프레임 목록
→ Step A 컴포넌트와 1:1 매핑 (이름 키워드 / 순서 / 스크린샷)
→ "디자인 프레임 N개 → 컴포넌트 N개 매핑 완료"
```

## 2. 스타일 파일 구조 생성 (첫 섹션 처리 전)

첫 번째 섹션을 처리하기 전에 Write로 파일 구조를 만든다.
이후 섹션에서는 Edit으로 추가.

```
styles/{feature}/
  index.scss              ← 모든 파일 @use
  _tokens.scss            ← 색상/폰트/간격 $변수 (참조 코드에서 추출)
  _mixins.scss            ← breakpoint mixin, fluid 함수
  _base.scss              ← reset, font-face
  layout/                 ← 섹션 배치/구조/배경 이미지
  components/             ← 텍스트 스타일, 버튼, 카드 등
```

### _tokens.scss 작성법

참조 코드의 Tailwind 값을 SCSS $변수로 변환:

```
참조 코드:  text-[48px] font-black text-[#1B3A1D] bg-[#0A1628]
                ↓
토큰 파일:  $text-hero: 36px;          // 48 × scaleFactor(0.75)
            $color-heading: #1B3A1D;   // hex 그대로
            $bg-primary: #0A1628;      // hex 그대로
```

## 3. 섹션별 처리 (핵심 루프)

**각 섹션에 대해 순서대로:**

### 3-a. get_design_context 호출

```
get_design_context(fileKey, 섹션.nodeId)
→ 참조 코드 (React+Tailwind) + 에셋 URL 반환

참조 코드에 포함된 것:
  - HTML 구조 (어떤 요소가 어디에)
  - Tailwind 클래스 = Figma 토큰 값 (색상, 폰트, 간격, 장식)
  - 이미지 에셋 URL (const xxxImage = 'https://figma.com/api/mcp/asset/...')
```

### 3-b. 이미지 전부 다운로드

```
참조 코드에서 모든 에셋 URL 추출:
  → https://www.figma.com/api/mcp/asset/ 패턴 전부 수집

각 URL 다운로드:
  Bash: curl -L "{url}" -o static/images/{feature}/{name}.webp

다운로드 검증:
  → 파일 존재 + 0byte 아닌지
  → 누락 시 재다운로드

에셋 URL이 부족하면 (레이어 비정형):
  → get_screenshot(섹션 nodeId)으로 스크린샷 확인
  → 스크린샷에 보이는 이미지가 참조 코드에 없으면:
    get_metadata로 하위 노드 탐색 → 하위 nodeId에 get_design_context 재호출
    → 그래도 없으면 get_screenshot으로 해당 노드 이미지 직접 저장
```

### 3-c. CSS 값을 외부 스타일 파일에 작성

참조 코드의 Tailwind 값을 프로젝트 스타일로 변환하여 **외부 파일에 Write/Edit**.

```
참조 코드:
  <section className="relative overflow-hidden min-h-screen">
    <div className="absolute inset-0 z-0">
      <img src={heroBg} className="w-full h-full object-cover" />
    </div>
    <div className="relative z-10 flex flex-col items-center pt-[120px]">
      <h1 className="text-[48px] font-black text-[#1B3A1D] leading-[1.2]">추운 겨울,</h1>
      <p className="text-[24px] text-[#333] mt-[16px]">겨울을 녹일 보상</p>
    </div>
  </section>

변환 → layout/_hero.scss:
  .heroSection { position: relative; overflow: hidden; min-height: 100vh; }
  .heroBg { position: absolute; inset: 0; z-index: 0;
    background-image: url('/images/{feature}/hero-bg.webp');
    background-size: cover; }
  .heroContent { position: relative; z-index: 10;
    display: flex; flex-direction: column; align-items: center;
    padding-top: 90px; }  // 120px × 0.75

변환 → components/_hero.scss:
  .heroTitle { font-size: 36px; font-weight: 900; color: #1B3A1D; line-height: 1.2; }
  .heroDescription { font-size: 18px; color: #333; margin-top: 12px; }
```

**변환 규칙:**
- 색상 hex → 그대로 (또는 _tokens.scss $변수 참조)
- px 값 → × scaleFactor (R-3)
- Tailwind 클래스 → CSS 속성 (flex → display: flex, items-center → align-items: center)
- layout/ → 배치, 구조, 배경 이미지
- components/ → 텍스트 스타일, 버튼, 카드, UI 요소

### 3-d. 컴포넌트 template 리팩토링

Step A에서 만든 컴포넌트는 기능/인터랙션만 있는 기본 마크업.
Step B에서 **참조 코드의 HTML 구조를 기반으로 template을 다시 작성**한다.

```
Step A 보존할 것:
  - <script setup>의 JSDoc 주석, 인터페이스, 목 데이터, 핸들러
  - 인터랙션 로직 (v-if, @click, emit)

template 재작성할 것:
  - 참조 코드의 HTML 구조를 프로젝트 스택으로 변환
  - 이미지: 다운로드한 로컬 경로로 <img> 또는 background-image
  - 배경 이미지 섹션: Multi-Layer 구조 (.{section}Bg + .{section}Content)
  - 클래스명: 외부 스타일 파일(3-c)의 셀렉터와 매칭
  - Step A의 기능 코드를 새 template 구조에 맞게 재배치

예:
  Step A template (기능만):
    <section class="heroSection">
      <h2>{{ title }}</h2>
      <button @click="handleShare">공유하기</button>
    </section>

  Step B template (디자인 적용 후):
    <section class="heroSection">
      <div class="heroBg" />
      <div class="heroBgOverlay" />
      <div class="heroContent">
        <img class="heroLogo" src="/images/{feature}/logo.webp" alt="이벤트 로고" />
        <h2 class="heroTitle">{{ title }}</h2>
        <p class="heroDescription">{{ description }}</p>
        <div class="heroInfoCard">
          <p>참여 대상: {{ target }}</p>
          <p>이벤트 기간: {{ period }}</p>
        </div>
        <button class="heroShareBtn" @click="handleShare">공유하기</button>
      </div>
      <img class="heroCharacter" src="/images/{feature}/snowman.webp" alt="" aria-hidden="true" />
      <img class="heroVehicle" src="/images/{feature}/truck.webp" alt="" aria-hidden="true" />
    </section>

컴포넌트 안에 <style> 블록 / 인라인 style="" 금지.
스타일은 외부 파일에만 존재.
```

## 4. 추가 뷰포트 (반응형)

```
"추가 디자인 URL이 있나요?"
→ URL → 같은 루프 실행, 기존 코드에 반응형만 추가:
  - 값 다름 → clamp() fluid
  - 구조 다름 → @media 분기
  - 배경 이미지 다름 → @media 분기
  - 기존 코드 삭제 금지
→ "없음" → 검증으로
```

## 5. 검증

```
for each section:
  get_screenshot(섹션 nodeId) → 원본 스크린샷
  생성 코드 렌더링 (/vibe.utils --preview 또는 dev 서버)
  → 비교

체크:
  □ 모든 이미지 에셋 로컬에 존재 + 코드에서 참조됨
  □ Figma URL 잔존 0건 (Grep)
  □ placeholder 0건
  □ CSS art 0건 (CSS 도형으로 이미지 재현한 곳)
  □ 외부 스타일 파일에 font-size/color/background-image 존재
  □ 컴포넌트 내 <style> 블록 0건
  □ P1 = 0, Match Score 95%+

P1 있으면 → 수정 → 재검증 (P1=0 될 때까지, 제한 없음)
```

## 참조

- `vibe-figma-rules` — 스케일 팩터(R-3), 이미지 패턴(R-4), 검증(R-6)
- `vibe-figma-style` — 토큰 포맷, 클래스 네이밍
- `vibe-figma-codegen` — semantic HTML, 스택별 규칙
