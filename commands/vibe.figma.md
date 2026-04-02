---
description: Figma design to code — extract + generate in one step
argument-hint: ""
---

# /vibe.figma

Figma 디자인 + 스토리보드 → 프로덕션 코드. **뷰포트별 점진적 빌드** 방식.

## Usage

```
/vibe.figma                  # 인터랙티브 모드 (단계별 URL 입력)
/vibe.figma --new            # 새 피처 모드 (기존 디자인 시스템 무시)
/vibe.figma --refine         # 보완 모드 (기존 코드 + Figma 재비교 → 수정)
```

## Incremental Build Flow (핵심 플로우)

한번에 전체를 만들지 않고, **뷰포트별로 점진적으로 쌓아가는 방식**:

```
Step A: 스토리보드 URL 입력
  → 브레이크포인트, 인터랙션, 스펙 추출
  → base 레이아웃 & 컴포넌트 구조 설계 + 파일 생성
        ↓
Step B: 모바일 디자인 URL 입력
  → 모바일 스타일 반영, 이미지 추출
  → 컴포넌트 리팩토링 (모바일 기준)
  → 🔄 검증 루프 (Figma vs 코드 비교, P1=0까지)
        ↓
Step C: PC 디자인 URL 입력
  → PC 스타일 반영 (반응형 clamp/breakpoint 추가)
  → 이미지 추출 (PC용 에셋)
  → 컴포넌트 리팩토링 (PC 대응)
  → 🔄 검증 루프 (Figma vs 코드 비교, P1=0까지)
        ↓
Step D: 최종 공통화 리팩토링
  → 모바일/PC 스타일 공통 토큰 추출
  → 중복 코드 통합
  → 유사 컴포넌트 variant 통합 (80% rule)
  → 🔄 최종 검증 루프 (양쪽 뷰포트 동시 검증)
```

### 단계별 URL 입력 (AskUserQuestion — options 사용 금지, 자유 텍스트만)

```
각 Step에서 AskUserQuestion으로 하나씩 입력:
  ⚠️ 절대 선택지(options)를 제공하지 않는다. 순수 텍스트 입력만.
  ⚠️ 각 질문의 응답을 받은 후에만 다음으로 진행.

Step A: "📋 스토리보드 Figma URL을 입력해주세요. (없으면 '없음')"
  → ⏸️ 응답 대기
  → URL 또는 "없음"

Step B: "📱 모바일 디자인 Figma URL을 입력해주세요."
  → ⏸️ 응답 대기
  → URL 저장 + 추출 + 스타일 반영 + 검증

Step C: "🖥️ PC 디자인 Figma URL을 입력해주세요. (없으면 '없음')"
  → ⏸️ 응답 대기
  → URL 또는 "없음" (없으면 single viewport mode)

디자인 URL이 1개만이면: 단일 뷰포트 (Step B만 실행, Step C 스킵)
디자인 URL이 2개이면: 반응형 (Step B + C + D)
```

### Mode

| Mode | 조건 | 동작 |
|------|------|------|
| **Project integration** | 기본값 | 기존 디자인 시스템/토큰 활용, 프로젝트 컨벤션 준수 |
| **--new** | 플래그 지정 시 | 자체 완결 토큰 + 컴포넌트, 기존 디자인 시스템 무관 |
| **--refine** | 플래그 지정 시 | 기존 코드를 Figma 재비교 → 부족한 부분만 수정 |

## Context Reset

**이 커맨드 실행 시 이전 대화 무시.**
- Figma 데이터 + 프로젝트 스택 기반으로 판단
- 스토리보드 스펙이 디자인과 충돌 시 → 스토리보드 우선

---

> **⏱️ Timer**: Call `getCurrentTime` tool at the START. Record the result as `{start_time}`.

## Step A: 스토리보드 + Base 구조

Load and execute skill `vibe-figma`.

## Step B: 모바일 디자인 반영

Load and execute skill `vibe-figma-mobile`.

## Step C: PC 디자인 반영 (반응형)

Load and execute skill `vibe-figma-desktop`.

## Step D: 최종 공통화 리팩토링

Load and execute skill `vibe-figma-consolidate`.

## 코드 생성 규칙 (각 Step에서 필요 시 참조)

| Skill | 내용 | 참조 시점 |
|-------|------|----------|
| `vibe-figma-rules` | 분석/감지 (Phase 1-3, Model Routing) | Step A, B, C |
| `vibe-figma-style` | 스타일 아키텍처 (토큰, SCSS, 네이밍) | Step B, C, D |
| `vibe-figma-codegen` | 코드 생성 (마크업, 스택별 룰, 이미지, 검증) | Step B, C, D |

## Design Quality Pipeline

코드 생성 완료 후 — Load and execute skill `vibe-figma-pipeline`.
