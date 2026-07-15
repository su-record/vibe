# Branch 3 (WRITE) Step Algorithms — Full Reference

> Loaded by vibe.figma SKILL.md Branch 3 (`--create*`) Step A/B/C/D/D↔E gate/E/F bodies for the full incremental/idempotent algorithms, message templates, and checklists.

## createMode별 실행 매트릭스

| Step | full | storyboard | design |
|---|---|---|---|
| A. plan.md 파싱 | ✅ | ✅ | ✅ |
| B. target file + state 로드 | ✅ | ✅ | ✅ |
| C. 디자인 시스템 발견 | ✅ | ⛔ SKIP (와이어는 컴포넌트 불필요) | ✅ |
| D. 와이어프레임 생성 | ✅ | ✅ | ⛔ SKIP |
| 🚪 Step D ↔ E 검토 게이트 | ✅ | ⛔ (Step E 없음) | ⛔ (Step D 없음) |
| E. 본 디자인 적용 | ✅ | ⛔ SKIP | ✅ (분기 동작, 아래 참조) |
| F. 시각 검증 | ✅ (full) | ✅ (wire 대상, 구조 체크만) | ✅ (design 대상) |

## createMode Matrix — `design` mode Step E branching (summary)

**`createMode == design`의 Step E 동작 (결함 없는 실행을 위한 분기)**:

- state.sections 가 **완전히 비어있음** (hasNewState 또는 첫 실행)
  → 각 섹션별로 새 frame 생성 후 **곧바로** 컴포넌트 배치 (와이어 placeholder 단계 통째로 생략)
  → 이 경로에서는 wireNodeId == designNodeId 가 됨 (같은 노드, 한 번에 완성)
- state.sections 에 **일부 섹션의 wireNodeId 가 존재**
  → 존재하는 섹션: 기존 wireNodeId 위에 덮어쓰기 (full 모드의 E와 동일)
  → 없는 섹션: ❌ reject "이 섹션({섹션명})은 와이어가 없습니다.
                      `--create-storyboard` 로 먼저 와이어를 만들거나, `--create` (full)로 호출하세요.
                      빈 state에서 처음부터 design 모드로 그리려면 `--new-state` 를 추가하세요."

## Step A — plan.md 파싱 (Read {mdArg} 필수 추출 섹션)

```
1. Read {mdArg}
   필수 추출 섹션:
     - "## 1. 개요" → 페이지 이름/목적
     - "## 7. Look & Feel" → 분위기, 컬러, 타이포, 레퍼런스, 인터랙션
     - "## 8. 레이아웃/섹션 구성" → 섹션 순서, 목적, 핵심 콘텐츠
     - "## 9. 반응형 전략" → 디바이스 우선순위, 브레이크포인트

   ⛔ 위 섹션 중 7/8 누락 시: 사용자에게 "plan.md에 UI 섹션이 비어있습니다.
      /vibe.spec를 먼저 돌려 기획서를 보강할까요?" 라고 묻고 중단.

   ✅ 피처명 결정: mdArg 파일명에서 .md 제거한 값을 {feature}로 사용

2. Design context 로드 (non-interactive 기본)
   - hasReadDesignMd == true (프로젝트 루트에 DESIGN.md 존재):
     · §1 Visual Theme / §2 Color Palette / §3 Typography 를 톤·팔레트의
       **1 차 입력**으로 사용 (`design-context.json` · plan.md 보다 우선)
   - Read .vibe/design-context.json
     · 존재 → 톤/팔레트 보강용으로 binding (DESIGN.md 가 있으면 보조)
     · 없음 → plan.md의 "## 7. Look & Feel" 값으로 임시 컨텍스트 구성
```

## Step B — Figma 타겟 파일 확보 + State 파일 위치

```
1. AskUserQuestion (자유 텍스트):
   "디자인을 생성할 target Figma 파일 URL을 입력해주세요.
    (figma.com/design/{fileKey}/...)"

2. URL → fileKey 추출

3. State 파일 로드 (idempotency, 재실행 시 중복 생성 방지)
   경로: /tmp/{feature}/figma-create-state.json
```

## Step C — 디자인 시스템 발견 세부

```
   2a. 컴포넌트: search_design_system 또는 기존 스크린 instance walk
   2b. 변수(토큰): get_variable_defs로 색/간격/radius 수집
   2c. 텍스트/이펙트 스타일: 발견된 토큰을 plan.md Look & Feel과 매칭
       매칭 안 되면 "이 plan.md는 기존 디자인 시스템에 없는 토큰을 요구합니다.
       새로 만들까요? (figma:figma-generate-library 권장) 또는 가까운 토큰으로 진행할까요?"
```

## Step D — 와이어프레임 생성 알고리즘 (incremental + idempotent)

```
   plan.md "## 8. 레이아웃/섹션 구성" 표를 순회:
     for each 섹션 in plan.md:
       1. 섹션 row 직렬화 → wireHash 계산 (8번 row만 해시)
       2. state.sections에서 같은 name 매칭:
          ├─ 매칭 없음 (신규):
          │    a. use_figma 호출로 wire 프레임 생성 (Auto Layout만)
          │       - 배경: #F5F5F5 (회색)
          │       - 자식: 핵심 콘텐츠 컬럼의 항목마다 회색 박스 + 텍스트 라벨
          │       - 컴포넌트 instance 배치 금지 (Step E에서 채움)
          │       - 변수 바인딩 금지 (Step E에서 채움)
          │    b. 반환된 wireNodeId를 state.sections에 entry append
          │       (designNodeId = null 로 초기화)
          ├─ 매칭 + wireHash 동일 (구조 변화 없음):
          │    SKIP, "✓ {섹션명} wire (cached)" 출력
          └─ 매칭 + wireHash 다름 (구조 변경됨):
               a. use_figma로 기존 wireNodeId 내부 정리 (children 삭제)
               b. 신규 케이스 a 재실행 (wireNodeId 재사용)
               c. state entry의 wireHash + updatedAt 갱신
               d. designNodeId가 있으면 → null로 리셋 (구조 바뀌었으니 본 디자인도 다시 그려야 함)

   ⛔ 한 번의 use_figma 호출에 모든 섹션을 몰아넣지 말 것.
      섹션 단위로 incremental 호출 → 검증 → 다음 섹션.

   반응형 처리:
     plan.md "## 9. 반응형 전략"의 브레이크포인트별로 별도 wire 프레임 생성
     state.sections에는 bp 필드로 mo/pc 구분하여 각각 entry 저장

   Step D 종료 직전:
     state.updatedAt = now
     Write /tmp/{feature}/figma-create-state.json
```

## Step D ↔ Step E 사용자 검토 게이트 — 메시지 템플릿

```
2. 사용자에게 제시:
   "📐 와이어프레임이 생성되었습니다.
    figma URL: https://figma.com/design/{fileKey}/...?node-id={firstWireNodeId}
    섹션 요약: 신규 N / 갱신 M / 캐시 K

    구조가 plan.md와 일치합니까?
      yes  → Step E (본 디자인) 진행
      <자유 텍스트> → 수정 요청 (해당 섹션의 wireHash 강제 무효화 후 Step D 재실행)
      abort → 워크플로 중단"

3. ralph/ultrawork 모드:
   사용자 질문 SKIP, 자동 yes로 Step E 진행
   (단, 섹션이 0개면 abort)
```

## Step E — 본 디자인 적용 알고리즘 (incremental + idempotent)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
분기 A) createMode == "full":
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   state.sections를 순회 (Step D에서 채워진 상태):
     for each section in state.sections:
       1. 섹션 row 직렬화 → designHash 계산 (7번+8번+9번 row 해시)
       2. designNodeId == null 이거나 designHash 변경됨:
          a. use_figma로 wireNodeId 내부의 자식 정리 (placeholder 삭제)
             ⚠ wireNodeId 자체는 삭제 금지 (Auto Layout 골격 보존)
          b. 같은 wireNodeId 안에 컴포넌트 instance 배치 + 변수 바인딩
          c. 텍스트는 plan.md "핵심 콘텐츠" 컬럼의 실제 값 사용
          d. designNodeId = wireNodeId 로 set (같은 노드가 2단계로 진화)
          e. state entry의 designHash + updatedAt 갱신
       3. designHash 동일: SKIP, "✓ {섹션명} design (cached)" 출력

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
분기 B) createMode == "design":
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   plan.md "## 8. 레이아웃/섹션 구성" 표를 순회 (state가 없을 수 있음):
     for each 섹션 in plan.md:
       1. 섹션 row 직렬화 → designHash 계산
       2. state.sections에서 같은 name 매칭:
          ├─ 매칭 있음 + wireNodeId 존재 → 분기 A의 update 경로 실행 (wireNodeId 재사용)
          ├─ 매칭 있음 + wireNodeId null → ❌ "이 섹션({섹션명})은 이전에 design 모드로 그려졌지만
          │                                   state가 깨졌습니다. --new-state 로 리셋하세요."
          └─ 매칭 없음:
              ⚠ state.sections 가 완전히 비어있음 (첫 실행 또는 hasNewState)이면 허용:
                a. use_figma 호출로 frame 생성 (Auto Layout + 컴포넌트 + 텍스트 한 번에)
                b. wireNodeId = designNodeId = 반환된 frameNodeId
                c. state.sections에 entry append (wireHash/designHash 둘 다 계산)
              ⛔ state.sections 가 일부 비어있지 않으면 reject:
                "이 섹션({섹션명})은 와이어가 없습니다. --create-storyboard 로 먼저 만들거나
                 --create (full)로 호출하세요."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
공통 규칙:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ⛔ 한 번의 use_figma 호출에 모든 섹션을 몰아넣지 말 것.
   ⛔ 분기 A에서 wireNodeId를 삭제하고 새 노드를 만들지 말 것 (state 무효화됨).

   Step E 종료 직전:
     state.planHash = sha256(plan.md 전체)
     state.updatedAt = now
     Write /tmp/{feature}/figma-create-state.json
```

## Step F — LLM 셀프 체크 + 최종 사용자 확인 템플릿

```
2. LLM 셀프 체크 (createMode에 따라 항목 narrow):

   createMode == "storyboard" (구조 체크만 — 컬러 판단 불가):
     - 섹션 순서가 plan.md 표와 일치하는가?
     - 핵심 CTA 위치가 plan.md와 일치하는가?
     ⛔ 컬러/분위기 체크 SKIP (와이어는 회색)

   createMode == "design" 또는 "full":
     - 섹션 순서가 plan.md 표와 일치하는가?
     - 분위기/컬러 키워드가 시각적으로 반영됐는가?
     - 핵심 CTA가 Hero에 존재하는가?

3. 사용자에게 다음을 제시:
   - createMode 표시 ("mode: full" / "mode: storyboard only" / "mode: design only")
   - figma URL (fileKey + 첫 nodeId 딥링크)
   - 섹션별 결과 요약:
     · full:       wire 신규 N / 갱신 M / 캐시 K + design 신규 N / 갱신 M / 캐시 K
     · storyboard: wire 신규 N / 갱신 M / 캐시 K
     · design:     design 신규 N / 갱신 M / 캐시 K
   - state 파일 경로
   - (storyboard 모드) "다음 단계: 같은 plan.md로 `--create-design` 또는 `--create` 를 호출하면
     이 와이어 위에 본 디자인이 입혀집니다."
```
