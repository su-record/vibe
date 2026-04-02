---
name: vibe-figma-frame
tier: standard
description: "디자인 URL → 프레임별 개별 추출 → 스타일/이미지/코드 반영 → 검증 루프. Step B/C 공통."
triggers: []
---

# Design Frame (프레임별 정밀 추출 + 코드 반영)

디자인 URL 하나를 받아서 **프레임별로 쪼개서 추출**하고, Step A에서 만든 컴포넌트에 스타일/이미지를 채움.
어떤 뷰포트든 동일한 프로세스. 두 번째 호출 시 반응형 레이어만 추가.

> **⛔ 실행 지시: 분석만 하지 말 것.**
> - 이미지: WebFetch로 다운로드 → Write 도구로 파일 저장
> - 스타일: Write 도구로 SCSS/CSS 파일 생성 (layout/ + components/)
> - 코드: Edit 도구로 Step A 컴포넌트의 template/style 채움
> - 토큰: Edit 도구로 _tokens.scss에 추출한 값 추가
> 모든 Phase가 끝나면 디스크에 실제 파일이 변경되어 있어야 함.

## 입력

- 디자인 Figma URL (전체 페이지)
- Step A에서 생성된 컴포넌트 파일들
- 호출 횟수 (첫 번째 = base, 두 번째 이후 = responsive 추가)

## Phase 1: 디자인 URL 입력

AskUserQuestion (options 사용 금지, 자유 텍스트만):

```
첫 번째 호출:
  question: "🎨 디자인 Figma URL을 입력해주세요."
  → ⏸️ 응답 대기 (응답 전 다음 진행 금지)
  → URL 저장 → Phase 2~5 실행

검증 완료 후:
  question: "🎨 추가 디자인 URL이 있나요? (없으면 '없음')"
  → ⏸️ 응답 대기
  → URL 입력 → responsive 모드로 Phase 2~5 재실행
  → "없음" → Step C(공통화)로 진행

모바일/PC 순서를 강제하지 않음. 어떤 뷰포트든 먼저 입력 가능.
첫 번째 URL = base 스타일, 추가 URL = 반응형 레이어 추가.
```

## Phase 2: 전체 → 섹션 프레임 매핑

```
1. get_metadata(fileKey, nodeId) → 전체 페이지 하위 프레임 목록

2. 프레임 이름으로 Step A 컴포넌트와 매핑:
   | 디자인 프레임 이름 | Step A 컴포넌트 |
   |------------------|----------------|
   | "키 비주얼" / "Hero" / "KV" | HeroSection.vue |
   | "출석" / "Check" / "Mission 01" | DailyCheckInSection.vue |
   | "플레이타임" / "Mission 02" | PlayTimeMissionSection.vue |
   | "교환" / "Exchange" / "Shop" | TokenExchangeSection.vue |
   | "응모" / "Raffle" / "Prize" | TokenRaffleSection.vue |
   | "유의사항" / "Caution" / "Notice" | CautionSection.vue |
   | "GNB" / "Header" / "Nav" | GnbHeader.vue |
   | "Footer" | EventFooter.vue |

   매핑 방법:
   - 프레임 이름 키워드 매칭
   - 매칭 안 되면 순서(위→아래)로 Step A 섹션과 1:1 대응
   - 그래도 안 되면 get_screenshot으로 비주얼 비교

3. 매핑 결과 출력:
   "디자인 프레임 N개 → 컴포넌트 N개 매핑 완료"
   매핑 안 된 프레임이 있으면 사용자에게 확인
```

## Phase 3: 섹션별 개별 추출

**각 매핑된 섹션에 대해 순서대로:**

```
for each (designFrame, component) in mappings:

  1. get_design_context(fileKey, designFrame.nodeId)
     → 해당 섹션 전용 코드 + 스크린샷 + 에셋 URL

  2. 이미지 에셋 다운로드 (BLOCKING):
     → 응답에서 figma.com/api/mcp/asset/ URL 전부 추출
     → WebFetch로 다운로드 → static/images/{feature}/ 저장
     → URL→로컬경로 매핑 테이블에 추가

  3. 스크린샷 분석:
     → 레이아웃 (flex/grid 방향, 정렬)
     → 색상 (배경, 텍스트, 보더)
     → 타이포 (크기, 굵기, 줄간격)
     → 간격 (padding, gap, margin)
     → 배경 이미지 구조 (Multi-Layer: Bg/Overlay/Content)

  4. component 파일에 반영:
     → <template> 안의 placeholder를 실제 마크업으로 교체
     → <style> 블록에 추출한 스타일 작성
     → 이미지 경로를 로컬 경로로 교체
     → Step A의 기능 주석과 핸들러는 보존
```

## Phase 4: 뷰포트 모드에 따른 스타일 적용

### 첫 번째 URL (base)

```
- 모든 스타일을 base로 작성 (반응형 미고려)
- 토큰 파일에 추출한 값 저장
- 이미지 다운로드 + 로컬 경로 매핑
```

### 추가 URL (responsive)

```
기존 코드를 수정하지 않고 반응형 레이어만 추가:

1. 프레임 width 비교 → 어떤 뷰포트인지 자동 판별
   (base보다 크면 desktop 방향, 작으면 mobile 방향)

2. 값이 다른 속성 → clamp() fluid 토큰으로 변환
   - SCSS: figma-fluid($min, $max) 함수 사용
   - CSS: clamp(min, preferred, max)

3. 레이아웃 구조가 다른 부분 → @media (min-width: {breakpoint}px)
   - flex-direction 변경
   - grid-template-columns 변경
   - display toggle (baseOnly/responsiveOnly)

4. 뷰포트별 배경 이미지 → @media 분기
   .heroBg { background-image: url(base.webp); }
   @media (min-width: {breakpoint}px) { .heroBg { background-image: url(alt.webp); } }

5. 추가 이미지 에셋 다운로드 (base와 동일하면 스킵)

6. 기존 base 코드/주석/핸들러는 절대 삭제하지 않음
```

## Phase 5: 검증 루프

```
🔄 Figma 원본 스크린샷 vs 생성된 코드 비교:

  1. get_screenshot으로 Figma 원본 획득 (이미 Phase 3에서 있음)
  2. 생성된 코드의 렌더링 결과와 비교
  3. 비교 항목:
     - 레이아웃 (배치, 정렬, 간격)
     - 타이포 (크기, 굵기, 색상)
     - 색상 (배경, 텍스트, 보더)
     - 이미지 (배경/에셋 표시 여부)
     - 누락 요소

  4. Diff Report:
     | 섹션 | 항목 | Figma | 코드 | 심각도 |
     |------|------|-------|------|--------|
     | Hero | 배경 이미지 | 있음 | 누락 | P1 |
     | 출석 | font-size | 24px | 20px | P2 |

  5. P1 불일치 → 수정 → 재비교 (횟수 제한 없음)
     동일 항목 3회 연속 미해결 → 해당 항목만 사용자 확인 후 계속

  6. 완료 조건:
     ✅ P1 = 0
     ✅ 모든 이미지 에셋 표시
     ✅ (두 번째 호출 시) 이전 뷰포트도 깨지지 않았는지 재확인
```

## 참조 스킬

코드 생성 시 다음 스킬의 규칙을 적용:
- `vibe-figma-rules` — 분석/감지 (Phase 1-3)
- `vibe-figma-style` — 토큰/스타일 (Phase 4, 클래스 네이밍, SCSS)
- `vibe-figma-codegen` — 마크업/코드 생성 (Phase 5-6, 이미지 패턴, 반응형)
