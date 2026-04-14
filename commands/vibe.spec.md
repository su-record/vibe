---
description: 프로젝트 명세 통합 진입점 — interview → plan → spec → review → run/figma 전체 워크플로 오케스트레이션
argument-hint: "(선택) feature name, plan/interview file path, or idea"
---

# /vibe.spec

**vibe 워크플로 통합 진입점.** "무엇을 개발할지" 질문으로 시작해서 interview → plan → SPEC 작성 → review → 구현 + UI 디자인까지 전체 흐름을 오케스트레이션한다.

## Usage

```
/vibe.spec                                       # 빈 시작 — "무엇을 만들까요?"부터
/vibe.spec "패럴랙스 웹사이트"                     # 아이디어/피처명 지정 시작
/vibe.spec ".claude/vibe/plans/{feature}.md"     # 기획서 입력 (plan 단계 스킵)
/vibe.spec ".claude/vibe/interviews/{feature}.md" # interview 입력 (interview 단계 스킵)
/vibe.spec "docs/prd.md"                         # 외부 PRD/아이디어 파일 입력
/vibe.spec + 📎 첨부                              # 첨부 기반 시작
/vibe.spec "feature-name" ultrawork              # 중단 게이트 없이 자동 전 흐름 실행
```

## Philosophy

> **사용자는 "무엇을 만들지"만 말하면 된다. 어떤 스킬을 언제 부를지는 vibe가 결정한다.**

- **단일 진입점**: `/vibe.spec` 하나로 전체 워크플로 시작. 다른 `/vibe.*` 커맨드 이름 외울 필요 없음.
- **Smart resume**: 기존 interview/plan/spec 파일 존재 여부로 어느 단계부터 시작할지 자동 판단.
- **자동 체이닝**: 스킬 `chain-next` 메타데이터 따라 vibe-interview → vibe-plan → vibe-spec → vibe-spec-review 진행.
- **분기 판단**: 기획서의 `type` 필드로 UI 트랙/로직 트랙 여부 결정.
- **사용자 제어**: 각 단계 사이에 사용자 확인 지점(stop gate) 제공 (ultrawork 모드는 스킵).

## Flow

```
/vibe.spec ["input"?]
    ↓
Phase 0: Git branch setup
    ↓
Phase 0.5: Input 분석 + Smart resume 결정
    - 첨부/파일/아이디어 감지
    - 기존 .claude/vibe/{interviews,plans,specs}/ 확인
    - 시작 단계 결정: interview | plan | spec | review
    ↓
Phase 1: Interview (skill: vibe-interview)
    - 조건: interview 파일 없음
    - 사용자 "그만"까지 반복 인터뷰
    - 출력: .claude/vibe/interviews/{feature}.md
    ↓
    [Stop Gate 1] — ultrawork 모드에서는 스킵
    ↓
Phase 2: Plan (skill: vibe-plan)
    - 조건: plan 파일 없음
    - interview → 마크다운 기획서 정제
    - 출력: .claude/vibe/plans/{feature}.md
    ↓
    [Stop Gate 2 + 분기 판단]
    기획서 type 읽고 경로 결정:
      - website/webapp/mobile → UI + Logic 병렬
      - api/library/feature-data → Logic만
    ↓
Phase 3: SPEC 작성 (skill: vibe-spec)
    - PTCF 구조 SPEC 문서 + Feature(BDD) 파일
    - Parallel research (GPT/Gemini/Claude agents)
    - Large scope 자동 분할
    - Ambiguity scan + 품질 게이트(100점, 수렴까지 루프)
    - 출력: .claude/vibe/specs/{feature}.md + .claude/vibe/features/{feature}.feature
    ↓
Phase 4: SPEC Review (skill: vibe-spec-review)
    - Race Review (GPT + Gemini, 라운드 수 캡 없음, 수렴까지 루프)
    - (옵션) Codex adversarial review
    - 사용자 최종 체크포인트
    ↓
Phase 5a: Logic Track → /vibe.run
Phase 5b: UI Track (병렬, UI 프로젝트만) → /vibe.figma
    ↓
Phase 6: Verify (/vibe.verify)
Phase 7: Trace (/vibe.trace)
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
| `main`/`master` | 임시 이름으로 `git checkout -b vibe/tmp` (이후 feature 이름 확정되면 리네임) |
| `feature/*`, `plan/*`, `interview/*`, `vibe/*` | 확인: "이 브랜치에서 계속?" |
| 기타 | 사용자 확인 |

### Phase 0.5: Input 분석 + Smart Resume

**입력 우선순위:**

```
1. 📎 첨부 파일 있음? → 첨부 분석 → feature name 추출
2. 인자가 파일 경로? → 파일 위치로 시작 단계 결정:
     .claude/vibe/interviews/*.md → Phase 2 (plan)
     .claude/vibe/plans/*.md      → Phase 3 (spec)
     .claude/vibe/specs/*.md      → Phase 4 (review)
     기타 (.md/.txt/.pdf)         → Phase 2 (plan, 외부 PRD 흡수)
3. 인자가 feature name? → .claude/vibe/에서 기존 파일 검색
     existing spec → "리뷰 재실행? 이어서? 재작성?" 물음
     existing plan → Phase 3 (spec)
     existing interview → Phase 2 (plan)
     아무것도 없음 → Phase 1 (interview)
4. 인자 없음 → Smart Resume Fallback 알고리즘 실행 (아래 참조)
```

#### Smart Resume Fallback (인자 없는 `/vibe.spec` 호출 시)

**목적**: feature 이름을 기억하지 못해도 진행 중 작업을 자동 발견해서 이어서 진행할 수 있게 한다.

```
알고리즘:

Step 1) .claude/vibe/.last-feature 확인 (pointer 파일)
  - 파일 없음 → Step 2로
  - 존재 → 해당 feature의 상태 요약 출력 + 확인 질문:
      "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       🔄 마지막 작업: {feature-name}
       ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       ✅ interview: .claude/vibe/interviews/{feature}.md  (status: complete, N일 전)
       ✅ plan:      .claude/vibe/plans/{feature}.md       (N일 전)
       ❌ spec:      없음
       → 다음 단계: Phase 3 (vibe-spec 스킬 — SPEC 작성)

       이어서 진행할까요?
         Enter / yes → 이어서 진행
         list        → 다른 진행 중 작업 목록 보기
         new         → 새 아이디어로 시작
         abort       → 종료"

  - yes → Phase 0.5의 인자 분석 경로 3번 (feature name)으로 진입
  - list → Step 2로
  - new → Step 3으로
  - abort → 종료

Step 2) 진행 중 작업 목록 표시 (.claude/vibe/ 디렉토리 스캔)
  수집:
    features = {} (feature name → {hasInterview, hasPlan, hasSpec, mtime})
    for each file in .claude/vibe/interviews/*.md:
      feature = basename without .md
      features[feature].hasInterview = true
      features[feature].interviewMtime = file.mtime
      features[feature].interviewStatus = frontmatter의 status (complete/partial)
    동일하게 plans/*.md, specs/*.md 스캔

  정렬: 가장 최근 작업 (max mtime) 순
  최대 10개까지 표시

  진행 중 작업 0개 → Step 3으로
  1개 이상 → 목록 출력 + 선택 질문:
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     🔍 진행 중인 작업
     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

     1. bean-landing      [interview: partial]        2일 전
     2. todo-app          [plan: complete]            어제
     3. payment-api       [spec: complete]            방금 전
     ─────────────────────────────────────────────
     n. ➕ 새로 시작
     a. 종료

     선택 번호 또는 feature 이름을 입력하세요:"

  사용자 응답 처리:
    - 숫자 (1~N) → 해당 feature 선택 → 인자 분석 경로 3번으로
    - 정확한 feature 이름 → 인자 분석 경로 3번으로
    - "n" 또는 "new" → Step 3으로
    - "a" 또는 "abort" → 종료
    - 자유 텍스트 (매칭 없음) → "{입력}은 기존 feature가 아닙니다. 새로 시작할까요? (y/n)" 확인

Step 3) 빈 시작 (기존 동작)
  "👋 무엇을 만들고 싶으신가요?" 질문 → Phase 1 (interview)
```

#### `.last-feature` 포인터 파일 갱신 규칙

```
경로: .claude/vibe/.last-feature
형식: 한 줄, feature name만 저장
     예: "bean-landing\n"

⚠ 이 파일은 **개인 작업 포인터**이므로 git에 커밋하지 않는다.
   `.gitignore` 에 `.claude/vibe/.last-feature` 엔트리 필수.

갱신 시점:
  - Phase 1 (interview) 진입 시 → feature name 결정되면 즉시 기록
  - Phase 2 (plan) 진입 시 → 기록 (이미 맞으면 no-op)
  - Phase 3 (spec) 진입 시 → 기록
  - Phase 4 (review) 진입 시 → 기록

즉, 어느 Phase에서 멈추든 다음 /vibe.spec 호출 시 이 feature가 1순위로 제안된다.

삭제 시점:
  - Phase 7 (trace) 완료 시 → 파일 삭제 (워크플로 완주)
  - 사용자가 명시적으로 종료/abort 선택 시 → 삭제하지 않음 (재개 가능하게)
```

**출력 예시:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 Input 분석
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

입력: "패럴랙스 웹사이트"
분류: 신규 아이디어
기존 파일: 없음

→ 시작 단계: Phase 1 (vibe-interview)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Phase 1: Interview (조건부)

**진입 조건:** interview 파일이 아직 없음

**진입 방식:**

1. **인자 있음** (`/vibe.spec "아이디어"`)
   → `vibe-interview` 스킬 로드 + 아이디어 전달

2. **인자 없음** (`/vibe.spec`)
   → **Smart Resume Fallback 먼저** (Phase 0.5 참조):
     - `.last-feature` 있고 사용자가 "이어서" 선택 → 해당 feature로 진입 (이 Phase 1 건너뛸 수 있음)
     - 진행 중 작업 목록에서 선택 → 해당 feature로 진입
     - "new" 선택 or 진행 중 작업 없음 → 아래 질문으로 빈 시작
   → 빈 시작 질문:
   ```
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   👋 무엇을 만들고 싶으신가요?
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   예:
   - "패럴랙스 웹사이트"
   - "할 일 관리 앱"
   - "Stripe 결제 연동 API"
   - 또는 자유롭게 설명

   (파일/이미지 첨부도 가능)
   ```
   → 사용자 응답 → `vibe-interview` 스킬 로드

**스킬 로드:**

```
Load skill `vibe-interview` with input: {user_idea}
```

> **`.last-feature` 갱신**: vibe-interview 스킬이 feature name을 확정하는 즉시 `.claude/vibe/.last-feature` 에 한 줄로 기록. 이후 Phase 2/3/4 진입 시에도 동일 기록 유지 (값이 같으면 no-op).

`vibe-interview` 스킬이 자체적으로:
- 프로젝트 타입 감지 (website/webapp/mobile/api/library/feature)
- 타입별 체크리스트 로드 (`skills/vibe-interview/checklists/{type}.md`)
- 반복 인터뷰 실행 (사용자 "그만"까지)
- `.claude/vibe/interviews/{feature-name}.md` 저장

**Stop Gate 1**: Interview 완료 후 (ultrawork 모드 스킵)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Interview 완료
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 .claude/vibe/interviews/{feature}.md
   Required: N/M | Optional: K/L | Discovered: X

다음 단계: 기획서 작성
  1. 계속 진행 (기본)
  2. Interview만 저장하고 종료
  3. Interview 수정 후 다시 (vibe-interview 재실행)

Enter → 계속
```

### Phase 2: Plan (조건부)

**진입 조건:** plan 파일이 아직 없음

```
Load skill `vibe-plan` with input: .claude/vibe/interviews/{feature}.md
```

`vibe-plan` 스킬이 자체적으로:
- 템플릿 로드 (`~/.claude/vibe/templates/plan-template.md`)
- Interview 섹션별 정제
- UI 섹션 조건부 포함 (type 기반)
- `.claude/vibe/plans/{feature}.md` 저장

**Stop Gate 2**: 기획서 완료 후 + 분기 판단 (ultrawork 모드 스킵)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 기획서 완성
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 .claude/vibe/plans/{feature}.md
Type: {type}

{type ∈ UI}:
자동 경로: SPEC 작성 → Review → Logic Track + UI Track 병렬 실행
  1. 계속 (권장)
  2. Logic Track만 (SPEC만)
  3. UI Track만 (/vibe.figma 바로)
  4. 여기서 종료

{type ∈ non-UI}:
자동 경로: SPEC 작성 → Review → Logic Track
  1. 계속 (권장)
  2. 여기서 종료

Enter → 계속
```

### Phase 3: SPEC 작성

**진입 조건:** spec 파일이 아직 없음 (또는 재작성 요청)

```
Load skill `vibe-spec` with input: .claude/vibe/plans/{feature}.md
```

`vibe-spec` 스킬이 PTCF 구조 SPEC 문서 + Feature(BDD) 파일 생성.

**핵심 단계** (상세는 `skills/vibe-spec/SKILL.md` 참조):

1. Project analysis (explorer agent)
2. config.json references 로드
3. Parallel research (GPT + Gemini + Claude agents, 8개 병렬)
4. UI/UX Design Intelligence (UI 키워드 시 자동)
5. PTCF SPEC 작성 (Large scope 자동 분할)
6. Feature file (BDD) 생성
7. Ambiguity scan
8. Quality gate (100점, 수렴까지 루프)

**출력:**

- `.claude/vibe/specs/{feature-name}.md` (또는 split folder)
- `.claude/vibe/features/{feature-name}.feature` (또는 split folder)

### Phase 4: SPEC Review

```
Load skill `vibe-spec-review` with feature: {feature-name}
```

`vibe-spec-review` 스킬이 Race Review + 품질 검증 + 사용자 체크포인트 실행.

**핵심 단계** (상세는 `skills/vibe-spec-review/SKILL.md` 참조):

1. SPEC/Feature 파일 로드 (single/split 자동 감지)
2. Quality Validation (100점 게이트, 수렴까지 auto-fix 루프)
3. Race Review (GPT + Gemini parallel, 라운드 수 캡 없음, P1=0 + 수렴 시 종료)
4. (옵션) Codex adversarial review
5. Review Debate Team (2+ P1/P2 이슈 시)
6. 사용자 최종 체크포인트

### Phase 4.5: Contract Extract (자동, API 있는 feature만)

```
Load skill `vibe-contract` with: extract "{feature-name}"
```

SPEC에 `## API` / `## Endpoints` / `## Interface` 섹션이 있으면 계약을 `.claude/vibe/contracts/{feature-name}.md`로 추출. 섹션이 없으면 에러 없이 스킵 (모든 feature가 API를 갖지 않음).

이 계약은 Phase 5a 구현 시 참조되고, `/vibe.verify` 종료 시 drift 검사에 사용됨.

### Phase 5a: Logic Track

```
/vibe.run "{feature-name}"
```

SPEC → 코드 구현. 시작 시 자동 체크:
- `/vibe.regress list --feature {feature-name}` — 미해결 회귀 항목 있으면 경고
- `.claude/vibe/contracts/{feature-name}.md` — 있으면 로드하여 구현 가이드

### Phase 5b: UI Track (type ∈ {website, webapp, mobile}일 때만)

**5a와 병렬 실행** (또는 순차 — 사용자 선택):

```
/vibe.figma
```

**`/vibe.figma`에 전달할 컨텍스트:**

- `.claude/vibe/plans/{feature}.md` 경로
- 기획서의 §7 Look & Feel, §8 레이아웃, §9 반응형 섹션을 Phase 1 스토리보드 입력으로 사용

### Phase 6: Verify

```
/vibe.verify "{feature-name}"
```

UI + 로직 + 연결 검증 (후속 PR에서 3축 확장 예정).

### Phase 7: Trace

```
/vibe.trace "{feature-name}"
```

SPEC ↔ 구현 추적.

> **Phase 7 완료 시**: `.claude/vibe/.last-feature` 삭제 (워크플로 완주 — 다음 `/vibe.spec` 호출은 빈 시작 또는 진행 중 작업 목록에서 시작).

## ultrawork 모드

`ultrawork` (또는 `ulw`)가 인자에 포함되면:

- **모든 Stop Gate 스킵**
- interview → plan → spec → review → run → (figma 병렬) 전체 자동 실행
- askUser 체크포인트 스킵, 기본값 사용
- 수동 개입 없이 완주

```
/vibe.spec "패럴랙스 웹사이트" ultrawork
```

## Smart Resume 예시

### 예시 1: 신규 프로젝트
```
User: /vibe.spec "원두 브랜드 랜딩"

Claude: 🔍 Input 분석
        입력: "원두 브랜드 랜딩"
        분류: 신규 아이디어
        기존 파일: 없음
        → 시작 단계: Phase 1 (vibe-interview)

        [vibe-interview 스킬 로드]
        Type: website 감지 → checklists/website.md 로드
        ...
```

### 예시 2: 기획서에서 시작
```
User: /vibe.spec ".claude/vibe/plans/bean-landing.md"

Claude: 🔍 Input 분석
        입력: plan 파일 경로
        분류: 기존 기획서
        Feature: bean-landing
        → 시작 단계: Phase 3 (vibe-spec)

        [vibe-spec 스킬 로드]
        기획서 읽기 → research → PTCF 작성 ...
```

### 예시 3: 기존 feature 재개
```
User: /vibe.spec "bean-landing"

Claude: 🔍 Input 분석
        입력: feature name
        기존 파일 검색...
          ✅ interview: .claude/vibe/interviews/bean-landing.md
          ✅ plan: .claude/vibe/plans/bean-landing.md
          ❌ spec: 없음
        → 시작 단계: Phase 3 (vibe-spec)

        [vibe-spec 스킬 로드]
        ...
```

### 예시 4: SPEC 리뷰 재실행
```
User: /vibe.spec "bean-landing"

Claude: 🔍 Input 분석
        기존 파일:
          ✅ spec: .claude/vibe/specs/bean-landing.md
          ✅ feature: .claude/vibe/features/bean-landing.feature

        이미 SPEC이 존재합니다. 어떻게 진행할까요?
        1. SPEC 리뷰 (Phase 4: vibe-spec-review 스킬 로드)
        2. /vibe.run 실행 (구현)
        3. SPEC 재작성 (기존 백업 후 새로 작성)
        4. 종료
```

### 예시 5: feature 이름을 잊고 인자 없이 호출 (Smart Resume Fallback)
```
User: /vibe.spec

Claude: (.last-feature 읽기 → "bean-landing" 발견)

        🔄 마지막 작업: bean-landing
        ✅ interview: .claude/vibe/interviews/bean-landing.md  (status: partial, 2일 전)
        ❌ plan:      없음
        ❌ spec:      없음
        → 다음 단계: Phase 2 (vibe-plan — 기획서 작성)

        이어서 진행할까요?
          Enter / yes → 이어서 진행
          list        → 다른 진행 중 작업 목록 보기
          new         → 새 아이디어로 시작
          abort       → 종료

User: yes

Claude: [Phase 2 진입]
        .last-feature = bean-landing
        [vibe-plan 스킬 로드]
        ...
```

### 예시 6: 여러 feature 중 선택 (Fallback list 모드)
```
User: /vibe.spec

Claude: (.last-feature 없음 → 디렉토리 스캔)

        🔍 진행 중인 작업

        1. bean-landing      [interview: partial]        2일 전
        2. todo-app          [plan: complete]            어제
        3. payment-api       [spec: complete]            방금 전
        ─────────────────────────────────────────────
        n. ➕ 새로 시작
        a. 종료

        선택 번호 또는 feature 이름을 입력하세요:

User: 2

Claude: Feature: todo-app 선택
        ✅ plan 완성 → Phase 3 (vibe-spec) 진입
        .last-feature = todo-app
        ...
```

## Rollback / Resume

- 각 Phase 종료 시 상태가 `.claude/vibe/{interviews,plans,specs,features}/`에 저장됨
- **`.claude/vibe/.last-feature` pointer**가 각 Phase 진입 시 갱신되어 "가장 최근에 작업한 feature" 추적 (Phase 7 완주 시 삭제)
- 중단 시 다시 `/vibe.spec`으로 돌아오면 Smart Resume Fallback 동작:
  - 인자 있음 (`/vibe.spec "feature-name"` 또는 파일 경로) → 해당 feature의 가장 진행된 단계 다음으로 바로 진입
  - 인자 없음 → `.last-feature` 우선 제안 → 거부하면 진행 중 작업 목록 제시 → 또 거부하면 빈 시작
- 수동 개입 필요시 스킬 직접 호출 가능 (`Load skill vibe-interview` 등)

## Next Step

```
# 전형적인 사용
/vibe.spec "프로젝트 아이디어"

# 중간 단계 재개
/vibe.spec "feature-name"

# ultrawork 자동 완주
/vibe.spec "feature-name" ultrawork
```

---

ARGUMENTS: $ARGUMENTS
