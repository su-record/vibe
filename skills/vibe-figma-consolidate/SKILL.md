---
name: vibe-figma-consolidate
description: Step D — 모바일/PC 스타일 공통화, 컴포넌트 통합, 최종 검증, 후처리 파이프라인
triggers: []
tier: standard
---

# Skill: vibe-figma-consolidate — Step D: 공통화 + 최종 검증

> **실행 지시: Edit 도구로 기존 파일을 실제 수정한다.**

## D-1. 스타일 공통화

```
1. 모바일/PC에서 동일한 값 → 공통 토큰으로 추출
2. 중복 CSS/SCSS 규칙 통합
3. 컴포넌트 내 중복 로직 제거
```

| 유형 | 처리 방법 |
|------|----------|
| 색상 (동일) | 공통 CSS custom property |
| 타이포 (동일 scale) | 공통 토큰 유지 |
| 간격 (다름) | clamp() fluid 토큰 (계산: vibe-figma-rules R-3) |
| 레이아웃 방향 (다름) | @media 분기 유지 |
| 컴포넌트 구조 (동일) | 하나로 통합 |

## D-2. 컴포넌트 통합

80% Rule 및 variant 통합 기준은 **vibe-figma-rules R-5** 참조.

```
1. 유사 컴포넌트 (80%+) → variant prop 통합
2. 중복 sub-component → 공유 컴포넌트 추출
3. 불필요한 래퍼 → Fragment/template 제거
```

## D-3. 최종 검증

검증 공통 프로세스는 **vibe-figma-rules R-6** 참조.

### Step D 추가 검증

```
양쪽 뷰포트 동시 검증:
  - 모바일 Figma vs 코드 (mobile viewport)
  - PC Figma vs 코드 (desktop viewport)
  - 양쪽 모두 P1=0, Match Score 95%+
  - 이미지 에셋 전부 정상 표시
  - 공통 토큰으로 중복 제거 완료
```

### Model Routing (Step D)

| 작업 | 모델 |
|------|------|
| 공통화 리팩토링 + 최종 검증 | **Sonnet** |
| Post — 코드 리뷰 | **gpt-5.3-codex** (Codex 미설치 시 스킵) |

## D-4. Design Quality Pipeline (후처리)

Step D 완료 후 사용자에게 다음 단계를 제시.

### Pre-requisite check

`.claude/vibe/design-context.json`이 없으면:
```
디자인 컨텍스트가 없습니다. /design-teach 를 먼저 실행하면
브랜드, 접근성, 타겟 디바이스에 맞춘 더 정확한 코드를 생성할 수 있습니다.
```

### Quick (기본 추천)

```
/design-normalize → /design-audit
```
- Normalize: 하드코딩 값 → MASTER.md 토큰으로 치환
- Audit: A11Y + 성능 + 반응형 + AI Slop 검출

### Thorough (프로덕션 추천)

```
/design-normalize → /design-audit → /design-critique → /design-polish
```
- + Critique: Nielsen 10 휴리스틱 + 페르소나 분석
- + Polish: 인터랙션 상태 보완 (hover/focus/loading/error)

### 출력 포맷

```markdown
## Design Quality Pipeline

생성된 파일: {file list}

추천 다음 단계:
  1. /design-normalize  — 토큰 정렬
  2. /design-audit      — 기술 품질 검사
  3. /design-critique    — UX 휴리스틱 리뷰
  4. /design-polish      — 최종 인터랙션 보완
```
