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

### 3-1. 스크린샷 시각 분석 (1순위)

```
get_screenshot(fileKey, designFrame.nodeId)
→ 원본 디자인 이미지 확보 — 이것이 코드 생성의 1차 소스

스크린샷에서 읽는 항목 (vibe-figma-rules R-7 참조):
  → 레이아웃 구조 (섹션 경계, flex/grid 방향, 요소 배치)
  → 배경 (이미지/단색/그라데이션, 오버레이 유무)
  → 색상 (배경, 텍스트, 버튼, 보더)
  → 타이포 (크기 비율, 굵기, 줄간격) — 스케일 팩터 적용 (R-3)
  → 간격 (패딩, gap, 마진) — 스케일 팩터 적용 (R-3)
  → 이미지 분류 (Background/Content/Overlay, R-4 참조)
  → z-index 관계 (겹침 구조, 투명도)
```

### 3-2. 참조 코드 + 에셋 추출 (2순위)

```
get_design_context(fileKey, designFrame.nodeId)
→ 참조 코드 + 에셋 URL

참조 코드에서 가져오는 것:
  ✅ 이미지 에셋 URL (https://figma.com/api/mcp/asset/...) — 핵심 가치
  ✅ 정확한 hex 색상값 (스크린샷 추정보다 정확할 때)
  ✅ 폰트 패밀리명, border-radius, shadow 값
  ⚠️ 레이아웃/구조 — 스크린샷과 대조 후 채택
  ❌ px 값 그대로 사용 금지 — 반드시 스케일 팩터 적용

⚠️ 레이어가 "Frame 633372" 같은 비정형일 때:
  참조 코드가 부정확할 수 있음 → 스크린샷 분석 결과를 기준으로 코드 생성
```

### 3-3. 이미지 에셋 다운로드 (BLOCKING — 코드 반영 전 필수)

```
Step a: 참조 코드에서 에셋 URL 추출
  → 모든 https://www.figma.com/api/mcp/asset/ URL 수집

Step b: 각 URL을 다운로드 → 파일 저장
  Bash: curl -L "{url}" -o static/images/{feature}/{name}.webp
  파일명: 변수명/레이어명 기반 kebab-case

Step c: URL→로컬경로 매핑 테이블 생성

Step d: 다운로드 검증
  → 파일 존재 + 0byte 아닌지 확인
  → 누락/실패 시 재다운로드
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

### 3-5. 컴포넌트 파일에 반영 (Edit 도구)

```
변환 순서 (스크린샷 분석 → 코드):

a. 스크린샷 분석 결과로 코드 작성:
   - 레이아웃 구조 (스크린샷에서 읽은 flex/grid, 배치)
   - 스타일 값 (스크린샷에서 읽은 색상, 간격, 폰트 × 스케일 팩터)
   - 배경 이미지 Multi-Layer 구조 (스크린샷에서 판단한 z-index)

b. 참조 코드에서 보강:
   - 에셋 URL → 다운로드된 로컬 경로로 교체
   - 정확한 hex 색상값, border-radius, shadow (스크린샷 추정보다 정확할 때)

c. 프로젝트 스택으로 변환 (React→Vue 등)

d. Step A 코드와 병합:
   - 기능 주석/핸들러/인터페이스 보존
   - template의 placeholder → 실제 마크업으로 교체

주의:
  - 스크린샷에 보이는 이미지가 코드에 없으면 → 누락
  - Figma 임시 URL이 코드에 남으면 안 됨
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
1. 이미지 에셋: 전부 다운로드 + 로컬 파일 존재 + 0byte 아님
2. Figma 임시 URL: Grep으로 figma.com/api/mcp/asset 잔존 0건 확인
3. 배경 이미지: 스크린샷에 보이는 배경이 코드에도 있는지
4. 오버레이: 배경 위 텍스트 가독성 확보 (스크린샷 대조)
5. (responsive) 이전 뷰포트 섹션들 재비교 — 깨진 곳 없는지
```

## 참조 스킬

코드 생성 시 다음 스킬의 규칙을 적용:
- `vibe-figma-rules` — 공통 규칙 (R-1~R-7)
- `vibe-figma-style` — 토큰/스타일 아키텍처
- `vibe-figma-codegen` — 마크업/코드 생성 규칙
