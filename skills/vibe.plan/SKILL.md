---
name: vibe.plan
tier: core
description: "Refine a vibe.interview result into a human-readable markdown 기획서 (planning document). The plan is a vision document that downstream skills/commands use: /vibe.spec consumes it for code implementation, /vibe.figma uses it for UI storyboards. Must use this skill after vibe.interview completes, or when the user has raw interview notes and wants a structured plan document."
triggers: [기획서, 기획서 작성, plan document, 기획 정리, "interview 정리", refine plan]
priority: 90
chain-next: [vibe.spec, vibe.figma]
---

# vibe.plan — Interview → 기획서 정제

> **Principle**: interview의 raw 문답을 **사람이 읽는 비전 문서**로 정제한다. PTCF/EARS/Phase 같은 AI 실행 구조는 `/vibe.spec`의 역할이다.

## When to Use

- `vibe.interview`가 방금 완료되어 `.claude/vibe/interviews/{feature}.md`가 존재
- 사용자가 "기획서 써줘", "interview 정리해줘"라고 요청
- 외부 PRD/와이어프레임을 기반으로 vibe 기획서 포맷으로 변환 필요

**건너뛰기**:
- interview 없이 이 스킬을 직접 호출하면 → `vibe.interview` 먼저 체인 (chain-prev 없음, 사용자에게 안내)

## Core Flow

```
1. interview 파일 읽기
   .claude/vibe/interviews/{feature}.md
     ↓
2. 템플릿 로드
   ~/.claude/vibe/templates/plan-template.md
     ↓
3. 섹션별 정제
   - Required 응답 → 본문 섹션
   - Optional 응답 → 본문 + "Assumptions"
   - TBD 항목 → "Open Questions"
   - Discovered → 해당 섹션에 통합
     ↓
4. UI 섹션 조건부 포함
   type ∈ {website, webapp, mobile} → Look&Feel/레이아웃/반응형 포함
   type ∈ {api, library, feature-data} → 생략
     ↓
5. 기획서 저장
   .claude/vibe/plans/{feature}.md
     ↓
6. Handoff 안내
   다음 단계: /vibe.spec, /vibe.figma, 병렬
```

## Step 1: Interview 파일 읽기

```
Read .claude/vibe/interviews/{feature-name}.md
```

프런트매터에서 `type`, `status`, `requiredCollected`, `optionalCollected` 등을 추출.

**검증**:
- `status: partial` + Required 미완료 → 사용자에게 경고:
  ```
  ⚠️ Interview가 부분 완료입니다 (Required N개 미수집).
  기획서에는 해당 항목이 "TBD"로 표시됩니다.
  계속할까요? (y/N)
  ```
- 파일이 없으면 → `vibe.interview` 먼저 실행하도록 안내.

### `.last-feature` 포인터 갱신

```
Write ".claude/vibe/.last-feature" ← feature-name (한 줄)
interview 파일에서 feature name을 추출한 직후 실행한다.
이미 같은 값이면 no-op.
```

## Step 2: 템플릿 로드

```
Read ~/.claude/vibe/templates/plan-template.md
```

템플릿은 12개 섹션 구조:

| # | 섹션 | 모든 타입 | UI 타입만 |
|---|-----|---------|---------|
| 1 | 개요 (Overview) | ✅ | |
| 2 | 배경 (Why) | ✅ | |
| 3 | 타깃 사용자 (Who) | ✅ | |
| 4 | 목표 & 성공 기준 | ✅ | |
| 5 | 핵심 기능/섹션 | ✅ | |
| 6 | 범위 & 비범위 | ✅ | |
| 7 | Look & Feel | | ✅ |
| 8 | 레이아웃/섹션 구성 | | ✅ |
| 9 | 반응형 전략 | | ✅ |
| 10 | 기술 스택 & 제약 | ✅ | |
| 11 | 가정 & 리스크 | ✅ | |
| 12 | 다음 단계 (Handoff) | ✅ | |

## Step 3: 섹션별 정제 매핑

Interview 항목 → 기획서 섹션 매핑 규칙:

### 공통 매핑

| Interview 항목 | 기획서 섹션 |
|--------------|----------|
| `R1. purpose` | §2 배경 (Why) |
| `R2. target-users` | §3 타깃 사용자 |
| `R3. core-message` / `R3. core-features` / `R3. core-endpoints` | §5 핵심 기능/섹션 |
| `R4. required-sections` / `R4. data-model` / `R4. core-api` | §5 핵심 기능/섹션 |
| `R7/R8. success-metric` | §4 목표 & 성공 기준 |
| `R6/R7. tech-constraints` / `tech-stack` | §10 기술 스택 & 제약 |

### UI 타입 (website/webapp/mobile) 추가 매핑

| Interview 항목 | 기획서 섹션 |
|--------------|----------|
| `R5. brand-tone` + `O1. reference-sites` + `O2. color-direction` + `O3. typography-preference` + `O4. animation-level` | §7 Look & Feel |
| `R4. required-sections` (website) / `R4. core-features` (webapp) | §8 레이아웃/섹션 구성 |
| `O5. responsive-strategy` + `O6/O8. accessibility-level` | §9 반응형 전략 |

### 공통 Post-처리

- `interview.TBD[]` → §11 "가정 & 리스크" 또는 문서 끝 "Open Questions"
- `interview.discovered[]` → 관련 섹션에 통합 + "Discovered during interview" 주석
- 모든 Optional 미수집 항목 → §11 "가정"에 기본값으로 기록 (예: "접근성: WCAG AA 가정")

## Step 4: UI 섹션 조건부 포함

```python
if interview.type in {"website", "webapp", "mobile"}:
    include_sections = [1..12]  # 전체
else:  # api, library, feature-data
    include_sections = [1..6, 10..12]  # §7-9 (Look&Feel/레이아웃/반응형) 생략
    # §5에 "UI 없음 — API/라이브러리 프로젝트" 명시
```

## Step 5: 기획서 저장

**출력 경로**: `.claude/vibe/plans/{feature-name}.md`

**프런트매터**:

```yaml
---
feature: {feature-name}
type: {website | webapp | mobile | api | library | feature}
status: draft
createdAt: {ISO-timestamp}
lastUpdated: {ISO-timestamp}
source: .claude/vibe/interviews/{feature-name}.md
downstream: [spec, figma]  # or [spec] for non-UI
---
```

**본문**: 템플릿 구조 + 정제된 내용.

**품질 기준**:
- 한 섹션 = 읽는 데 30초 이하
- 불릿 3-7개 수준으로 압축
- 기술 용어 최소화 (사람이 읽는 비전 문서)
- "TBD"는 굵게 표시해서 후속 결정이 필요함을 명확히

## Step 6: Handoff 안내

기획서 저장 후 사용자에게 다음 단계 안내:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 기획서 완성!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 .claude/vibe/plans/{feature-name}.md
   섹션: {N}개 작성
   TBD: {M}개 (추후 결정)

Type: {type}

다음 단계:

  [UI 프로젝트: website/webapp/mobile]
  1. /vibe.spec ".claude/vibe/plans/{feature-name}.md"
     → 코드 명세 작성 → /vibe.run 구현
  2. /vibe.figma
     → Figma 디자인 → FE UI 코드
  3. 병렬 실행 (권장)
     → 기능 + 디자인 → 웹사이트 프로토타입

  [비-UI: api/library]
  1. /vibe.spec ".claude/vibe/plans/{feature-name}.md"
     → 코드 명세 → /vibe.run 구현

어떤 것부터 시작할까요?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Anti-Patterns

- ❌ PTCF 구조로 작성 (그건 /vibe.spec의 역할)
- ❌ EARS 포맷 (WHEN/THEN) 사용
- ❌ 파일 목록, Phase 분할, Acceptance Criteria 포함
- ❌ Tech Stack을 과하게 상세히 — 상위 수준만
- ❌ TBD를 숨기기 — 명시적으로 드러내야 다음 단계에서 결정
- ❌ Interview 없이 이 스킬만 실행 (raw 정보 부재)
- ❌ 비-UI 프로젝트에 Look&Feel 섹션을 억지로 채우기

## Related

- **Prev**: `vibe.interview` — 요구사항 수집 (chain-prev 암묵)
- **Next**: `/vibe.spec` (코드 명세), `/vibe.figma` (UI 디자인)
- **Template**: `~/.claude/vibe/templates/plan-template.md`
