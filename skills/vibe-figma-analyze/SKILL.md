---
name: vibe-figma-analyze
tier: standard
description: "스토리보드 세밀 분석 → 실제 레이아웃 코드 + 기능 주석 + 컴포넌트 구조 생성. Step A에서 vibe-figma 이후 실행."
triggers: []
---

# Storyboard Deep Analysis & Layout Generation

스토리보드 URL 하나로 **실제 동작하는 레이아웃 코드**를 생성.
빈 shell이 아니라, 스토리보드에서 파악 가능한 모든 정보를 코드에 반영.

## 입력

- 스토리보드 URL의 get_metadata 결과 (전체 프레임 목록)
- storyboardSpec (브레이크포인트 등, vibe-figma에서 추출)

## Phase 1: 프레임 전수 조사

get_metadata에서 얻은 **모든 최상위 프레임**을 분류:

```
각 프레임을 카테고리로 분류:

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

## Phase 2: SPEC 프레임 세밀 분석 (기능 정의서)

**기능 정의서 프레임**에 대해 get_design_context 호출:

```
추출 대상:
  - Overview: 이벤트 개요, 대상, 일정
  - Spec: 각 섹션별 기능 정의 (로직, 조건, 보상 구조)
  - Event 일정: 시작/종료 시간, 단계별 기간

추출한 텍스트를 섹션별로 분리:
  {
    "overview": "겨울 PC방 이벤트...",
    "sections": {
      "hero": "키 비주얼 영역, 로그인 연동, 가맹 PC방 확인...",
      "dailyCheckIn": "매일 ON 게임 진입 + 출석란 터치 → 스노우 토큰 즉시 지급...",
      "playTimeMission": "일일 플레이 타임 달성 시 보상...",
      "tokenExchange": "스노우 토큰으로 아이템 교환...",
      "tokenRaffle": "스노우 토큰으로 상품 응모..."
    }
  }

→ 이 정보가 Phase 5에서 각 컴포넌트의 기능 주석이 됨
```

## Phase 3: SHARED 프레임 분석 (공통 컴포넌트)

공통 요소 프레임들의 get_screenshot으로 구조 파악:

```
GNB: 네비게이션 구조, 메뉴 항목, 언어 변경, 로그인 버튼
Footer: 소셜 링크, 법적 고지, 시간 표시 (UTC/KST)
Popup: 패턴 분류 (확인/취소, 상세 모달, 알림, 입력 폼)
Error: 에러 페이지 구조

→ 프로젝트에 이미 있는 컴포넌트 확인 (Glob으로 탐색)
→ 있으면 import 재사용, 없으면 새로 생성
```

## Phase 4: PAGE 프레임 세밀 분석 (화면설계)

**각 PAGE 프레임**에 대해 get_screenshot + get_design_context:

```
각 프레임에서 추출:

1. 레이아웃 구조 (get_screenshot 비주얼 분석):
   - 섹션 경계 (배경 변화 지점)
   - 요소 배치 방향 (vertical stack / grid / positioned)
   - 이미지 배경 영역 vs 콘텐츠 영역
   - 대략적인 비율 (hero 50vh, section padding 등)

2. 인터랙션 스펙 (우측 주석):
   - 번호 태그 (①②③) → 인터랙션 ID
   - 동작 설명 → 이벤트 타입 + 결과
   - 조건 분기 (로그인 여부, 기간 내/외 등)

3. 상태 변형 (서브 프레임 3.x.1, 3.x.2):
   - 기본 → 클릭 후 → 성공 → 에러 등
   - 팝업 트리거 조건

결과를 섹션별로 저장:
  sections[sectionName] = {
    layout: "vertical-stack, bg-image + overlay + content",
    children: ["Title", "Description", "RewardGrid", "CTAButton"],
    interactions: [
      { id: "①", trigger: "클릭", action: "출석 처리", result: "보상 표시" }
    ],
    states: ["default", "checked", "reward-claimed"],
    popups: ["ConfirmDialog"]
  }
```

## Phase 5: 실제 코드 생성 (빈 shell 아님)

스토리보드 분석 결과로 **실제 동작하는 레이아웃 코드** 생성.
스타일은 Step B에서 채우지만, **구조/로직/주석은 이 단계에서 완성**.

### 루트 페이지

```vue
<!-- pages/{feature-name}.vue -->
<template>
  <div class="eventPage">
    <GnbHeader />

    <HeroSection />
    <DailyCheckInSection />
    <PlayTimeMissionSection />
    <TokenExchangeSection />
    <TokenRaffleSection />
    <CautionSection />

    <EventFooter />

    <!-- Popups -->
    <ConfirmDialog v-if="showConfirm" @close="showConfirm = false" />
    <TokenDetailModal v-if="showTokenDetail" @close="showTokenDetail = false" />
  </div>
</template>

<script setup lang="ts">
/**
 * {이벤트명} 메인 페이지
 *
 * [개요] Phase 2에서 추출한 overview 텍스트
 * [일정] 시작일 ~ 종료일
 * [대상] 대상자 설명
 */

import HeroSection from '~/components/{feature-name}/HeroSection.vue'
// ... 모든 섹션 import

const showConfirm = ref(false)
const showTokenDetail = ref(false)
</script>
```

### 각 섹션 컴포넌트 (기능 주석 포함)

```vue
<!-- components/{feature-name}/DailyCheckInSection.vue -->
<template>
  <section class="dailyCheckInSection">
    <div class="dailyCheckInSection__title">
      <!-- Step B: 모바일 디자인에서 타이틀 이미지/텍스트 반영 -->
    </div>

    <div class="dailyCheckInSection__calendar">
      <div
        v-for="day in checkInDays"
        :key="day.date"
        class="dailyCheckInSection__day"
        :class="{ 'is-checked': day.checked, 'is-today': day.isToday }"
        @click="handleCheckIn(day)"
      >
        <!-- Step B: 일별 UI (아이콘, 날짜, 보상) -->
      </div>
    </div>

    <div class="dailyCheckInSection__accumulated">
      <div
        v-for="milestone in milestones"
        :key="milestone.days"
        class="dailyCheckInSection__milestone"
        :class="{ 'is-claimable': milestone.claimable, 'is-claimed': milestone.claimed }"
        @click="handleClaimReward(milestone)"
      >
        <!-- Step B: 누적 보상 UI -->
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * 일일 출석 미션 섹션
 *
 * [기능 정의]
 * - 매일 ON 게임 진입, 대상 출석란 터치 시 출석 처리
 * - 스노우 토큰이 즉시 지급됨
 * - 누적 출석일 보상: 3일/5일/7일 달성 시 추가 보상
 *
 * [인터랙션]
 * ① 출석하기 클릭 → 출석 처리 API 호출 → 토큰 지급 표시
 * ② 누적 보상 달성 시 → 보상받기 버튼 활성화 → 클릭 시 수령
 *
 * [상태]
 * - default: 오늘 미출석
 * - checked: 오늘 출석 완료
 * - reward-claimed: 누적 보상 수령 완료
 *
 * [조건]
 * - 이벤트 기간 내에만 출석 가능
 * - 가맹 PC방에서만 출석 가능 (비가맹 시 안내 팝업)
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

const checkInDays = ref<CheckInDay[]>([])
const milestones = ref<Milestone[]>([])

function handleCheckIn(day: CheckInDay): void {
  // TODO: 출석 API 호출
}

function handleClaimReward(milestone: Milestone): void {
  // TODO: 누적 보상 수령 API 호출
}
</script>

<style lang="scss" scoped>
/* Step B: 모바일 디자인 URL 반영 시 스타일 구현 */
.dailyCheckInSection {
  /* layout will be filled in Step B */
}
</style>
```

### 핵심 원칙: 스타일 없이 동작하는 코드

```
✅ 클릭 → 팝업 열림/닫힘이 실제로 동작
✅ 탭 전환, 아코디언 펼침/접기가 동작
✅ 상태 변경 (체크, 선택, 비활성화)이 반영됨
✅ 모달/팝업 open/close가 v-if/ref로 연결됨
✅ emit으로 부모-자식 이벤트가 실제 연결됨
✅ 리스트 렌더링 (v-for)이 더미 데이터로 동작
✅ 조건부 렌더링 (v-if)이 상태에 따라 전환됨

→ 브라우저에서 열면 스타일은 없지만 클릭/인터랙션은 동작하는 상태

✅ 기능 정의서 내용 → 컴포넌트 JSDoc 주석
✅ 인터랙션 스펙 → 이벤트 핸들러 함수 (API 호출은 TODO)
✅ 상태 목록 → TypeScript 인터페이스 + ref + 더미 데이터
✅ 스타일은 빈 블록 → Step B에서 채움
✅ 이미지는 placeholder → Step B에서 교체
```

### 팝업/모달 구현 수준

```vue
<!-- 팝업이 실제로 열리고 닫히는 코드 -->
<template>
  <!-- 트리거 버튼 -->
  <button @click="showConfirm = true">교환하기</button>

  <!-- 모달 — v-if로 제어, 실제 동작 -->
  <Teleport to="body">
    <div v-if="showConfirm" class="modalOverlay" @click.self="showConfirm = false">
      <div class="modalContent">
        <p>정말 교환하시겠습니까?</p>
        <button @click="handleConfirm">확인</button>
        <button @click="showConfirm = false">취소</button>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const showConfirm = ref(false)

function handleConfirm(): void {
  // TODO: 교환 API 호출
  showConfirm.value = false
}
</script>
```

## Phase 6: 인터랙션 매핑 테이블

코드 생성 후, 전체 인터랙션을 테이블로 출력:

```markdown
## 인터랙션 매핑

| 섹션 | ID | 트리거 | 동작 | 컴포넌트 | 함수 |
|------|-----|--------|------|---------|------|
| Hero | ① | 공유 클릭 | 공유하기 팝업 | HeroSection | handleShare() |
| 출석 | ① | 출석하기 클릭 | API 호출 → 토큰 지급 | DailyCheckInSection | handleCheckIn() |
| 출석 | ② | 누적 보상 클릭 | 보상 수령 | DailyCheckInSection | handleClaimReward() |
| 교환소 | ① | 교환하기 클릭 | 확인 팝업 → 교환 처리 | TokenExchangeSection | handleExchange() |
| 응모 | ① | 응모하기 클릭 | 응모 처리 → 이메일 수집 | TokenRaffleSection | handleRaffle() |

→ Step B/C에서 코드 생성 시 이 함수들의 body를 구현
```

## 출력 요약

```
✅ 루트 페이지 (실제 레이아웃 + 섹션 배치 + 팝업 조건부 렌더링)
✅ 각 섹션 컴포넌트 (구조 코드 + 기능 주석 + 이벤트 핸들러 + TypeScript 인터페이스)
✅ 공통 컴포넌트 (GNB, Footer, Popup — 기존 재사용 또는 신규)
✅ 인터랙션 매핑 테이블
✅ 스타일은 빈 블록 → Step B(모바일)에서 디자인 URL 받고 채움
✅ 이미지는 placeholder → Step B에서 다운로드 후 교체
```
