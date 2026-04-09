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

## ⛔ 불변 규칙

```
1. screenshot으로 콘텐츠를 이미지화 금지
   ✅ BG 렌더링 (TEXT 자식 없는 배경), 벡터 글자 GROUP, 섹션 스크린샷(검증용)
   ❌ TEXT 자식 프레임, INSTANCE 반복, 버튼/가격, 섹션 통째 렌더링

2. BG는 CSS background-image만. <img> 태그 금지.

3. Phase 4 코드 생성 중 새 screenshot 호출 금지.
   Phase 2 재료만 사용. 복잡해도 HTML+CSS로 구현.
```

## 전체 플로우

```
입력: 모든 URL을 한번에 받는다
  Storyboard: figma.com/...?node-id=aaa (있으면)
  MO Design:  figma.com/...?node-id=xxx
  PC Design:  figma.com/...?node-id=yyy (있으면)

→ Phase 0: Setup
→ Phase 1: 스토리보드 분석 → 기능 스펙 문서
→ Phase 2: 재료 확보 (→ vibe.figma.extract)
→ Phase 3: 리매핑 (MO↔PC 매칭 → remapped.json)
→ Phase 4: 순차 코드 생성 (→ vibe.figma.convert)
→ Phase 5: 컴파일 게이트
→ Phase 6: 시각 검증 루프

작업 디렉토리:
  /tmp/{feature}/
  ├── mo-main/tree.json, bg/, content/, sections/
  ├── pc-main/tree.json, bg/, content/, sections/
  └── remapped.json ← Phase 4의 유일한 입력

코드 출력: 프로젝트 디렉토리에 직접 배치
  components/{feature}/, styles/{feature}/
```

---

## Phase 0: Setup

```
1. 스택 감지: package.json → react/vue/svelte, next/nuxt, scss/tailwind
2. 피처명: Figma 파일명 → kebab-case
3. 디렉토리: components/{feature}/, public/images/{feature}/, styles/{feature}/
4. 컴포넌트 인덱싱 → /tmp/{feature}/component-index.json
   (50개 이하 스캔, props/slots/classes 추출, 2분 이내)
5. Hooks/Types/Constants → /tmp/{feature}/context-index.json
6. 디자인 토큰 스캔 → /tmp/{feature}/project-tokens.json
   (SCSS > CSS Variables > Tailwind > CSS-in-JS)
```

---

## Phase 1: 스토리보드 분석

```
사용자 입력: URL 또는 PDF/이미지를 줄바꿈으로 입력

URL 분류 (자동):
  fileKey 다름 → 스토리보드 vs 디자인
  ROOT name에 "MO" → 모바일, "PC" → 데스크탑

스토리보드 분석:
  depth=2로 프레임 수집 → name 패턴으로 분류
  SPEC(기능정의서) → CONFIG(해상도) → PAGE(메인 섹션) → SHARED(공통)
  PDF/이미지도 동일 구조 추출

❌ Phase 1에서 코드 파일 생성 금지

출력 (텍스트만):
  1. 섹션 목록 테이블 (이름, Figma name, 높이, 설명)
  2. 각 섹션 기능 정의 ([기능] + [인터랙션] + [상태])
  3. 공통 컴포넌트 목록
  4. TypeScript 인터페이스 초안
```

---

## Phase 2: 재료 확보 ← Research (병렬)

**→ vibe.figma.extract 스킬의 규칙을 따른다.**
**코디네이터 패턴: MO/PC 추출을 워커로 병렬 실행.**

```
# [FIGMA_SCRIPT] = ~/.vibe/hooks/scripts/figma-extract.js

MO/PC 동시 추출 (각각 독립 워커):
  워커-MO: screenshot → tree → images → 에셋 렌더링 → sections/
  워커-PC: screenshot → tree → images → 에셋 렌더링 → sections/
  → 두 워커의 결과가 모두 도달한 후 Phase 3 진행

단일 BP: 워커 1개로 순차 실행

멀티 프레임 (같은 BP, 다른 페이지):
  순차 추출 (500ms 간격), 부분 실패 허용
```

---

## Phase 3: 리매핑 ← Synthesis (순차, 리더 필수)

**MO + PC 있을 때만 실행. 단일 BP면 스킵.**
**코디네이터 패턴: 리더가 직접 MO↔PC 매칭. 워커 위임 금지.**
**리더가 두 tree를 모두 이해한 상태에서 diff를 추출해야 품질 보장.**

### MO↔PC 반응형 매칭

```
1. 섹션 매칭: 1depth name 기준 (완전일치 → prefix → 순서)
2. 노드 매칭: 재귀적 name 매칭 → CSS diff 추출
3. diff: 같은 값 유지, 다른 값만 @media 오버라이드

출력 → /tmp/{feature}/remapped.json:
  sections:
    - name: Hero
      mo: { nodeId, css, children }
      pcDiff: { css: { 차이만 }, children }
      images: { mo: 'bg/hero-bg.webp', pc: 'bg/hero-bg-pc.webp' }
```

### 멀티 프레임 (같은 BP, 다른 페이지)

```
공통 요소 식별 → 공유 컴포넌트 추출
공통 토큰 합집합 → 공유 _tokens.scss
```

---

## Phase 4: 순차 코드 생성 ← Implement (영역별)

**→ vibe.figma.convert 스킬의 규칙을 따른다.**
**코디네이터 패턴: 섹션 = 영역. 한 영역에 한 워커만. 충돌 방지.**

```
⛔ 병렬 금지. 한 섹션씩 순차:
  1. tree.json에서 섹션 노드 Read
  2. 이미지 vs HTML 판별 테이블 작성 (BLOCKING)
  3. 기계적 매핑 + Claude 시맨틱 보강
  4. 브라우저 확인 → OK → 다음 섹션

SCSS Setup (첫 섹션 전):
  index.scss, _tokens.scss, _mixins.scss, _base.scss
  토큰 매핑: project-tokens.json에서 기존 토큰 참조 → 매칭 안 되면 새 생성

컴포넌트 매칭 (각 섹션 전):
  component-index.json과 대조 → 매칭되면 import, 안 되면 새 생성

멀티 프레임 시:
  1단계: 공유 컴포넌트 먼저 → components/shared/
  2단계: 프레임별 고유 섹션
```

---

## Phase 5: 컴파일 게이트

```
최대 3라운드 자동 반복.

0. 베이스라인 캡처 (Phase 4 전): tsc + build 기존 에러 기록
   → Phase 5에서는 새 에러만 수정 대상

1. TypeScript: vue-tsc/svelte-check/tsc --noEmit
2. Build: npm run build (120초 타임아웃)
3. Dev 서버: npm run dev → 포트 감지 → 폴링

에러 시: 파싱 → 자동 수정 → 재체크
3라운드 실패: 에러 목록을 사용자에게 보고 (Phase 6 진행 불가)
완료 시: dev 서버 PID 보존 → Phase 6에서 사용
```

---

## Phase 6: 시각 검증 루프 ← Verify (병렬)

**코디네이터 패턴: 독립 섹션별 검증을 워커로 병렬 실행 가능.**

```
최대 3라운드. P1=0 될 때까지.
인프라: src/infra/lib/browser/ (Puppeteer + CDP)

1. 렌더링 스크린샷 캡처 → Figma 스크린샷과 pixelmatch 비교
   diffRatio > 0.1 → P1
2. CSS 수치 비교: computed CSS vs tree.json 기대값
   delta > 4px → P1, ≤ 4px → P2
3. 이미지·텍스트 누락 체크
4. P1 우선 수정 (tree.json 참조, 추정 금지) → 컴파일 재검증 → 리로드

반응형: MO 검증 후 viewport 변경 → PC 스크린샷과 동일 루프
종료: 브라우저 + dev 서버 정리
```
