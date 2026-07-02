---
name: vibe.spec
description: SPEC 진입점 — 자연어 요구사항(+첨부)을 받아 단일 패스 SPEC 작성 → 1회 승인 → /vibe.run 핸드오프
argument-hint: "(선택) feature name, requirement, file path, or idea"
user-invocable: true
---

# /vibe.spec

**SPEC 단계의 얇은 진입점.** 요구사항을 받아 `spec` 스킬(단일 패스)을 실행하고, SPEC 승인(유일한 의무 게이트) 후 `/vibe.run` 으로 넘긴다. interview → plan → spec → review 다단계 파이프라인은 폐지되었다 — 명확화 질문은 spec 패스 안에서 인라인으로, 리뷰는 셀프 리뷰 1회로 흡수됐다.

## Usage

```
/vibe.spec                              # 빈 시작 — Smart Resume 또는 "무엇을 만들까요?"
/vibe.spec "패럴랙스 웹사이트"            # 아이디어/요구사항으로 시작
/vibe.spec "docs/prd.md"                # 외부 PRD/아이디어 파일 입력
/vibe.spec + 📎 첨부                     # 첨부 기반 시작
/vibe.spec "feature-name"               # 기존 feature 재개
```

## Flow

```
/vibe.spec ["input"?]
    ↓
Input 분석 + Smart Resume
    ↓
Load skill `spec` — 단일 패스: 컨텍스트 수집 → (필요시) 인라인 질문 → SPEC + Feature 작성 → 셀프 리뷰 1회
    ↓
SPEC 승인 (1회 — automationLevel: autonomous 면 생략)
    ↓
/vibe.run "{feature-name}"
```

## Input 분석 + Smart Resume

```
1. 📎 첨부 있음 → 첨부를 spec 입력으로 전달
2. 인자가 파일 경로 →
     .vibe/specs/*.md   → 기존 SPEC: "승인 재확인? 재작성? /vibe.run 진행?" 질문
     기타 (.md/.txt/.pdf) → 외부 PRD 로 spec 입력에 병합
3. 인자가 feature name → .vibe/ 검색:
     spec 존재      → "재작성? 이어서 /vibe.run?" 질문
     spec 없음      → spec 패스 시작 (레거시 아티팩트가 있으면 입력으로)
4. 인자 없음 → .vibe/.last-feature 확인 → 있으면 "이어서 진행?" 제안,
     없으면 .vibe/specs/ 스캔해 진행 중 목록 제시, 그것도 없으면
     "👋 무엇을 만들고 싶으신가요?" 로 빈 시작
```

### 레거시 아티팩트 호환 (구버전 .vibe/interviews/, .vibe/plans/)

구버전 vibe 가 남긴 `.vibe/interviews/{feature}.md`, `.vibe/plans/{feature}.md` 가 존재할 수 있다:

- **존재하면**: spec 패스의 **입력 컨텍스트**로 읽어 활용한다 (이미 답한 질문을 다시 묻지 않게).
- **절대 요구하거나 재생성하지 않는다**: 이 파일들의 부재는 결함이 아니라 정상 상태다. interview/plan 스킬은 더 이상 존재하지 않는다.

### `.last-feature` 포인터

- spec 패스에서 feature 이름 확정 시 `.vibe/.last-feature` 에 한 줄 기록 (spec 스킬이 수행).
- 개인 작업 포인터이므로 git 커밋 금지 (`.gitignore` 에 `.vibe/.last-feature`).
- 워크플로 완주(verify 통과) 시 삭제.

## 승인과 루프

SPEC 승인이 `vibe/rules/loop-contract.md` 가 정의하는 **유일한 의무적 사람 개입**이다. 승인 후에는 ANCHOR→ACT→JUDGE→RECORD 루프가 게이트 통과까지 자동 반복한다 (`/vibe.run` → `/vibe.verify`). 별도의 파이프라인 승인·단계별 stop gate 는 없다.

- `automationLevel: autonomous` (`.vibe/config.json`) 또는 deprecated `ultrawork`/`ulw` 별칭 → SPEC 승인도 생략, 비대화형 완주.
- `--interactive` → 회전마다 확인 (과거 기본값).

## Next Step

```
/vibe.run "{feature-name}"        # 승인된 SPEC 구현 (spec 승인 직후 자동 제안)
/vibe.verify "{feature-name}"     # Done Criteria 판정 → run-ledger 기록
```

trace(`/vibe.trace`)·contract(`/vibe.contract`) 는 사용자가 요청하거나 SPEC 에 API Contract 섹션이 있을 때만 체인한다.

---

ARGUMENTS: $ARGUMENTS
