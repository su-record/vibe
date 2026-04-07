---
name: vibe.figma
description: Figma design to code — 트리 기반 구조적 코드 생성
triggers: []
tier: standard
---

# vibe.figma — Structural Code Generation

## 핵심 원칙

```
Figma 트리가 코드의 원천이다. 스크린샷은 검증용이다.

✅ Figma Auto Layout → CSS Flexbox 1:1 기계적 매핑
✅ Figma CSS 속성 → SCSS 직접 변환 (추정 없음)
✅ Claude는 시맨틱 판단만: 태그 선택, 컴포넌트 분리, 인터랙션
✅ 스크린샷은 생성이 아닌 검증에만 사용
```

## 금지 사항

```
❌ 스크린샷을 보고 CSS 추정 (범용 LLM의 약점)
❌ Figma 레이어를 무분별하게 div soup로 변환
❌ CSS로 이미지 재현 (gradient/shape으로 그림 그리기)
❌ 이미지 다운로드 없이 코드 생성 진행
❌ placeholder / 빈 src="" 남기기
❌ tree.json에 없는 CSS 값을 추정하여 작성
❌ 컴포넌트 파일 안에 <style> 블록 / 인라인 style=""
✅ tree.json의 CSS 속성을 SCSS에 직접 매핑
✅ 외부 SCSS 파일에만 스타일 작성
```

## 전체 플로우

```
/vibe.figma
  → Phase 0: Setup (스택 감지, 디렉토리 생성, 기존 자산 인덱싱)
  → Phase 1: Storyboard (스토리보드 → 레이아웃 + 컴포넌트 + 기능 정의)
  → Phase 2: 재료 확보 (디자인 URL → 트리 + 이미지 + 스크린샷)
  → Phase 3: 구조적 코드 생성 (트리 → HTML+SCSS 매핑 + 시맨틱 보강)
  → Phase 3.5: 컴파일 게이트 (tsc → build → dev 확인)
  → Phase 4: 시각 검증 루프 (렌더링 vs 스크린샷 비교 → 수정)
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

5. 기존 컴포넌트 스캔 + 인덱싱:
   - Glob "components/**/*.vue" or "components/**/*.tsx"
   - 재사용 가능한 컴포넌트 목록 수집 (GNB, Footer, Button 등)

   5-1. 컴포넌트 상세 인덱싱 (50개 이하 스캔):
     대상 파일 수집 (우선순위 순서, 합산 50개 이내):
       barrel file index.ts → components/ui/ → components/common/ → components/shared/ → 나머지
       각 디렉토리 내에서는 1-depth 파일만 (하위 재귀 탐색 안 함)

     각 파일에 대해 2단계 추출:
       a. Grep: defineProps|interface Props|<slot|@description|class=|className=
          → 시작 줄 번호 탐색
       b. Read: 시작줄 ~ +30줄 추출
          Vue/Svelte template+script 분리 파일: 첫 300줄 전체 Read
          barrel file (index.ts): 전체 Read

     추출 항목:
       - Props/Interface: defineProps<{...}> 또는 interface Props {...} 에서 prop 이름+타입
         ※ 외부 타입 참조 시 (defineProps<ButtonProps>()) → types 인덱스에서 교차 참조
       - Slots: <slot> 또는 {children} 패턴
       - 스타일 클래스: class="..." 또는 className={styles.xxx} 최상위 요소의 클래스명
       - 용도 힌트: JSDoc @description 또는 파일 첫 번째 주석

   5-2. 인덱스 결과 저장:
     저장 경로: /tmp/{feature}/component-index.json
       [
         { name: "BaseButton",
           path: "components/common/BaseButton.vue",
           props: [{ name: "label", type: "string" }, { name: "variant", type: "'primary'|'secondary'" }],
           slots: ["default"],
           classes: ["btn", "btn--primary"],
           description: "공통 버튼 컴포넌트" },
         ...
       ]

     컨텍스트 관리:
       - 컴포넌트 20개 이하: 전체 인덱스를 프롬프트에 포함
       - 컴포넌트 20개 초과: 이름+설명+축약 props(이름만, 타입 생략)만 포함
         매칭 후보 발견 시 해당 파일 Read로 상세 확인
       - classes 필드는 요약에서 제외 (매칭 시 파일 Read로 확인)

   5-3. Hooks/Types/Constants 인덱싱:
     추가 스캔 대상:
       - Composables/Hooks: composables/**/*.ts, hooks/**/*.ts
         → export 함수명 + 파라미터 + 반환 타입
       - 타입 정의: types/**/*.ts, types.ts
         → export interface/type 이름 + 최상위 필드
       - 상수: constants/**/*.ts
         → export const 이름 + 값 (또는 타입)

     저장: /tmp/{feature}/context-index.json (component-index와 별도)
     컨텍스트 관리:
       - 항목 30개 이하: 전체 인덱스를 프롬프트에 포함
       - 항목 30개 초과: 이름+핵심 시그니처만 요약, 상세 필요 시 파일 Read로 지연 조회

   타임아웃: 파일당 Read 최대 300줄, 전체 인덱싱 2분 이내 완료

6. 기존 디자인 토큰 스캔:

   SCSS 토큰:
     Glob: **/_variables.scss, **/_tokens.scss, **/_colors.scss, **/variables.scss
     → 패턴: $변수명: 값; 추출
     → 결과: { name: "$color-primary", value: "#3b82f6", source: "styles/_variables.scss" }

   CSS Variables:
     Glob: **/global.css, **/variables.css, **/root.css, **/app.css
     Grep: "--[a-zA-Z].*:" 패턴
     → 결과: { name: "--color-primary", value: "#3b82f6", source: "styles/global.css" }

   Tailwind:
     tailwind.config.{js,ts,mjs} 존재 시 Read
     → theme.colors, theme.extend.colors 에서 커스텀 색상 추출
     → theme.spacing, theme.fontSize 에서 커스텀 값 추출
     → Tailwind v4: global CSS에서 @theme 디렉티브 내 CSS variable도 스캔
     → 결과: { name: "blue-500", value: "#3b82f6", type: "tailwind", category: "color" }

   CSS-in-JS:
     Glob: **/theme.{ts,js}, **/tokens.{ts,js}, **/design-tokens.{ts,js}
     → export 객체에서 color/spacing/typography 키 추출

   통합 결과 → /tmp/{feature}/project-tokens.json:
     {
       colors: [{ name, value, source }],
       spacing: [{ name, value, source }],
       typography: [{ name, value, source }],
       other: [{ name, value, source }]
     }

   토큰 소스 우선순위 (복수 시스템 공존 시):
     Tailwind > CSS Variables > SCSS > CSS-in-JS

   성능: 100개 파일 기준 5초 이내 완료
   파싱 실패 시: 해당 파일 스킵 + 경고 로그 (전체 중단하지 않음)
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

### 1-2. 기능 스펙 문서 작성 (파일 생성 없음)

```
❌ Phase 1에서 코드 파일을 생성하지 않는다.
   → Phase 1 HTML 구조와 Phase 3 트리 매핑이 충돌하면 이중 작업
   → Phase 3에서 tree.json 기반으로 코드를 생성

✅ Phase 1의 출력물은 기능 스펙 문서 (텍스트):

1. 섹션 목록:
   | # | 섹션 이름 | Figma 프레임 name | 높이 | 설명 |
   |---|----------|------------------|------|------|
   | 1 | Hero | Hero | 1280px | 키비주얼 + 이벤트 정보 |
   | 2 | DailyCheckIn | Daily | 3604px | 출석 미션 |
   | 3 | PlayTime | Frame 633371 | 11363px | 플레이타임 미션 |

2. 각 섹션의 기능 정의:
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

3. 공통 컴포넌트 목록:
   → 프로젝트에 이미 있는 컴포넌트 (GNB, Footer 등)
   → 새로 만들 공통 컴포넌트

4. TypeScript 인터페이스 초안:
   interface RewardItem { id: string; name: string; tokenAmount: number; status: 'locked'|'available'|'claimed' }
```

### 1-3. 검증

```
Phase 1 완료 조건:
  □ 모든 섹션이 목록에 포함되어 있다
  □ 각 섹션에 [기능 정의] + [인터랙션] + [상태] 가 정의되어 있다
  □ TypeScript 인터페이스 초안이 작성되어 있다
  □ 공통 컴포넌트가 식별되어 있다
  □ 파일을 하나도 생성하지 않았다

Phase 3에서 이 스펙 + tree.json을 합쳐서 코드를 생성한다.
```

---

## Phase 2: 재료 확보

Phase 1 컴포넌트가 준비된 상태에서, 디자인 URL로 시각 재료를 수집한다.

사용자에게 질문한다:
- question: "디자인 Figma URL을 입력해주세요. 여러 페이지는 줄바꿈으로 구분."
- options 제공 금지 — 자유 텍스트 입력만 허용

### 멀티 프레임 URL 검증

```
URL 유효성 검증:
  - 모든 URL에서 fileKey 추출 → 동일한 fileKey인지 확인
  - 서로 다른 fileKey 발견 시 에러: "멀티 프레임은 동일 Figma 파일 내 다른 프레임만 지원합니다"
  - node-id 파라미터 누락 시 해당 URL 에러 보고
  - 최대 5개 URL까지 지원

URL 개수에 따른 처리:
  1개: 기존 방식 (변경 없음, 아래 2-1 그대로)
  2개 이상: 멀티 프레임 모드 활성화 (2-1-multi 참조)
```

### 2-1. 디자인 재료 추출 (단일 URL)

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

3.5단계 — 아이템/아이콘 노드 렌더링 (추가 시각 재료):
  tree.json에서 INSTANCE/COMPONENT 타입 중 아이템 후보를 식별:
    - name에 "item", "icon", "reward", "token", "coin", "badge" 포함
    - 크기 50~300px 범위의 독립 요소
    - fill 이미지가 없지만 시각적으로 의미 있는 노드
  해당 노드를 개별 렌더링:
    node "[FIGMA_SCRIPT]" images {fileKey} {nodeId} --render --nodeIds={id1},{id2},... --out=/tmp/{feature}/images/
  → 이미지 fill이 아닌 벡터/인스턴스 에셋도 PNG로 확보
  → Phase 3에서 목 데이터의 image 경로에 연결

4단계 — 섹션별 스크린샷 (부분 정답):
  트리의 1depth 자식 프레임 각각:
    node "[FIGMA_SCRIPT]" screenshot {fileKey} {child.nodeId} --out=/tmp/{feature}/sections/{child.name}.png
```

### 2-1-multi. 멀티 프레임 재료 확보 (2개 이상 URL)

```
각 URL에 대해 순차 추출 (Figma API rate limit: 요청 간 500ms 간격):
  URL 1 → /tmp/{feature}/frame-1/ (full-screenshot, tree, images, sections)
  URL 2 → /tmp/{feature}/frame-2/ (URL 1 완료 후 500ms 대기)
  URL 3 → /tmp/{feature}/frame-3/ (URL 2 완료 후 500ms 대기)
  ※ 추출 완료 후 후처리(섹션 분할 등)는 병렬 가능

부분 실패 처리:
  - 개별 URL 추출 실패 시 해당 frame만 건너뛰고 나머지 진행
  - 실패한 frame은 사용자에게 즉시 보고: "frame-{N} 추출 실패: {에러 사유}" (API 에러, 권한 부족, 잘못된 nodeId 등)
  - 성공한 frame ≥ 2: Phase 2.5 계속 진행
  - 정확히 1개만 성공: 단일 프레임 모드로 폴백 (Phase 2.5 스킵)
  - 0개 성공: 전체 실패 보고

결과:
  /tmp/{feature}/
  ├── frame-1/           ← 메인 페이지
  │   ├── full-screenshot.png
  │   ├── tree.json
  │   ├── images/
  │   └── sections/
  ├── frame-2/           ← 서브 페이지 1
  │   └── ...
  ├── frame-3/           ← 서브 페이지 2
  │   └── ...
  └── shared/            ← 공통 분석 결과 (Phase 2.5에서 생성)
```

### 2-2. 재료함 정리

```
Phase 2 완료 시 /tmp/{feature}/ 에 다음이 준비되어야 함:

단일 URL:
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

멀티 URL: 위 2-1-multi 결과 구조 참조

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

## Phase 2.5: 공통 패턴 분석 (멀티 프레임 전용)

**URL 2개 이상일 때만 실행. 단일 URL이면 Phase 3으로 건너뜀.**
**프레임 간 공통 요소를 식별하여 공유 컴포넌트로 추출한다.**

```
1. 시각 비교 — 각 프레임의 스크린샷을 순차 Read:
   - frame-1/full-screenshot.png → frame-2/full-screenshot.png → ...
   - 시각적으로 반복되는 요소 식별:
     상단 영역 (GNB/Header), 하단 영역 (Footer),
     카드 패턴, 버튼 스타일, 섹션 레이아웃

2. 구조 비교 — 각 tree.json의 1depth 자식 비교:
   - 동일한 name 또는 prefix 일치 (예: "GNB", "Header", "Footer", "Nav")
   - 동일한 size (width와 height 모두 ±10% 이내): 같은 컴포넌트 후보
   - 동일한 CSS 패턴: 같은 스타일 사용 (색상, 폰트, 레이아웃)

3. 공통 컴포넌트 후보 목록:
   shared-components:
     - name: GNB
       frames: [frame-1, frame-2, frame-3]
       consistency: 100% (모든 프레임에서 동일)
       action: 공유 컴포넌트로 1회만 생성
     - name: Footer
       frames: [frame-1, frame-3]
       consistency: 67% (2/3 프레임)
       action: 공유 컴포넌트 + frame-2는 다른 Footer
     - name: CardItem
       frames: [frame-1, frame-2]
       size-match: 95%
       action: 공유 컴포넌트 (props로 변형)

4. 공통 토큰 추출:
   - 모든 프레임의 색상 팔레트 합집합 → 공유 _tokens.scss
   - 모든 프레임의 폰트 목록 합집합
   - 모든 프레임의 간격 패턴 합집합
   → 프레임별 고유 값만 프레임 로컬 토큰으로 분리
```

---

## Phase 3: 퍼즐 조립

**Phase 1에서 만든 컴포넌트에 Phase 2의 재료로 디자인을 입힌다.**
**스크린샷을 보면서 퍼즐을 맞추듯 조립한다.**
**첫 섹션(Hero) 단독 완료 후 나머지 섹션 병렬 진행.**

**멀티 프레임 모드 시 조립 순서 변경:**
```
멀티 프레임 Phase 3 순서:

1단계: 공유 컴포넌트 먼저 생성
  - shared-components 목록의 컴포넌트를 components/shared/에 생성
  - 가장 일관적인 프레임(shared-components 매칭 수가 가장 많은 프레임) 기준으로 조립
  - 프레임별 변형은 props로 처리

2단계: 프레임별 고유 섹션 조립
  - frame-1 고유 섹션: 공유 컴포넌트 import + 고유 섹션 신규 생성
  - frame-2 고유 섹션: 동일
  - 각 프레임의 페이지 파일에서 공유 + 고유 컴포넌트 배치

3단계: 스타일 구조
  styles/{feature}/
  ├── _tokens.scss          ← 공유 토큰 (합집합)
  ├── shared/               ← 공유 컴포넌트 스타일
  │   ├── layout/_gnb.scss
  │   └── components/_gnb.scss
  ├── frame-1/              ← 메인 고유 스타일
  │   ├── layout/
  │   └── components/
  └── frame-2/

단일 URL: 기존 방식 그대로 (위 멀티 프레임 순서 무시)
```

### 3-0. SCSS Setup + 등록 (첫 섹션 전)

```
Phase 1에서 생성한 빈 SCSS 파일에 기본 내용 Write:
  styles/{feature}/index.scss      ← @import 진입점
  styles/{feature}/_tokens.scss    ← 재료함에서 추출한 디자인 토큰
  styles/{feature}/_mixins.scss    ← breakpoint mixin
  styles/{feature}/_base.scss      ← 루트 클래스

토큰 매핑 (기존 토큰 우선 사용):
  1. /tmp/{feature}/project-tokens.json 을 Read로 로드
  2. Figma 재료함의 각 값에 대해 project-tokens에서 동일 값 검색:
     - 색상: hex 정규화 후 완전 일치 (Figma RGBA 0-1 → hex, 3자리→6자리, 대소문자 무시)
       ※ alpha < 1: 8자리 hex (#RRGGBBAA) 또는 rgba() 함수로 변환
     - 간격: px 값 완전 일치 (rem→px: 1rem=16px)
     - 폰트: family 이름 포함 매칭
  3. 매칭됨 → 기존 토큰 참조:
     - SCSS: @use 'path' 로 기존 파일 import, $변수명 사용
     - Tailwind: 해당 유틸리티 클래스 사용 (bg-blue-500)
     - CSS Variables: var(--color-primary) 사용
  4. 매칭 안 됨 → 새 토큰 생성 (기존 방식)

  _tokens.scss 구조:
    // ─── 기존 토큰 참조 ────────────────────
    @use '../../styles/variables' as v;

    // ─── 매핑 (기존 토큰 → 피처 시맨틱) ────
    $color-bg-primary: v.$color-navy;          // 기존 재사용
    $color-text-primary: v.$color-white;       // 기존 재사용

    // ─── 새 토큰 (매칭 안 된 값만) ─────────
    $color-accent-gold: #ffd700;               // 새 값
    $space-section-gap: 42px;                  // 새 값

  매핑 결과 보고: "토큰 매핑: 12/18 매칭 (67%), 6개 새 토큰 생성"

  기존 토큰 파일 수정 금지 — 참조만 함
  같은 값의 토큰 중복 생성 금지
  새 토큰은 피처 스코프 네이밍 ($feature-color-xxx)

  project-tokens.json 없는 경우 (기존 토큰 없음):
    기존 방식으로 전체 생성:
    - 색상 → primitive ($color-navy: #0a1628) + semantic ($color-bg-primary)
    - 폰트 → $font-pretendard, $font-size-md: 16px
    - 간격 → $space-sm: 8px, $space-md: 16px

스타일 등록 (BLOCKING):
  Grep "{feature}/index.scss" → 이미 등록되어 있으면 건너뜀.
  없으면 프로젝트 방식에 맞게 등록.
```

### 3-0.5. 컴포넌트 매칭 (각 섹션 조립 전)

```
/tmp/{feature}/component-index.json 을 Read로 로드한다.

각 섹션 스크린샷 분석 후, 기존 컴포넌트 매칭:

1. 스크린샷에서 식별된 UI 요소를 component-index와 대조
2. 매칭 판정 기준:
   - 필수: name/role 유사성 (시각적 역할 일치)
     버튼 → BaseButton, 네비게이션 → GNB, 카드 → Card, 모달 → Modal
   - 보조: props 호환성 (필요 props가 기존 컴포넌트에 존재)
   - 보조: slots 호환성 (필요 slot이 존재)
   - 불일치: props/slots 50% 미만 호환이면 매칭 거부 → 새로 생성
3. 매칭된 컴포넌트: import하여 props 전달 (내부 수정 금지)
4. 매칭 안 됨: 새로 생성 (강제 재사용 금지)

재사용 시 스타일 충돌 방지:
  ✅ 기존 컴포넌트 import하여 사용
  ✅ props로 variant/size 등 커스터마이즈
  ✅ 래퍼 클래스로 position/size만 오버라이드
  ❌ 기존 컴포넌트 내부 스타일 수정 금지
  ❌ 90% 유사한데 새로 만들기 금지
```

### 3-1. 트리 기반 구조적 코드 생성

```
각 섹션에 대해 (vibe.figma.convert 참조):

1. 트리 구조 읽기 — tree.json에서 해당 섹션 노드를 Read
   → Auto Layout 속성(flex, gap, padding)이 코드의 기반
   → 스크린샷은 검증용으로만 참조

2. 기계적 매핑 (추정 없음):
   a. 이미지 복사: images/ → static/images/{feature}/
   b. 노드 → HTML 매핑:
      - Auto Layout 있음 → <div> + flex (direction/gap/padding 직접)
      - Auto Layout 없음 → <div> + position:relative (자식 absolute)
      - TEXT 노드 → <span> (Claude가 h2/p/button으로 승격)
      - imageRef 있음 → <img src="다운로드된 파일">
      - 반복 패턴 (동일 구조 3+) → v-for
   c. CSS 직접 매핑:
      - node.css의 모든 속성을 SCSS에 1:1 매핑
      - scaleFactor 적용 (px 값만)
      - tree.json에 없는 CSS 값은 작성하지 않음
   d. Phase 1의 JSDoc, 인터페이스, 핸들러 보존

3. Claude 시맨틱 보강:
   - div → section/h2/p/button 태그 승격
   - 컴포넌트 분리 + props 설계
   - 접근성 (alt, aria)
   - 인터랙션 (클릭, 상태)

4. 자가 검증:
   - template 클래스 ↔ SCSS 클래스 1:1 일치
   - 모든 img src가 static/에 실제 존재
   - Auto Layout 노드 → SCSS에 flex 속성 존재
   - 스크린샷과 비교 (시각 확인)
```

### 3-2. 코드 작성 규칙

```
컴포넌트 (Vue 예시):
  <template>
    tree.json의 Auto Layout 구조를 HTML flex 레이아웃으로 직접 매핑.
    Claude가 시맨틱 태그로 승격 (div → section/h2/p/button).
    Phase 1의 기능 요소(v-for, @click, v-if) 보존.
    이미지 경로: /images/{feature}/파일명.png (실제 파일 존재 확인)
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

## Phase 3.5: 컴파일 게이트

**Phase 3 퍼즐 조립 완료 후, 브라우저 검증 전에 컴파일 성공을 보장한다.**
**컴파일 에러는 스킵 불가 — 반드시 수정 또는 사용자 보고.**
**Phase 3.5 실패 시 Phase 4 진행 불가 (hard gate).**

```
자동 반복: 컴파일 성공까지. 최대 3라운드.
```

### 3.5-0. 베이스라인 캡처 (Phase 3 변경 전)

```
Phase 3 시작 전에 기존 프로젝트의 에러를 캡처:
  1. 타입 체크 베이스라인: (3.5-1에서 선택한 동일 명령 사용) > /tmp/{feature}/baseline-typecheck.txt 2>&1
  2. 빌드 베이스라인: npm run build > /tmp/{feature}/baseline-build.txt 2>&1

Phase 3.5에서는 baseline에 없는 **새로 발생한 에러만** 수정 대상.
baseline에 존재하던 에러는 무시하고 별도 보고 ("기존 에러 {N}개 유지").
vibe.figma가 생성/수정한 파일 외의 에러는 자동 수정 금지.
```

### 3.5-1. TypeScript 컴파일 체크

```
1. 프로젝트 타입 체커 감지 → 실행:
   - package.json scripts에 type-check 또는 typecheck 존재 → npm run type-check 사용
   - vue-tsc 설치 확인 (Vue 프로젝트) → npx vue-tsc --noEmit 2>&1
   - svelte-check 설치 확인 (Svelte 프로젝트) → npx svelte-check 2>&1
   - 위 해당 없음 → fallback: npx tsc --noEmit 2>&1
   → 에러 0개: PASS → 다음 단계
   → 에러 있음: 에러 메시지 파싱 → 자동 수정

2. 에러 파싱:
   각 에러에서 추출: 파일 경로, 줄 번호, 에러 코드, 메시지
   예: "src/components/Hero.tsx(15,3): error TS2322: Type 'string' is not assignable to type 'number'"

3. 자동 수정 (에러 유형별):
   - TS2322 (타입 불일치): prop 타입을 올바르게 수정
   - TS2304 (이름 없음): import 추가
   - TS2339 (프로퍼티 없음): interface에 프로퍼티 추가
   - TS7006 (암시적 any): 타입 어노테이션 추가
   - 기타: Read로 해당 파일+줄 확인 → 컨텍스트 기반 수정
```

### 3.5-2. 빌드 체크

```
1. npm run build 실행:
   Bash: npm run build 2>&1
   → 성공: PASS → 다음 단계
   → 실패: 에러 메시지 파싱 → 자동 수정
   → 타임아웃: 최대 120초 (초과 시 해당 라운드 실패 처리)

2. 일반적 빌드 에러 처리:
   - SCSS 컴파일 에러: 변수명/import 오류 수정
   - Module not found: import 경로 수정 (.js 확장자 등)
   - ESLint 에러 (--max-warnings 초과): 자동 수정 가능한 것 처리
```

### 3.5-3. dev 서버 시작 확인

```
1. dev 서버 시작 + PID 캡처:
   Bash: npm run dev & echo $!  → DEV_PID 저장
   → localhost 포트 자동 감지: npm run dev stdout에서 localhost:\d+ 또는 port \d+ 파싱
     감지 실패 시 기본값 3000, 5173, 4173 순서 시도
   → 포트 폴링 (3초 간격, 최대 30초 대기)
   → 성공: Phase 4 진행 (Phase 4 완료 후 정리)
   → 실패: kill $DEV_PID → 에러 로그 확인 → 수정 → 재시도

2. 프로세스 정리 규칙:
   - Phase 4 완료 또는 3라운드 실패 시 반드시 정리
   - 정리 순서: kill $DEV_PID → 3초 대기 → kill -9 $DEV_PID (응답 없으면)
   - lsof -i :{port} -t 로 포트 점유 프로세스 확인 후 추가 정리
     ※ spawned child process만 대상 — 관련 없는 프로세스 kill 금지
   - interrupt 시에도 cleanup 보장
```

### 3.5-4. 수정 루프

```
라운드 1~3:
  1. tsc → build → dev 순서로 체크
  2. 첫 번째 실패 단계의 에러 수정
  3. 수정 후 해당 단계부터 재체크
  4. 모든 단계 통과: Phase 4 진행

라운드 종료 조건:
  - 3라운드 후 실패: 에러 목록 + 시도한 수정을 사용자에게 보고
  - 같은 에러 반복: 해당 에러 스킵 불가 → 사용자 보고 (컴파일 에러는 스킵 불가)

컴파일 게이트 결과 보고:

  ✅ 통과:
    "Phase 3.5: 컴파일 게이트 PASS (라운드 {N})"
    - tsc: 0 errors
    - build: success
    - dev server: running on localhost:{port}

  ❌ 실패 (3라운드 후):
    "Phase 3.5: 컴파일 게이트 FAIL"
    - 남은 에러 목록 (파일, 줄, 메시지)
    - 시도한 수정 내역
    - 사용자 수동 수정 필요
    → Phase 4 진행하지 않음
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
   Phase 3.5에서 이미 시작된 dev 서버 사용 (재시작 불필요)
   → localhost:{port} 확인

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
  3. 수정 후 컴파일 재검증:
     Bash: npx tsc --noEmit 2>&1 (또는 3.5-1에서 선택한 타입 체커)
     → 시각 수정이 타입 에러를 유발하면 즉시 타입 에러 수정 후 진행
  4. 페이지 리로드 → 다시 캡처 → 비교
  5. P1=0 이면 종료

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
