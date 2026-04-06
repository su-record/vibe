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
  → Phase 1: 재료 확보 (Figma API → 스크린샷 + 이미지 + CSS + 트리 + 텍스트)
  → Phase 2: 시각 분석 (스크린샷 보고 섹션 분할 + 컴포넌트 설계)
  → Phase 3: 퍼즐 조립 (스크린샷 = 정답, 재료 = 조각 → 코드 생성)
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

## Phase 1: 재료 확보

입력: 디자인 URL + 스토리보드 URL (선택)

### 1-1. 디자인 재료 추출

```
URL에서 fileKey, nodeId 추출

1단계 — 전체 스크린샷 (정답 사진):
  node "[FIGMA_SCRIPT]" screenshot {fileKey} {nodeId} --out=/tmp/{feature}/full-screenshot.png

2단계 — 전체 트리 + CSS (재료 데이터):
  node "[FIGMA_SCRIPT]" tree {fileKey} {nodeId} --depth=10
  → /tmp/{feature}/tree.json 에 저장

3단계 — 전체 이미지 다운로드 (재료 에셋):
  node "[FIGMA_SCRIPT]" images {fileKey} {nodeId} --out=/tmp/{feature}/images/ --depth=10
  → 모든 이미지 에셋 확보. 누락 0건, 0byte 0건.

4단계 — 섹션별 스크린샷 (부분 정답):
  트리의 1depth 자식 프레임 각각:
    node "[FIGMA_SCRIPT]" screenshot {fileKey} {child.nodeId} --out=/tmp/{feature}/{child.name}.png
```

### 1-2. 스토리보드 재료 추출 (선택)

```
사용자에게 질문: "스토리보드 URL이 있으면 입력해주세요. (없으면 '없음')"

"없음" → 건너뜀

URL 있으면:
  node "[FIGMA_SCRIPT]" tree {fileKey} {nodeId} --depth=2
  → 프레임 분류:
    SPEC   — "기능 정의서", "정책" → 기능 요구사항 텍스트 추출
    CONFIG — "해상도", "브라우저" → 스케일 팩터 계산
    SHARED — "공통", "GNB", "Footer", "Popup" → 공통 컴포넌트 목록
    PAGE   — "화면설계", "메인 -" → 섹션별 인터랙션 스펙
```

### 1-3. 재료함 정리

```
Phase 1 완료 시 /tmp/{feature}/ 에 다음이 준비되어야 함:

/tmp/{feature}/
├── full-screenshot.png          ← 전체 정답 사진
├── tree.json                    ← 노드 트리 + CSS 수치
├── images/                      ← 모든 이미지 에셋
│   ├── hero-bg.png
│   ├── hero-title.png
│   ├── card-item-1.png
│   └── ...
├── sections/                    ← 섹션별 정답 사진
│   ├── hero.png
│   ├── daily-checkin.png
│   ├── playtime-mission.png
│   └── ...
└── spec.md (선택)               ← 스토리보드에서 추출한 기능 정의

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

## Phase 2: 시각 분석

**스크린샷을 보고** 무엇을 만들어야 하는지 파악한다.
Figma 트리는 참고만 한다 — HTML 구조를 결정하는 건 시각 분석이다.

### 2-1. 전체 스크린샷 → 섹션 분할

```
full-screenshot.png를 Read로 확인한다.

시각적으로 구분되는 영역을 파악:
  "히어로 배경 + 타이틀 + CTA"
  "일일 출석 카드 그리드"
  "플레이타임 미션 리스트"
  "보상 교환소"
  "푸터"

각 영역 = 1 섹션 = 1 컴포넌트.
섹션별 screenshot(/tmp/{feature}/sections/*.png)과 대조하여 확인.

tree.json에서 해당 영역의 텍스트·이미지 목록을 매핑:
  섹션 "히어로" → images: [hero-bg.png, hero-title.png], texts: ["겨울 이벤트", "12.1~12.31"]
```

### 2-2. 컴포넌트 설계

```
각 섹션에 대해:

1. 시각적 역할 판단 (스크린샷 기반):
   - "전면 배경 위에 텍스트" → 히어로 패턴
   - "카드 N개 반복" → 그리드/리스트 패턴
   - "탭 + 콘텐츠" → 탭 패턴
   - "버튼 + 상태 변화" → 인터랙티브 패턴

2. HTML 구조 결정 (시각 기반, 트리 구조 아님):
   - 스크린샷에서 보이는 대로 시맨틱 HTML 설계
   - <section>, <h2>, <ul>, <button> 등 의미에 맞게
   - Figma 레이어 그룹핑은 무시

3. 필요한 재료 매핑:
   - 이 섹션에 쓸 이미지 목록
   - 이 섹션의 색상·폰트·간격 (tree.json에서)
   - 이 섹션의 텍스트 콘텐츠

4. 스토리보드 기능 매핑 (있으면):
   - 인터랙션 스펙, 상태 정의, API 연동 포인트
```

### 2-3. SCSS 구조 설계

```
SCSS 파일 생성:
  styles/{feature}/index.scss      ← @import 진입점
  styles/{feature}/_tokens.scss    ← 재료함에서 추출한 디자인 토큰
  styles/{feature}/_mixins.scss    ← breakpoint mixin
  styles/{feature}/_base.scss      ← 루트 클래스
  styles/{feature}/layout/         ← 섹션별 레이아웃
  styles/{feature}/components/     ← 섹션별 스타일

토큰 추출 (tree.json의 CSS 수치에서):
  - 색상 → primitive ($color-navy: #0a1628) + semantic ($color-bg-primary)
  - 폰트 → $font-pretendard, $font-size-md: 16px
  - 간격 → $space-sm: 8px, $space-md: 16px

스타일 등록 (BLOCKING):
  Grep "{feature}/index.scss" → 이미 등록되어 있으면 건너뜀.
  없으면 프로젝트 방식에 맞게 등록.
```

---

## Phase 3: 퍼즐 조립

**섹션별로 스크린샷을 보면서 코드를 작성한다.**
**첫 섹션(Hero) 단독 완료 후 나머지 섹션 병렬 진행.**

### 섹션 조립 프로세스

```
각 섹션에 대해:

1. 정답 확인 — 섹션 스크린샷을 Read로 본다
   → "이 화면을 만들어야 한다"

2. 재료 확인 — 이 섹션에 매핑된 재료 목록 확인
   - 이미지: /tmp/{feature}/images/ 에서 해당 파일들
   - CSS 수치: tree.json에서 해당 노드의 정확한 값
   - 텍스트: TEXT 노드의 characters

3. 코드 작성 — 스크린샷처럼 보이도록 코드 생성
   a. 이미지 복사: images/ → static/images/{feature}/
   b. 컴포넌트 작성: 스크린샷의 시각 구조대로 HTML 생성
      - Figma 트리를 HTML로 변환하지 않음
      - 스크린샷에서 보이는 레이아웃을 직접 구현
      - 재료함의 정확한 이미지 경로 사용
      - 재료함의 정확한 텍스트 사용
   c. SCSS 작성: 재료함의 정확한 CSS 수치 사용 (scaleFactor 적용)
      - layout/_{section}.scss ← 포지션, 사이즈, 플렉스
      - components/_{section}.scss ← 폰트, 색상, 보더
      - _tokens.scss에 새 토큰 추가

4. 즉시 검증 — 작성한 코드를 다시 스크린샷과 비교
   - 이미지 빠진 거 없나?
   - 텍스트 빠진 거 없나?
   - 레이아웃 구조가 스크린샷과 맞나?
```

### 코드 작성 규칙

```
컴포넌트 (Vue 예시):
  <template>
    스크린샷에서 보이는 시각 구조대로 작성.
    Figma 레이어 구조 무시.
    시맨틱 HTML 사용 (<section>, <h2>, <ul>, <button>).
    이미지 경로: /images/{feature}/파일명.png
    텍스트: tree.json의 TEXT 노드 characters 값 그대로.

  <script setup>
    스토리보드 기능 정의가 있으면 JSDoc으로 포함.
    TypeScript 인터페이스.
    목 데이터 + 이벤트 핸들러 stub.

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

```
자동 반복: P1=0 될 때까지.

1. 빌드 체크:
   npm run build (또는 프로젝트 빌드 명령)
   → 에러 있으면 수정

2. Grep 체크:
   □ "<style" in components/{feature}/ → 0건
   □ 'src=""' in components/{feature}/ → 0건
   □ Glob: images/{feature}/ → 이미지 파일 존재, 0byte 없음

3. 시각 검증:
   각 섹션의 Figma 스크린샷을 다시 Read:
     /tmp/{feature}/sections/{section}.png

   현재 코드를 읽고 스크린샷과 비교:
     P1 (필수 수정):
       - 이미지 누락 또는 잘못된 이미지
       - 레이아웃 구조 다름 (가로↔세로, 정렬 방향)
       - 텍스트 누락 또는 잘못된 텍스트
       - 배경 없음 또는 잘못된 배경
     P2 (권장):
       - 미세 간격 차이
       - 미세 색상 차이
       - 폰트 크기 미세 차이

4. P1 수정 → 재검증 (최대 3라운드):
   수정할 때 반드시 재료함(tree.json, images/)의 정확한 값 참조.
   추정으로 수정하지 않는다.

5. 3라운드 후에도 P1 남아있으면:
   남은 이슈를 TODO 목록으로 사용자에게 보고.
```
