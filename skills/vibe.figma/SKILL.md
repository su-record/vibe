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
  depth=3으로 프레임 수집 → name 패턴으로 분류
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

## Phase 3: 데이터 정제 ← Synthesis (BP별 독립)

**각 BP의 tree.json을 섹션별로 분할 + 정제한다.**
**MO↔PC 매칭(반응형)은 이 단계에서 하지 않는다.**

### ⛔ BLOCKING 명령 — 자체 스크립트 작성 절대 금지

```bash
# MO
node ~/.vibe/hooks/scripts/figma-refine.js \
  /tmp/{feature}/mo-main/tree.json \
  --out=/tmp/{feature}/mo-main/sections.json \
  --design-width=720 \
  --bp=mo

# PC
node ~/.vibe/hooks/scripts/figma-refine.js \
  /tmp/{feature}/pc-main/tree.json \
  --out=/tmp/{feature}/pc-main/sections.json \
  --design-width=2560 \
  --bp=pc
```

⛔ **이 명령을 실행하지 않으면 Phase 4 진행 금지.**
⛔ **자체 정제 스크립트 작성 금지** (refine-sections.mjs, refine.js 등 일체 금지)
⛔ **Python/Node로 tree.json을 직접 파싱하여 sections.json 만들지 말 것**
✅ figma-refine.js의 출력만 사용. 결과가 마음에 안 들면 figma-refine.js를 수정.

### 핵심 원칙

```
⛔ BP별 독립 정제. MO와 PC를 섞지 않는다.
⛔ 정제된 JSON은 Phase 4의 유일한 입력이다.
⛔ 섹션별 전체 하위 트리(children 재귀)를 반드시 포함해야 한다.
```

### 출력

```
/tmp/{feature}/
  mo-main/
    sections.json    ← MO 정제 결과
  pc-main/
    sections.json    ← PC 정제 결과

sections.json 구조:
  {
    meta: { feature, designWidth, bp(해당 BP) },
    sections: [
      {
        name: "Hero",
        nodeId, name, type, size, css,
        text,          // TEXT 노드만
        imageRef,      // 이미지 fill
        fills,         // 다중 fill (2개 이상)
        layoutSizingH, // HUG/FILL/FIXED
        layoutSizingV,
        children: [    // ⛔ 전체 하위 트리 재귀 — 잎 노드까지
          { nodeId, name, type, size, css, children: [...] }
        ],
        images: {
          bg: "bg/hero-bg.webp",
          content: ["content/hero-title.webp"]
        }
      }
    ]
  }
```

### 노드 정제 규칙

```
tree.json → sections.json 변환 시 정제:
  1. 크기 0px 노드 → 제거
  2. VECTOR 장식선 (w/h ≤ 2px) → 제거
  3. isMask 노드 → 제거
  4. BG 프레임 → children에서 분리, images.bg로 이동
  5. 벡터 글자 GROUP → children에서 분리, images.content에 추가
  6. 디자인 텍스트 (fills 다중/gradient, effects 있는 TEXT) → images.content에 추가
  7. 나머지 노드 → children에 유지 (CSS 포함, 재귀)
```

### 멀티 프레임 (같은 BP, 다른 페이지)

```
공통 요소 식별 → 공유 컴포넌트 추출
공통 토큰 합집합 → 공유 _tokens.scss
```

---

## Phase 4: BP별 스태틱 구현 ← Implement (BP별 순차)

**→ vibe.figma.convert 스킬의 규칙을 따른다.**
**⛔ MO 먼저 전체 구현 → 검증 통과 → PC 구현. 반응형 변환은 하지 않는다.**
**⛔ CSS 값은 Figma 원본 px 그대로. vw 변환, clamp, @media 금지.**

### ⛔ BLOCKING 명령 — SCSS는 스크립트 출력만 사용

```bash
# Step A: SCSS 골격 자동 생성 (BP별 1회만 실행)
node ~/.vibe/hooks/scripts/figma-to-scss.js \
  /tmp/{feature}/{bp}-main/sections.json \
  --out=/path/to/project/assets/scss/{feature}/

# Step B: 섹션 단위 검증 (각 섹션 코드 작성 후)
node ~/.vibe/hooks/scripts/figma-validate.js \
  /path/to/project/assets/scss/{feature}/ \
  /tmp/{feature}/{bp}-main/sections.json \
  --section={SectionName}
```

⛔ **figma-to-scss.js를 호출하지 않고 SCSS 파일을 직접 작성하면 Phase 4 무효.**
⛔ **자체 SCSS 생성 스크립트 작성 금지** (to-scss.mjs, generate-scss.js 등 일체)
⛔ **figma-validate.js PASS 없이 다음 섹션 진행 금지.**
⛔ **scoped style 블록 안에 CSS 값을 직접 쓰지 말 것** — 외부 SCSS 파일 import만 허용.
✅ figma-to-scss.js 출력 그대로 사용. 마음에 안 들면 figma-to-scss.js를 수정.

```
Phase 4A: MO 스태틱 구현
  입력: /tmp/{feature}/mo-main/sections.json
  ⛔ 병렬 금지. 한 섹션씩 순차:
    1. sections.json에서 해당 섹션 Read
    2. 이미지 vs HTML 판별 테이블 작성 (BLOCKING)
    3. figma-to-scss.js → SCSS 골격 자동 생성 (px 그대로) — Step A 1회
    4. Claude: HTML 구조 + 시맨틱 태그 + 레이아웃 + 인터랙션 (Vue/React 파일만)
       ⛔ <style> 블록에 CSS 직접 작성 금지 — @import 또는 @use만 허용
    5. figma-validate.js → SCSS vs sections.json 대조 — Step B
       ├─ PASS → 다음 섹션
       └─ FAIL → 불일치 수정 → 5번 재실행 (P1=0 까지, 횟수 제한 없음)
  → Phase 5 (MO 컴파일) → Phase 6 (MO 시각 검증)

Phase 4B: PC 스태틱 구현
  입력: /tmp/{feature}/pc-main/sections.json
  MO와 동일한 프로세스
  → Phase 5 (PC 컴파일) → Phase 6 (PC 시각 검증)

Phase 4C: 반응형 통합 (MO+PC 모두 검증 통과 후)
  → 별도 플로우로 수립 (TODO)

Claude의 역할 (제한적):
  ✅ 이미지 분류: BG / 콘텐츠 / 장식 / 벡터 글자
  ✅ HTML 시맨틱: section/h1/p/button 태그 선택
  ✅ 컴포넌트 분리: v-for 반복, 공유 컴포넌트
  ✅ 인터랙션: @click, 상태 변수, 조건부 렌더링
  ✅ figma-to-scss.js / figma-validate.js 명령 실행
  ❌ SCSS CSS 값 수정 금지 (figma-to-scss.js 출력 그대로 사용)
  ❌ <style> 블록에 CSS 직접 작성 금지
  ❌ vw 변환, clamp, @media, 커스텀 함수/믹스인 생성 금지
  ❌ 자체 정제/생성 스크립트 작성 금지 (refine.mjs, to-scss.mjs 등)

SCSS Setup (첫 섹션 전):
  index.scss, _tokens.scss, _base.scss
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
라운드 수 캡 없음. 컴파일 성공까지 루프 (또는 stuck → 사용자 질문).

0. 베이스라인 캡처 (Phase 4 전): tsc + build 기존 에러 기록
   → Phase 5에서는 새 에러만 수정 대상

1. TypeScript: vue-tsc/svelte-check/tsc --noEmit
2. Build: npm run build (120초 타임아웃)
3. Dev 서버: npm run dev → 포트 감지 → 폴링

에러 시: 파싱 → 자동 수정 → 재체크
종료 조건:
  ✅ 성공: 모든 체크 통과 → Phase 6 진입
  ⚠️ Stuck: 같은 에러가 이전 라운드와 동일 → 사용자 질문
      1. 직접 수정 방법 제공 → 다음 라운드 재시도
      2. "proceed" — 남은 에러 TODO 기록 후 Phase 6 진행
      3. "abort" — 워크플로 중단
  ultrawork 모드: stuck 시 프롬프트 없이 TODO 기록 후 Phase 6 진행

완료 시: dev 서버 PID 보존 → Phase 6에서 사용

⛔ Phase 5 통과(또는 사용자 proceed) 후 반드시 Phase 6 진입. "완료 요약" 출력 금지.
⛔ Phase 6 없이 작업 완료 선언 금지.
```

---

## Phase 6: 시각 검증 루프 ← Verify (병렬) ⛔ MANDATORY

**⛔ Phase 6은 선택이 아닌 필수. Phase 5 통과 즉시 자동 진입.**
**⛔ Phase 6 미실행 시 전체 작업은 "미완료" 상태.**
**코디네이터 패턴: 독립 섹션별 검증을 워커로 병렬 실행 가능.**

```
라운드 수 캡 없음. P1=0 될 때까지 루프 (또는 stuck → 사용자 질문).
인프라: src/infra/lib/browser/ (Puppeteer + CDP)

1. 렌더링 스크린샷 캡처 → Figma 스크린샷과 pixelmatch 비교
   diffRatio > 0.1 → P1
2. CSS 수치 비교: computed CSS vs tree.json 기대값
   delta > 4px → P1, ≤ 4px → P2
3. 이미지·텍스트 누락 체크
4. P1 우선 수정 (tree.json 참조, 추정 금지) → 컴파일 재검증 → 리로드

Narrowing scope (노이즈 감소):
  Round 1: P1+P2+P3 전체
  Round 2: P1+P2
  Round 3+: P1 only (P1=0까지 계속)

종료 조건:
  ✅ 성공: P1 = 0 AND 새 findings 없음 → 완료
  ⚠️ Stuck: 같은 findings가 이전 라운드와 동일 → 사용자 질문
      1. 직접 해결책 제공 → 다음 라운드 재시도
      2. "proceed" — 남은 이슈 TODO 기록 후 완료
      3. "abort" — 워크플로 중단
  ultrawork 모드: stuck 시 프롬프트 없이 TODO 기록 후 완료

반응형: MO 검증 후 viewport 변경 → PC 스크린샷과 동일 루프
정리: 브라우저 + dev 서버 정리

⛔ Phase 6 완료(또는 사용자 proceed) 후에만 "완료 요약" 출력 허용.
```
