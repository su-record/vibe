---
description: Figma design to code — 스토리보드(기능) + 디자인(비주얼) → 프로덕션 코드
argument-hint: ""
---

# /vibe.figma

Figma 디자인 → 프로덕션 코드. 스토리보드로 기능 구조를 잡고, 디자인 URL에서 이미지와 CSS를 추출.

## Usage

```
/vibe.figma                  # 인터랙티브 모드 (단계별 URL 입력)
/vibe.figma --new            # 새 피처 모드 (기존 디자인 시스템 무시)
/vibe.figma --refine         # 보완 모드 (기존 코드 + Figma 재비교 → 수정)
```

## Flow

```
Phase 0: Setup
  → 스택 감지, 디렉토리 생성, 피처명 결정

Phase 1: 스토리보드 (선택)
  → "스토리보드 Figma URL을 입력해주세요. (없으면 '없음')"
  → 레이아웃 + 컴포넌트 구성 + 기능 요구사항 JSDoc 주석

Phase 2: 디자인 (핵심)
  → "베이스 디자인(모바일) Figma URL을 입력해주세요."
  → 섹션별: get_design_context → 이미지 다운로드 → CSS 스타일 작성 → template 리팩토링
  → "다음 브레이크포인트 디자인 URL을 입력해주세요. (없으면 '없음')"
  → ... 반복 (반응형 추가)
  → "없음" → Phase 3

Phase 3: 검증
  → Grep 자동 체크 + 스크린샷 비교 + P1=0까지 수정
```

### URL 입력 규칙

```
AskUserQuestion 사용 시 절대 선택지(options) 제공 금지. 자유 텍스트만.
각 질문의 응답을 받은 후에만 다음으로 진행.
```

## Context Reset

**이 커맨드 실행 시 이전 대화 무시.**
스토리보드 스펙 > 디자인 데이터 > 프로젝트 컨벤션 순으로 우선.

---

> **Timer**: Call `getCurrentTime` tool at the START. Record as `{start_time}`.

## Phase 0~1: Setup + Storyboard

Load skill `vibe.figma` — Phase 0 Setup + Phase 1 Storyboard

## Phase 2: Design

Load skill `vibe.figma` — Phase 2 Design (비정형 레이어 감지 + 큰 섹션 분할 포함)

섹션별 처리 시 참조:
- Load skill `vibe.figma.extract` — 이미지 다운로드 + CSS 값 추출 방법
- Load skill `vibe.figma.convert` — 참조 코드 → 프로젝트 코드 변환 (직역 모드 / 일반 모드)

## Phase 3: Verification

Load skill `vibe.figma` — Phase 3 Verification
