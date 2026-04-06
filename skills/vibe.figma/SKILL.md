---
name: vibe.figma
description: Figma design to code — 시각 기반 퍼즐 조립 방식
triggers: []
tier: standard
---

# vibe.figma — Visual Puzzle Assembly

## 핵심 원칙

```
스크린샷이 정답이다. Figma 데이터는 재료일 뿐이다.

❌ Figma 트리 구조를 HTML로 변환하지 않는다 (이 방식은 실패한다)
✅ 스크린샷을 보고 "무엇을 만들어야 하는지" 파악한다
✅ Figma 데이터(이미지, 색상, 수치)를 정확한 재료로 사용한다
✅ 사람 개발자처럼: 디자인 보고 → 에셋 받고 → 만들면서 비교
```

## 금지 사항

```
❌ Figma 레이어 트리를 그대로 div 구조로 변환
❌ CSS로 이미지 재현 (gradient/shape으로 그림 그리기)
❌ 이미지 다운로드 없이 코드 생성 진행
❌ placeholder / 빈 src="" 남기기
❌ 색상·크기를 추정 (재료함에 정확한 값이 있음)
❌ 컴포넌트 파일 안에 <style> 블록 / 인라인 style=""
✅ 외부 SCSS 파일에만 스타일 작성
```

## 전체 플로우

```
/vibe.figma
  → Phase 0: Setup (스택 감지, 디렉토리 생성)
  → Phase 1: Storyboard (스토리보드 → 레이아웃 + 컴포넌트 + 기능 정의)
  → Phase 2: 재료 확보 (디자인 URL → 스크린샷 + 이미지 + CSS + 텍스트)
  → Phase 3: 퍼즐 조립 (스크린샷 보면서 Phase 1 컴포넌트에 디자인 입히기)
  → Phase 4: 검증 루프 (빌드 → 스크린샷 → 비교 → 수정 → 반복)
```

---

## Phase 0: Setup

```
1. 프로젝트 스택 감지:
   - package.json → react/vue/svelte
   - next.config.* / nuxt.config.* → 프레임워크
   - *.scss / sass in deps → SCSS
   - tailwind.config.* → Tailwind

2. 기존 스타일 디렉토리 감지:
   - assets/scss/ or src/styles/ or styles/

3. 피처명 결정:
   - Figma 파일명에서 추출 → kebab-case
   - 예: "PUBG 겨울 PC방 이벤트" → winter-pcbang

4. 디렉토리 생성:
   - components/{feature}/
   - public/images/{feature}/ (또는 static/images/{feature}/)
   - styles/{feature}/ (layout/, components/ 하위)

5. 기존 컴포넌트 스캔:
   - Glob "components/**/*.vue" or "components/**/*.tsx"
   - 재사용 가능한 컴포넌트 목록 수집 (GNB, Footer, Button 등)
```

---

## Phase 1: Storyboard

사용자에게 질문한다:
- question: "스토리보드 Figma URL을 입력해주세요. (없으면 '없음')"
- options 제공 금지 — 자유 텍스트 입력만 허용

"없음" 응답 시 → Phase 2로 건너뜀

### 1-1. 스토리보드 분석

```
URL에서 fileKey, nodeId 추출

1단계 (BLOCKING): 루트 depth=2로 전체 프레임 + nodeId 수집
  # [FIGMA_SCRIPT] = ~/.vibe/hooks/scripts/figma-extract.js
  node "[FIGMA_SCRIPT]" tree {fileKey} {nodeId} --depth=2

  → 모든 자식 프레임의 name + nodeId + size 를 테이블로 출력
  → nodeId가 빠진 프레임이 있으면 안 됨

2단계: name 패턴으로 프레임 분류
  SPEC   — "기능 정의서", "정책" → depth 높여서 텍스트 추출
  CONFIG — "해상도", "브라우저" → 스케일 팩터 계산
  SHARED — "공통", "GNB", "Footer", "Popup" → 공통 컴포넌트 파악
  PAGE   — "화면설계", "메인 -" → 섹션 목록 + 인터랙션 스펙

핵심 프레임 선별 (전부 읽지 않음):
  1순위: SPEC (기능 정의서) — 1개
  2순위: CONFIG (해상도) — 1개
  3순위: PAGE 중 메인 섹션만 (3.1, 3.2, 3.3, 3.4, 3.5, 3.6)
         하위 케이스(3.1.1, 3.2.1 등)는 건너뜀
  4순위: SHARED (공통 요소, Popup) — 필요 시

높이 1500px 이상 프레임:
  → node "[FIGMA_SCRIPT]" screenshot으로 시각 파악
  → 또는 depth 높여서 하위 분할 조회
```

### 1-2. 레이아웃 + 컴포넌트 구성 (코드 생성)

```
스토리보드에서 파악한 섹션 구조로 실제 파일을 생성한다.

1. 루트 페이지 파일 생성 (Write):
   pages/{feature}.vue (또는 app/{feature}/page.tsx)
   → 모든 섹션 컴포넌트 import + 순서대로 배치
   → 팝업/모달 조건부 렌더링

2. 섹션 컴포넌트 파일 생성 (Write):
   components/{feature}/HeroSection.vue
   components/{feature}/DailyCheckInSection.vue
   components/{feature}/PlayTimeMissionSection.vue
   ...PAGE 프레임 수만큼

   각 컴포넌트에 반드시 포함:

   <template>:
     - 섹션 제목 <h2> (스토리보드에서 추출한 실제 텍스트)
     - 설명 텍스트 <p>
     - 리스트 렌더링 (v-for + 목 데이터)
     - 버튼/CTA (실제 라벨 + @click 핸들러)
     - 조건부 렌더링 (상태에 따른 v-if)
     → 빈 template 금지. 브라우저에서 텍스트가 보여야 함.

   <script setup>:
     - JSDoc 주석으로 기능 요구사항 작성:
       /**
        * 일일 출석 미션 섹션
        *
        * [기능 정의]
        * - 매일 출석 시 스노우 토큰 즉시 지급
        * - 누적 3/5/7일 달성 시 추가 보상
        *
        * [인터랙션]
        * ① 출석하기 클릭 → API호출 → 토큰지급 표시
        * ② 누적 보상 클릭 → 보상 수령
        *
        * [상태] default, checked, reward-claimed
        */
     - TypeScript 인터페이스
     - 목 데이터 (빈 배열 금지, 3~7개 아이템)
     - 이벤트 핸들러 stub (body는 // TODO:)

   <style> 블록 없음 — 스타일은 Phase 3에서 외부 파일로.

3. 공통 컴포넌트 (SHARED에서 파악):
   → 프로젝트에 이미 있으면 import 재사용
   → 없으면 새로 생성 (GNB, Footer, Popup)

4. 스타일 디렉토리 구조 생성 (빈 파일):
   styles/{feature}/index.scss
   styles/{feature}/_tokens.scss
   styles/{feature}/_mixins.scss
   styles/{feature}/_base.scss
   styles/{feature}/layout/
   styles/{feature}/components/
```

### 1-3. 검증

```
Phase 1 완료 조건:
  □ 브라우저에서 열면 각 섹션의 텍스트/리스트/버튼이 보인다
  □ 클릭하면 핸들러가 실행된다
  □ 모든 컴포넌트에 [기능 정의] + [인터랙션] + [상태] JSDoc
  □ 빈 배열 0개, 빈 template 0개, <style> 블록 0개
  □ 빌드 성공

빈 화면 = Phase 1 미완성. Phase 2로 넘어가지 않는다.
스타일/이미지는 없어도 됨 — Phase 3에서 채움.
```

---

## Phase 2: 재료 확보

Phase 1 컴포넌트가 준비된 상태에서, 디자인 URL로 시각 재료를 수집한다.

사용자에게 질문한다:
- question: "베이스 디자인(모바일) Figma URL을 입력해주세요."
- options 제공 금지 — 자유 텍스트 입력만 허용

### 2-1. 디자인 재료 추출

```
URL에서 fileKey, nodeId 추출

1단계 — 전체 스크린샷 (정답 사진):
  node "[FIGMA_SCRIPT]" screenshot {fileKey} {nodeId} --out=/tmp/{feature}/full-screenshot.png

2단계 — 전체 트리 + CSS (수치 재료):
  node "[FIGMA_SCRIPT]" tree {fileKey} {nodeId} --depth=10
  → /tmp/{feature}/tree.json 에 저장

3단계 — 전체 이미지 다운로드 (시각 재료):
  node "[FIGMA_SCRIPT]" images {fileKey} {nodeId} --out=/tmp/{feature}/images/ --depth=10
  → 모든 이미지 에셋 확보. 누락 0건, 0byte 0건.

4단계 — 섹션별 스크린샷 (부분 정답):
  트리의 1depth 자식 프레임 각각:
    node "[FIGMA_SCRIPT]" screenshot {fileKey} {child.nodeId} --out=/tmp/{feature}/sections/{child.name}.png
```

### 2-2. 재료함 정리

```
Phase 2 완료 시 /tmp/{feature}/ 에 다음이 준비되어야 함:

/tmp/{feature}/
├── full-screenshot.png          ← 전체 정답 사진
├── tree.json                    ← 노드 트리 + CSS 수치
├── images/                      ← 모든 이미지 에셋
│   ├── hero-bg.png
│   ├── hero-title.png
│   ├── card-item-1.png
│   └── ...
└── sections/                    ← 섹션별 정답 사진
    ├── hero.png
    ├── daily-checkin.png
    ├── playtime-mission.png
    └── ...

재료 목록 (material-inventory):
  - 이미지: 파일명 + 크기 + 용도 추정 (BG/icon/title/decoration)
  - 색상: tree.json에서 추출한 모든 고유 색상값
  - 폰트: 사용된 font-family, size, weight 목록
  - 텍스트: 모든 TEXT 노드의 characters 값
  - 간격: padding, gap, margin 사용 빈도 높은 값
```

### 스케일 팩터

```
스토리보드 CONFIG 또는 기본값에서:
  모바일: scaleFactor = 480 / 720 = 0.667 (또는 targetMobile / designMobile)
  PC:     scaleFactor = 1920 / 2560 = 0.75 (또는 targetPc / designPc)

적용 대상: font-size, padding, margin, gap, border-radius, width, height
적용 안 함: color, opacity, font-weight, z-index, line-height(단위 없을 때)
```

---

## Phase 3: 퍼즐 조립

**Phase 1에서 만든 컴포넌트에 Phase 2의 재료로 디자인을 입힌다.**
**스크린샷을 보면서 퍼즐을 맞추듯 조립한다.**
**첫 섹션(Hero) 단독 완료 후 나머지 섹션 병렬 진행.**

### 3-0. SCSS Setup + 등록 (첫 섹션 전)

```
Phase 1에서 생성한 빈 SCSS 파일에 기본 내용 Write:
  styles/{feature}/index.scss      ← @import 진입점
  styles/{feature}/_tokens.scss    ← 재료함에서 추출한 디자인 토큰
  styles/{feature}/_mixins.scss    ← breakpoint mixin
  styles/{feature}/_base.scss      ← 루트 클래스

토큰 추출 (tree.json의 CSS 수치에서):
  - 색상 → primitive ($color-navy: #0a1628) + semantic ($color-bg-primary)
  - 폰트 → $font-pretendard, $font-size-md: 16px
  - 간격 → $space-sm: 8px, $space-md: 16px

스타일 등록 (BLOCKING):
  Grep "{feature}/index.scss" → 이미 등록되어 있으면 건너뜀.
  없으면 프로젝트 방식에 맞게 등록.
```

### 3-1. 섹션 조립 프로세스

```
각 섹션에 대해:

1. 정답 확인 — 섹션 스크린샷을 Read로 본다
   /tmp/{feature}/sections/{section}.png
   → "이 화면처럼 만들어야 한다"

2. 재료 확인 — 이 섹션에 필요한 재료 목록 확인
   - 이미지: /tmp/{feature}/images/ 에서 해당 파일들
   - CSS 수치: tree.json에서 해당 노드의 정확한 값
   - 텍스트: TEXT 노드의 characters

3. Phase 1 컴포넌트에 디자인 입히기
   a. 이미지 복사: images/ → static/images/{feature}/
   b. template 업데이트:
      - Phase 1의 기능 요소(v-for, @click, v-if, $emit) 보존
      - 스크린샷을 보고 시각 구조에 맞게 HTML 재구성
      - Figma 레이어 구조를 HTML로 변환하지 않음 (시각 기반)
      - 재료함의 정확한 이미지 경로 사용
      - 재료함의 정확한 텍스트 사용
   c. script 보존:
      - Phase 1의 JSDoc, 인터페이스, 핸들러 유지
   d. SCSS 작성: 재료함의 정확한 CSS 수치 사용 (scaleFactor 적용)
      - layout/_{section}.scss ← 포지션, 사이즈, 플렉스
      - components/_{section}.scss ← 폰트, 색상, 보더
      - _tokens.scss에 새 토큰 추가

4. 즉시 검증 — 스크린샷과 비교
   - 이미지 빠진 거 없나?
   - 텍스트 빠진 거 없나?
   - 레이아웃 구조가 스크린샷과 맞나?
   - Phase 1의 기능 요소가 보존되었나?
```

### 3-2. 코드 작성 규칙

```
컴포넌트 (Vue 예시):
  <template>
    스크린샷에서 보이는 시각 구조대로 작성.
    Figma 레이어 구조 무시.
    Phase 1의 기능 요소(v-for, @click, v-if) 보존.
    시맨틱 HTML 사용 (<section>, <h2>, <ul>, <button>).
    이미지 경로: /images/{feature}/파일명.png
    텍스트: tree.json의 TEXT 노드 characters 값 그대로.

  <script setup>
    Phase 1의 JSDoc + 인터페이스 + 핸들러 보존.
    새로운 데이터/상태 추가 시 기존과 병합.

  <style> 블록 없음 — 외부 SCSS만.

SCSS (vibe.figma.convert 참조):
  layout/ → position, display, flex, width, height, padding, gap
  components/ → font, color, border, shadow, opacity
  모든 수치는 재료함의 정확한 값 × scaleFactor.
  추정 금지 — 값이 없으면 tree.json에서 다시 찾는다.
```

### 반응형 (추가 URL)

```
완료 후 질문: "다음 브레이크포인트 디자인 URL을 입력해주세요. (없으면 '없음')"

URL 있으면:
  1. 새 URL에서 재료 확보 (Phase 1 반복)
  2. 새 스크린샷과 기존 코드 비교
  3. @media (min-width: $bp-desktop) 오버라이드만 추가
  4. 기존 모바일 코드 삭제 금지
```

---

## Phase 4: 검증 루프

**Puppeteer + CDP로 실제 렌더링 결과를 확인하며 자동 수정한다.**
**사람이 브라우저 보면서 고치는 것과 동일한 루프.**
**인프라: `src/infra/lib/browser/` (범용 UI 검증 도구)**

```
자동 반복: P1=0 될 때까지. 최대 3라운드.
```

### 4-0. 환경 준비

```
1. dev 서버 시작:
   npm run dev (또는 프로젝트 dev 명령)
   → localhost:3000 (또는 해당 포트) 확인

2. Puppeteer 브라우저 시작:
   import { launchBrowser, openPage } from 'src/infra/lib/browser'
   const browser = await launchBrowser({ headless: true })
   const page = await openPage(browser, 'http://localhost:3000/{feature}', {
     width: 480,   // 모바일 퍼스트 (또는 타겟 뷰포트)
     height: 960,
   })
```

### 4-1. 렌더링 스크린샷 vs Figma 스크린샷

```
import { captureScreenshot, compareScreenshots } from 'src/infra/lib/browser'

각 섹션에 대해:
  1. 렌더링 결과 스크린샷 캡처:
     await captureScreenshot(page, {
       outPath: '/tmp/{feature}/rendered-{section}.png',
       selector: '.{section}Section',   // Phase 1에서 만든 클래스
     })

  2. Figma 원본과 픽셀 비교:
     const diff = await compareScreenshots(
       '/tmp/{feature}/sections/{section}.png',    // Figma 원본
       '/tmp/{feature}/rendered-{section}.png',    // 렌더링 결과
       '/tmp/{feature}/diff-{section}.png',        // 차이 시각화
     )

  3. diff 이미지를 Read로 확인:
     → 빨간색 영역 = 차이 나는 부분
     → diffRatio > 0.1 이면 P1 이슈
```

### 4-2. CSS 수치 정밀 비교

```
import { getComputedStyles, compareStyles, diffsToIssues } from 'src/infra/lib/browser'

각 섹션의 주요 요소에 대해:
  1. 렌더링된 computed CSS 추출:
     const actual = await getComputedStyles(page, '.heroTitle', [
       'font-size', 'color', 'width', 'height', 'padding', 'margin',
       'background-color', 'border-radius', 'gap',
     ])

  2. Figma 재료함의 기대값과 비교:
     // tree.json에서 해당 노드의 CSS 수치 (scaleFactor 적용 후)
     const expected = { 'font-size': '16px', 'color': '#ffffff', 'width': '465px' }
     const diffs = compareStyles(expected, actual)

  3. 차이 → 이슈 변환:
     const issues = diffsToIssues(diffs)
     → delta > 4px: P1 (레이아웃 영향)
     → delta ≤ 4px: P2 (미세 차이)
```

### 4-3. 이미지·텍스트 누락 체크

```
import { extractImages, extractTextContent } from 'src/infra/lib/browser'

1. 이미지 로드 상태 확인:
   const images = await extractImages(page)
   images.filter(img => !img.loaded)
   → 로드 실패 이미지 = P1 (이미지 누락)
   → src="" 이미지 = P1 (빈 경로)

2. 텍스트 콘텐츠 확인:
   const texts = await extractTextContent(page)
   → 재료함의 TEXT 노드 characters와 대조
   → 누락된 텍스트 = P1
```

### 4-4. 자동 수정 루프

```
라운드 1~3:
  1. 4-1 ~ 4-3 실행 → 이슈 목록 수집
  2. P1 이슈 우선 수정:
     - 이미지 누락 → 이미지 경로 확인, static/ 에 파일 존재 확인
     - 레이아웃 다름 → 스크린샷 diff 이미지 + computed CSS로 원인 파악
     - 텍스트 누락 → 재료함의 정확한 텍스트 삽입
     - CSS 수치 틀림 → 재료함(tree.json)의 정확한 값으로 교체
     ⚠️ 추정으로 수정하지 않는다. 반드시 재료함 참조.
  3. 수정 후 페이지 리로드 → 다시 캡처 → 비교
  4. P1=0 이면 종료

라운드 종료 조건:
  - P1=0: 성공 → 브라우저 종료, 결과 보고
  - 3라운드 후 P1 남음: TODO 목록으로 사용자에게 보고
  - 같은 이슈가 반복: 해당 이슈 스킵, 다음 이슈로

결과 보고:
  - 수정한 파일 목록
  - 남은 P2 이슈 목록 (선택적 수정)
  - 최종 diff 스크린샷 경로
```

### 4-5. 반응형 검증 (추가 뷰포트)

```
모바일 검증 완료 후, 추가 브레이크포인트가 있으면:

  await page.setViewport({ width: 1920, height: 1080 })
  await page.reload({ waitUntil: 'networkidle0' })

  → 데스크탑 Figma 스크린샷과 동일한 4-1 ~ 4-4 루프 반복
```

### 4-6. 브라우저 정리

```
import { closeBrowser } from 'src/infra/lib/browser'

검증 완료 후:
  await closeBrowser()
  dev 서버 종료 (필요 시)
```
