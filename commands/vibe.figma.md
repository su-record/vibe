---
description: Figma design to code — extract + generate in one step
argument-hint: ""
---

# /vibe.figma

Figma 디자인 + 스토리보드 → 프로덕션 코드. **프레임별 점진적 빌드** 방식.

## Usage

```
/vibe.figma                  # 인터랙티브 모드 (단계별 URL 입력)
/vibe.figma --new            # 새 피처 모드 (기존 디자인 시스템 무시)
/vibe.figma --refine         # 보완 모드 (기존 코드 + Figma 재비교 → 수정)
```

## Incremental Build Flow

```
Step A: 스토리보드 URL 입력 (선택)
  → 기능 정의, 인터랙션, 브레이크포인트 추출
  → 실제 동작하는 레이아웃 코드 + 기능 주석 생성
  → 스타일 없이 클릭/팝업/상태 전환 동작하는 수준
        ↓
Step B: 디자인 URL 입력 → 프레임별 추출 → 코드 반영 → 검증
  → 🔄 검증 루프 (P1=0까지)
  → "추가 디자인 URL이 있나요?"
        ↓ (있으면 반복)
Step B: 추가 디자인 URL → 반응형 레이어 추가 → 검증
  → 🔄 검증 루프 (양쪽 뷰포트 P1=0까지)
  → "추가 디자인 URL이 있나요?"
        ↓ (없으면)
Step C: 최종 공통화 리팩토링
  → 토큰 통합, 중복 제거, variant 통합
  → 🔄 최종 검증 루프
```

### URL 입력 규칙

```
⚠️ AskUserQuestion 사용 시 절대 선택지(options) 제공 금지. 자유 텍스트만.
⚠️ 각 질문의 응답을 받은 후에만 다음으로 진행.

Step A: "📋 스토리보드 Figma URL을 입력해주세요. (없으면 '없음')"
  → ⏸️ 응답 대기

Step B (반복):
  "🎨 디자인 Figma URL을 입력해주세요."
  → ⏸️ 응답 대기 → 프레임별 추출 + 코드 반영 + 검증
  → 검증 완료 후:
  "🎨 추가 디자인 URL이 있나요? (없으면 '없음')"
  → ⏸️ 응답 대기
  → URL 입력: 반응형 레이어 추가 → 검증 → 다시 "추가?" 질문
  → "없음": Step C로 진행
```

### Mode

| Mode | 동작 |
|------|------|
| **기본** | 기존 디자인 시스템/토큰 활용 |
| **--new** | 자체 완결 토큰, 기존 시스템 무관 |
| **--refine** | 기존 코드를 Figma 재비교 → 수정만 |

## Context Reset

**이 커맨드 실행 시 이전 대화 무시.**
스토리보드 스펙 > 디자인 데이터 > 프로젝트 컨벤션 순으로 우선.

---

> **⏱️ Timer**: Call `getCurrentTime` tool at the START. Record the result as `{start_time}`.

## Step A: 스토리보드 + Base 구조

1. Load skill `vibe-figma` — 스토리보드 URL 입력 + MCP 추출
2. Load skill `vibe-figma-analyze` — 세밀 분석 → 동작하는 레이아웃 코드 + 기능 주석

## Step B: 디자인 반영 (반복)

Load skill `vibe-figma-frame` — 디자인 URL → 프레임별 추출 → 코드 반영 → 검증 루프

- 첫 번째 URL: base 스타일 적용
- 추가 URL: 반응형 레이어 추가 (clamp + @media)
- URL이 더 없을 때까지 반복

## Step C: 최종 공통화

Load skill `vibe-figma-consolidate` — 토큰 통합 + 중복 제거 + 최종 검증

## 코드 생성 규칙 (각 Step에서 필요 시 참조)

| Skill | 내용 | 참조 시점 |
|-------|------|----------|
| `vibe-figma-rules` | 분석/감지 (Model Routing, Phase 1-3) | Step A, B |
| `vibe-figma-style` | 스타일 (토큰, SCSS, 클래스 네이밍) | Step B, C |
| `vibe-figma-codegen` | 코드 생성 (마크업, 이미지, 반응형, 검증) | Step B, C |

## Design Quality Pipeline

코드 생성 완료 후 — Load skill `vibe-figma-pipeline`
