---
description: 프로젝트 시작 진입점 — 무엇을 개발할지 대화로 시작해서 discover → plan → spec/figma로 오케스트레이션
argument-hint: "(선택) project or feature idea"
---

# /vibe.go

**vibe 워크플로 통합 진입점.** "무엇을 개발할지" 질문으로 시작해서 `vibe.discover` → `vibe.plan` → `/vibe.spec` + `/vibe.figma` 순서로 전체 흐름을 오케스트레이션한다.

## Usage

```
/vibe.go                              # 빈 시작 — "무엇을 만들까요?"부터
/vibe.go "패럴랙스 웹사이트"              # 아이디어 지정 시작
/vibe.go "docs/idea.md"               # 파일 기반 시작
/vibe.go + 📎 첨부                     # 첨부 기반 시작
```

## Philosophy

> **사용자는 "무엇을 만들지"만 말하면 된다. 어떤 커맨드/스킬을 언제 부를지는 vibe가 결정한다.**

- **단일 진입점**: 사용자가 `/vibe.*` 커맨드 이름을 외울 필요 없음
- **자동 체이닝**: discover → plan → spec/figma까지 스킬 `chain-next` 메타데이터 따라 자동 진행
- **분기 판단**: 기획서의 `type` 필드로 UI 트랙/로직 트랙 여부 결정
- **사용자 제어**: 각 단계 사이에 사용자 확인 지점(stop gate) 제공

## Flow

```
/vibe.go ["idea"?]
    ↓
Phase 0: Git branch setup
    ↓
Phase 1: Discover (skill: vibe.discover)
    - 빈 입력이면 "무엇을 만들고 싶으신가요?" 질문부터
    - 타입 감지 → 체크리스트 로드 → 반복 인터뷰 → stop 제어
    - 출력: .claude/vibe/discovery/{feature}.md
    ↓
    [사용자 확인] "기획서로 정리할까요?"
    ↓
Phase 2: Plan (skill: vibe.plan)
    - discovery → 기획서 정제
    - 출력: .claude/vibe/plans/{feature}.md
    ↓
    [사용자 확인 + 분기 판단]
    기획서 type 읽고 경로 결정:
      - website/webapp/mobile → UI + Logic 병렬
      - api/library/feature-data → Logic 만
    ↓
Phase 3a: Logic Track
    - /vibe.spec "{plan path}" → /vibe.spec.review → /vibe.run
    ↓
Phase 3b: UI Track (UI 프로젝트일 때만, 3a와 병렬)
    - /vibe.figma (기획서를 스토리보드 컨텍스트로 전달)
    ↓
Phase 4: Verify (/vibe.verify, 추후 확장)
    ↓
Phase 5: Trace (/vibe.trace)
    ↓
Done
```

## Rules Reference

**`~/.claude/vibe/rules/` (global) 준수:**

- `core/development-philosophy.md`
- `core/quick-start.md` — Korean first
- `core/communication-guide.md`

## Process

> **⏱️ Timer**: 시작 시 `getCurrentTime` 호출, `{start_time}`로 기록.

### Phase 0: Git Branch Setup (MANDATORY)

```bash
git branch --show-current
```

| 현재 | 행동 |
|-----|-----|
| `main`/`master` | 사용자에게 임시 이름 받은 후 `git checkout -b vibe/{temporary-name}` (discovery 후 정식 브랜치로 리네임) |
| `vibe/*`, `feature/*`, `discover/*` | 확인: "이 브랜치에서 계속?" |
| 기타 | 사용자 확인 |

### Phase 1: Discover

**진입 방식:**

1. **인자 있음** (`/vibe.go "아이디어"`)
   → `vibe.discover` 스킬 로드 + 아이디어 전달

2. **인자 없음** (`/vibe.go`)
   → 먼저 질문:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   👋 무엇을 만들고 싶으신가요?
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   예:
   - "패럴랙스 웹사이트"
   - "할 일 관리 앱"
   - "Stripe 결제 연동 API"
   - "React 훅 라이브러리"
   - 또는 자유롭게 설명

   (파일/이미지 첨부도 가능)
   ```
   → 사용자 응답 → `vibe.discover` 스킬 로드

**스킬 로드:**

```
Load skill `vibe.discover` with input: {user_idea}
```

`vibe.discover` 스킬이 자체적으로:
- 프로젝트 타입 감지
- 타입별 체크리스트 로드
- 반복 인터뷰 실행
- `.claude/vibe/discovery/{feature-name}.md` 저장

**Stop Gate 1**: Discovery 완료 후

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Discovery 완료
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 .claude/vibe/discovery/{feature}.md

다음 단계: 기획서 작성
  1. 계속 진행 (기본)
  2. Discovery만 저장하고 종료
  3. Discovery 수정 후 다시 (vibe.discover 재실행)

Enter → 계속
```

### Phase 2: Plan

```
Load skill `vibe.plan` with input: .claude/vibe/discovery/{feature}.md
```

`vibe.plan` 스킬이 자체적으로:
- 템플릿 로드
- 섹션별 정제
- UI 섹션 조건부 포함
- `.claude/vibe/plans/{feature}.md` 저장

**Stop Gate 2**: 기획서 완료 후 + 분기 판단

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 기획서 완성
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 .claude/vibe/plans/{feature}.md
Type: {type}

{type ∈ UI}:
자동 경로: Logic Track + UI Track 병렬 실행
  1. 계속 (권장)
  2. Logic Track만 (/vibe.spec → /vibe.run)
  3. UI Track만 (/vibe.figma)
  4. 여기서 종료

{type ∈ non-UI}:
자동 경로: Logic Track
  1. 계속 (권장)
  2. 여기서 종료

Enter → 계속
```

### Phase 3a: Logic Track

```
/vibe.spec ".claude/vibe/plans/{feature}.md"
    ↓ (완료)
/vibe.spec.review "{feature}"
    ↓ (완료)
/vibe.run "{feature}"
```

**참고**: `/vibe.spec`과 `/vibe.spec.review`는 thin wrapper가 되어 내부적으로 `vibe.spec` / `vibe.spec.review` 스킬을 로드 (P2 PR에서 전환 예정).

### Phase 3b: UI Track (type ∈ {website, webapp, mobile}일 때만)

**3a와 병렬 실행** (또는 순차 — 사용자 선택):

```
/vibe.figma
```

**`/vibe.figma`에 전달할 컨텍스트:**

- `.claude/vibe/plans/{feature}.md` 경로
- 기획서의 §7 Look & Feel, §8 레이아웃, §9 반응형 섹션을 Phase 1 스토리보드 입력으로 사용

**참고**: `/vibe.figma`의 기획서 자동 입력 지원은 추후 확장 (현재는 수동 안내).

### Phase 4: Verify (추후 확장)

현재: 기존 `/vibe.verify` 호출.
추후 (P2+ PR): UI + 로직 + 연결 3축 검증으로 확장.

### Phase 5: Trace

```
/vibe.trace "{feature}"
```

SPEC ↔ 구현 추적.

## Example Session

```
User: /vibe.go

Claude:
🌿 브랜치: main → vibe/tmp (discovery 후 정식 리네임)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👋 무엇을 만들고 싶으신가요?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

예: "패럴랙스 웹사이트", "할 일 앱", ...

User: 원두 브랜드 프로모션 랜딩 페이지

Claude: [vibe.discover 스킬 로드됨]
        Type: website 감지
        체크리스트 로드: website.md (Required 8 + Optional 14)

        먼저 배경부터 여쭤볼게요.
        이 랜딩 페이지를 만드는 목적은 신제품 런칭인가요, 브랜드 일반
        홍보인가요, 아니면 이벤트 전용인가요?

User: 신제품 런칭

[10-20 질문 진행, Required 8/8 완료, Optional 4/14 수집, 사용자 "그만"]

Claude: ✅ Discovery 완료
        📄 .claude/vibe/discovery/parallax-bean-launch.md

        계속 기획서로 정리할까요? [Enter]

User: [Enter]

Claude: [vibe.plan 스킬 로드됨]
        템플릿 로드 → 섹션 정제 → UI 섹션 포함

        ✅ 기획서 완성
        📄 .claude/vibe/plans/parallax-bean-launch.md
        Type: website

        자동 경로: Logic Track + UI Track 병렬 실행
        계속하시겠습니까? [Enter]

User: [Enter]

Claude: [Phase 3a + 3b 병렬 시작]
        Logic: /vibe.spec 호출 중...
        UI:    /vibe.figma Phase 1 스토리보드 준비 중...
```

## Rollback / Resume

- 각 Phase 종료 시 상태가 `.claude/vibe/discovery/`, `.claude/vibe/plans/` 등에 저장됨
- 중단 시 다시 `/vibe.go`로 돌아오면 이어서 진행 가능
- 수동 개입 필요시 직접 커맨드 사용 가능 (`/vibe.spec`, `/vibe.figma` 등)

## Next Step

```
# 전형적인 사용
/vibe.go "프로젝트 아이디어"

# 또는 하위 단계 직접 호출
/vibe.spec "path/to/plan.md"
/vibe.figma
```

---

ARGUMENTS: $ARGUMENTS
