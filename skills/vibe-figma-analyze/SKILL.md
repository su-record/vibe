---
name: vibe-figma-analyze
tier: standard
description: "스토리보드 세밀 분석 → 실제 레이아웃 코드 + 기능 주석 + 컴포넌트 구조 생성. Step A에서 vibe-figma 이후 실행."
triggers: []
---

# Storyboard Deep Analysis & Layout Generation

스토리보드 URL 하나로 **실제 동작하는 레이아웃 코드**를 생성.
빈 shell이 아니라, 스토리보드에서 파악 가능한 모든 정보를 코드에 반영.

> **실행 지시: 이 스킬은 분석만 하는 게 아님. 반드시 Write 도구로 파일을 생성해야 함.**
> A-1~A-4에서 분석 → A-5에서 **Write 도구로 실제 파일 생성** → A-6에서 인터랙션 테이블 출력.

## 입력

- 스토리보드 URL의 get_metadata 결과 (전체 프레임 목록)
- storyboardSpec (브레이크포인트 등, vibe-figma에서 추출)

## A-1. 프레임 전수 조사

get_metadata에서 얻은 **모든 최상위 프레임**을 분류:

```
SKIP    — "개요", "Cover", "변경 이력" (문서 관리용)
SPEC    — "기능 정의", "정책" → 기능 스펙 텍스트 추출 대상
CONFIG  — "해상도", "Media Query", "브라우저" → 설정값 추출
SHARED  — "공통", "GNB", "Footer", "Popup", "Dialog" → 공통 컴포넌트
FLOW    — "Event Flow", "플로우" → 유저 플로우 파악
ASSET   — "OG", "배너", "어셋" → 스킵 (메타 이미지)
PAGE    — "메인", "화면설계" 하위 → 핵심 섹션 (코드 생성 대상)

서브 프레임 (3.x.1, 3.x.2 등):
  → 해당 PAGE 섹션의 상태 변형 / 인터랙션 결과 화면
```

## A-2. SPEC 프레임 세밀 분석

**기능 정의서 프레임**에 대해 get_design_context 호출:

```
추출 대상:
  - Overview: 개요, 대상, 일정
  - Spec: 각 섹션별 기능 정의 (로직, 조건, 보상 구조)
  - 일정: 시작/종료 시간, 단계별 기간

추출한 텍스트를 섹션별로 분리:
  {
    "overview": "...",
    "sections": {
      "hero": "키 비주얼 영역, CTA 버튼...",
      "featureA": "섹션 A 기능 설명...",
      "featureB": "섹션 B 기능 설명..."
    }
  }

→ A-5에서 각 컴포넌트의 기능 주석이 됨
```

## A-3. SHARED 프레임 분석

공통 요소 프레임들의 get_screenshot으로 구조 파악:

```
GNB: 네비게이션 구조, 메뉴 항목, 로그인 버튼
Footer: 링크, 법적 고지
Popup: 패턴 분류 (확인/취소, 상세 모달, 알림, 입력 폼)

→ 프로젝트에 이미 있는 컴포넌트 확인 (Glob으로 탐색)
→ 있으면 import 재사용, 없으면 새로 생성
```

## A-4. PAGE 프레임 세밀 분석

> **모든 PAGE 프레임을 빠짐없이 분석한다. 일부만 처리하고 넘어가면 안 됨.**
> A-1에서 PAGE로 분류된 프레임 수 = A-5에서 생성하는 섹션 컴포넌트 수.

**각 PAGE 프레임**에 대해 get_screenshot + get_design_context:

```
각 프레임에서 추출:

1. 레이아웃 구조 (get_screenshot 비주얼 분석):
   - 섹션 경계 (배경 변화 지점)
   - 요소 배치 방향 (vertical stack / grid / positioned)
   - 이미지 배경 영역 vs 콘텐츠 영역

2. 인터랙션 스펙 (우측 주석):
   - 번호 태그 (①②③) → 인터랙션 ID
   - 동작 설명 → 이벤트 타입 + 결과
   - 조건 분기 (로그인 여부, 기간 내/외 등)

3. 상태 변형 (서브 프레임):
   - 기본 → 클릭 후 → 성공 → 에러 등
   - 팝업 트리거 조건

결과를 섹션별로 저장:
  sections[sectionName] = {
    layout: "vertical-stack, bg-image + overlay + content",
    children: ["Title", "Description", "Grid", "CTAButton"],
    interactions: [
      { id: "①", trigger: "클릭", action: "처리", result: "결과 표시" }
    ],
    states: ["default", "active", "completed"],
    popups: ["ConfirmDialog"]
  }
```

## A-5. 파일 생성 (Write 도구 사용 — 필수)

> **Write 도구로 아래 파일들을 실제로 생성한다. 코드를 보여주기만 하면 안 됨.**

디렉토리는 **vibe-figma-rules R-2.2** 감지 결과에 따라 결정.

### 생성할 파일 목록

```
필수 생성 (Write 도구):
  1. pages/{feature-name}.{vue|tsx}              ← 루트 페이지
  2. components/{feature-name}/각섹션.{vue|tsx}   ← 섹션별 컴포넌트
  3. components/{feature-name}/popups/각팝업      ← 팝업 컴포넌트
  4. styles/{feature-name}/index.scss            ← 스타일 진입점 (빈 import 목록)
  5. styles/{feature-name}/_tokens.scss          ← 빈 토큰 파일 (Step B에서 채움)
```

### 루트 페이지 구조

```
- 모든 섹션 컴포넌트 import
- 팝업 조건부 렌더링 (v-if/&&)
- 개요 JSDoc 주석 (A-2에서 추출한 overview)
```

### HARD RULE: 빈 template 금지

```
브라우저에서 열었을 때 화면에 텍스트가 보여야 한다.
빈 컴포넌트 shell은 Step A 미완성.

<template> 안에 반드시:
  - 스토리보드에서 추출한 실제 텍스트 (제목, 설명, 버튼 라벨)
  - 목 데이터가 렌더링되는 리스트 (v-for / .map)
  - 클릭 가능한 버튼/링크
  - 조건부 렌더링 (v-if / &&)
```

### 섹션 컴포넌트 — 실제 코드 예시 (Vue)

```vue
<template>
  <section class="dailyCheckInSection">
    <h2 class="dailyCheckInSection__title">일일 출석 미션</h2>
    <p class="dailyCheckInSection__description">매일 출석하고 스노우 토큰을 받으세요!</p>

    <div class="dailyCheckInSection__calendar">
      <div
        v-for="day in checkInDays"
        :key="day.date"
        class="dailyCheckInSection__day"
        :class="{ 'is-checked': day.checked, 'is-today': day.isToday }"
        @click="handleCheckIn(day)"
      >
        <span class="dailyCheckInSection__dayLabel">{{ day.date }}</span>
        <span class="dailyCheckInSection__dayReward">{{ day.reward }} 토큰</span>
      </div>
    </div>

    <div class="dailyCheckInSection__milestones">
      <div
        v-for="milestone in milestones"
        :key="milestone.days"
        class="dailyCheckInSection__milestone"
        :class="{ 'is-claimable': milestone.claimable, 'is-claimed': milestone.claimed }"
        @click="handleClaimReward(milestone)"
      >
        <span>{{ milestone.days }}일 달성</span>
        <span>{{ milestone.reward }}</span>
        <button v-if="milestone.claimable && !milestone.claimed">받기</button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * 일일 출석 미션 섹션
 *
 * [기능 정의]
 * - 매일 출석 시 스노우 토큰 즉시 지급
 * - 누적 3/5/7일 달성 시 추가 보상
 *
 * [인터랙션]
 * ① 출석하기 클릭 → 출석 처리 → 토큰 지급 표시
 * ② 누적 보상 클릭 → 보상 수령
 *
 * [상태] default, checked, reward-claimed
 */

interface CheckInDay {
  date: string
  checked: boolean
  isToday: boolean
  reward: number
}

interface Milestone {
  days: number
  claimable: boolean
  claimed: boolean
  reward: string
}

// 목 데이터 — 빈 배열 금지!
const checkInDays = ref<CheckInDay[]>([
  { date: 'Day 1', checked: true, isToday: false, reward: 10 },
  { date: 'Day 2', checked: true, isToday: false, reward: 10 },
  { date: 'Day 3', checked: false, isToday: true, reward: 10 },
  { date: 'Day 4', checked: false, isToday: false, reward: 10 },
  { date: 'Day 5', checked: false, isToday: false, reward: 10 },
  { date: 'Day 6', checked: false, isToday: false, reward: 15 },
  { date: 'Day 7', checked: false, isToday: false, reward: 20 },
])

const milestones = ref<Milestone[]>([
  { days: 3, claimable: false, claimed: false, reward: '보상 상자 1개' },
  { days: 5, claimable: false, claimed: false, reward: '보상 상자 2개' },
  { days: 7, claimable: false, claimed: false, reward: '스페셜 보상' },
])

function handleCheckIn(day: CheckInDay): void {
  // TODO: 출석 API 호출
}

function handleClaimReward(milestone: Milestone): void {
  // TODO: 누적 보상 수령 API 호출
}
</script>
<!-- 스타일은 외부 파일: styles/{feature}/components/_daily-checkin.scss -->
```

### 필수 포함 사항 체크리스트

```
<template> 안에:
  □ 섹션 제목 <h2> (스토리보드에서 추출한 실제 텍스트)
  □ 설명 텍스트 <p> (스토리보드에서 추출)
  □ 리스트 렌더링 (v-for + 목 데이터, 빈 배열 금지)
  □ 버튼/CTA (실제 라벨 텍스트 + @click 핸들러)
  □ 조건부 렌더링 (상태에 따른 v-if)
  □ 클래스명 (Step B에서 외부 스타일과 매칭)

<script> 안에:
  □ JSDoc: [기능 정의] + [인터랙션] + [상태]
  □ TypeScript interface
  □ 목 데이터 (기능 정의서에서 추출, 3~7개 아이템)
  □ 이벤트 핸들러 함수 (body는 // TODO:)
```

### 스타일 분리 규칙

```
컴포넌트 파일에 <style> 블록을 작성하지 않는다.
스타일은 Step B에서 외부 파일로 생성.
컴포넌트는 <template> + <script setup> 만 포함.
```

### Step A 완료 기준

```
브라우저에서 열었을 때:
  ✅ 각 섹션의 제목/설명 텍스트가 화면에 보인다
  ✅ 리스트 아이템이 렌더링된다 (목 데이터)
  ✅ 버튼을 클릭하면 핸들러가 실행된다
  ✅ 탭/아코디언/모달이 동작한다
  ❌ 스타일은 없다 (Step B에서)
  ❌ 이미지는 없다 (Step B에서)

빈 화면 = Step A 미완성. 다음 단계로 넘어가지 않는다.
```

## A-6. 인터랙션 매핑 테이블

코드 생성 후, 전체 인터랙션을 테이블로 출력:

```markdown
| 섹션 | ID | 트리거 | 동작 | 컴포넌트 | 함수 |
|------|-----|--------|------|---------|------|
| Hero | ① | 클릭 | 공유하기 팝업 | HeroSection | handleShare() |
| 섹션A | ① | 클릭 | API 호출 | FeatureASection | handleAction() |

→ Step B/C에서 이 함수들의 body를 구현
```

## A-7. Step A 검증

> **아래 검증을 도구로 실제 실행해야 함.**

### 검증 항목

```
0. 빈 화면 검사 (가장 중요 — 먼저 실행):
   각 컴포넌트 파일을 Read로 열어서 <template> 안에 확인:
     □ <h2> 또는 <h3> 섹션 제목 텍스트 존재
     □ <p> 설명 텍스트 존재
     □ v-for 또는 .map 렌더링 존재 (리스트 있는 섹션)
     □ @click 또는 onClick 이벤트 존재 (인터랙션 있는 섹션)
   <template> 안에 실제 HTML 태그가 없으면 → 빈 컴포넌트 → 재작성
   Grep: "<template>" 다음 줄이 "</template>"이면 → 빈 template

1. 파일 존재 확인 (Glob 도구):
   □ 루트 페이지 파일 존재
   □ PAGE 프레임 수 = 컴포넌트 파일 수
   □ styles 디렉토리 존재

2. 목 데이터 확인 (Grep 도구):
   □ 빈 배열 (ref([]) 패턴) 검색 → 0건
   → 발견 시 목 데이터 채움

3. 스타일 분리 확인 (Grep 도구):
   □ 컴포넌트 내 <style> 블록 0건

4. 빌드 확인 (Bash 도구):
   □ npm run build 성공

5. 브라우저 확인:
   □ dev 서버 열어서 실제 화면 확인
   □ 각 섹션에 텍스트가 보이는지
   □ 빈 화면이면 → 해당 컴포넌트 재작성
```

### 완료 조건

```
✅ 빈 template 0개 — 모든 컴포넌트에 실제 HTML 마크업 존재
✅ 브라우저에서 텍스트/리스트/버튼이 보인다
✅ 파일 수 = PAGE 프레임 수
✅ 빈 배열 0개
✅ <style> 블록 0개
✅ 빌드 성공

빈 화면 = Step A 미완성. Step B로 넘어가지 않는다.
→ Step B 진행 가능
```
