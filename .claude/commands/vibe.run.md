---
description: Execute implementation from SPEC
argument-hint: "feature name" or --phase N
---

# /vibe.run

SPEC을 기반으로 구현합니다 (Implementation Agent with Multi-Model Orchestration).

## Usage

```
/vibe.run "기능명"              # 전체 구현
/vibe.run "기능명" --phase 1    # 특정 Phase만
```

## Rules Reference

**반드시 `.vibe/rules/` 규칙을 따릅니다:**
- `core/development-philosophy.md` - 수술적 정밀도, 요청 범위만 수정
- `core/quick-start.md` - 한국어, DRY, SRP, YAGNI
- `standards/complexity-metrics.md` - 함수 ≤20줄, 중첩 ≤3단계
- `quality/checklist.md` - 코드 품질 체크리스트

## Description

PTCF 구조의 SPEC 문서를 읽고 바로 구현을 실행합니다.

> **PLAN, TASKS 문서 불필요** - SPEC이 곧 실행 가능한 프롬프트

## 모델 오케스트레이션

작업 유형에 따라 최적의 모델을 자동 선택합니다:

```
┌─────────────────────────────────────────────────────────────┐
│               Opus 4.5 (오케스트레이터)                       │
│               - 전체 흐름 조율                                │
│               - 최종 결정/검토                                │
└─────────────────────────┬───────────────────────────────────┘
                          │
    ┌─────────────────────┼─────────────────────┐
    ↓                     ↓                     ↓
┌─────────┐         ┌─────────┐         ┌─────────┐
│ Haiku   │         │ Sonnet  │         │ Haiku   │
│ (탐색)  │         │ (구현)  │         │(테스트) │
└─────────┘         └─────────┘         └─────────┘
```

### 역할별 Task 호출

| 작업 유형 | 모델 | Task 파라미터 |
|----------|------|---------------|
| 코드베이스 탐색 | Haiku 4.5 | `model: "haiku"` |
| 핵심 구현 | Sonnet 4 | `model: "sonnet"` |
| 테스트 작성 | Haiku 4.5 | `model: "haiku"` |
| 아키텍처 결정 | Opus 4.5 | 메인 세션 |
| 최종 검토 | Opus 4.5 | 메인 세션 |

### 외부 LLM 활용 (활성화 시)

`.vibe/config.json`에서 외부 LLM이 활성화된 경우:

| 역할 | 모델 | 조건 |
|------|------|------|
| 아키텍처/디버깅 | GPT 5.2 | `vibe gpt <key>` 실행 시 |
| UI/UX 설계 | Gemini 3 | `vibe gemini <key>` 실행 시 |

외부 LLM 활성화 시 해당 역할은 MCP를 통해 자동 호출됩니다:
- `mcp__vibe-gpt__chat` - GPT 5.2 아키텍처 자문
- `mcp__vibe-gemini__chat` - Gemini 3 UI/UX 자문

## 시맨틱 코드 분석 (hi-ai MCP)

구현 전 코드베이스를 정확히 파악하기 위해 hi-ai MCP의 시맨틱 도구를 활용합니다:

| MCP 도구 | 용도 | 활용 시점 |
|----------|------|----------|
| `mcp__vibe__find_symbol` | 심볼 정의 찾기 | 클래스/함수 위치 파악 |
| `mcp__vibe__find_references` | 참조 찾기 | 영향 범위 분석 |
| `mcp__vibe__analyze_complexity` | 복잡도 분석 | 리팩토링 필요 여부 판단 |
| `mcp__vibe__validate_code_quality` | 품질 검증 | 구현 후 품질 확인 |

### 시맨틱 분석 흐름

```
구현 시작
    │
    ├─→ find_symbol: 수정할 함수/클래스 정확한 위치 파악
    │
    ├─→ find_references: 해당 심볼을 사용하는 모든 곳 확인
    │
    ├─→ analyze_complexity: 기존 코드 복잡도 확인
    │
    ↓
구현 (영향 범위를 정확히 파악한 상태에서)
    │
    ↓
validate_code_quality: 구현 후 품질 검증
```

### 컨텍스트 관리 (세션 연속성)

| MCP 도구 | 용도 |
|----------|------|
| `mcp__vibe__start_session` | 세션 시작, 이전 컨텍스트 복원 |
| `mcp__vibe__auto_save_context` | 현재 상태 자동 저장 |
| `mcp__vibe__restore_session_context` | 이전 세션 컨텍스트 복원 |
| `mcp__vibe__save_memory` | 중요 결정사항/패턴 저장 |

**세션 시작 시**: `mcp__vibe__start_session`으로 이전 컨텍스트 자동 복원
**세션 종료 시**: Hook이 `mcp__vibe__auto_save_context` 자동 실행

## Process

### 1. SPEC 및 설정 읽기

`.vibe/specs/{기능명}.md` 파싱:

| 섹션 | 용도 |
|------|------|
| `<role>` | AI 역할 정의 |
| `<context>` | 배경, 기술 스택, 관련 코드 |
| `<task>` | Phase별 작업 목록 |
| `<constraints>` | 제약 조건 |
| `<output_format>` | 생성/수정할 파일 |
| `<acceptance>` | 검증 기준 |

`.vibe/config.json` 확인:
- 외부 LLM 활성화 여부 (`models.gpt.enabled`, `models.gemini.enabled`)

### 2. Feature 파일 확인

`.vibe/features/{기능명}.feature`:
- BDD Scenarios 확인
- 테스트 케이스로 활용

### 3. Phase별 구현 (Task 병렬 호출)

`<task>` 섹션의 Phase 순서대로:

```
Phase 시작
    │
    ├─→ Task(haiku): 코드베이스 분석
    │       "관련 파일과 패턴을 분석하세요"
    │
    ├─→ [GPT 활성화 시] MCP(vibe-gpt): 아키텍처 검토
    │       "이 설계가 적절한지 검토해주세요"
    │
    ├─→ [Gemini 활성화 시] MCP(vibe-gemini): UI/UX 자문
    │       "UI 구현 방향을 제안해주세요"
    │
    ↓
Opus: 분석 결과 종합, 구현 방향 결정
    │
    ↓
Task(sonnet): 핵심 구현
    "SPEC에 따라 코드를 구현하세요"
    │
    ↓
Task(haiku): 테스트 작성
    "구현된 코드의 테스트를 작성하세요"
    │
    ↓
Opus: 최종 검토 및 다음 Phase
```

**병렬 실행 예시:**
```javascript
// 독립적인 작업은 병렬로 Task 호출
Task(haiku) - 코드 분석
Task(haiku) - 의존성 확인
// → 동시 실행

// 순차적 작업
Task(sonnet) - 구현 (분석 완료 후)
Task(haiku) - 테스트 (구현 완료 후)
```

1. **관련 코드 분석**: Task(haiku)로 `<context>`의 관련 코드 탐색
2. **파일 생성/수정**: Task(sonnet)로 `<output_format>` 기준 구현
3. **제약 조건 준수**: `<constraints>` 확인
4. **검증 실행**: 검증 명령어 실행

### 4. Acceptance Criteria 검증

`<acceptance>` 체크리스트 확인:
- [ ] 각 기준 통과 여부
- [ ] 테스트 통과
- [ ] 빌드 성공

### 5. SPEC 업데이트

완료된 Task 체크:
```markdown
## Task
<task>
### Phase 1: Backend
1. [x] DB 스키마 작성 ✅
2. [x] API 엔드포인트 ✅
...
</task>
```

## TRUST 5 원칙

구현 시 준수:

| 원칙 | 설명 |
|------|------|
| **T**est-first | 테스트 먼저 작성 |
| **R**eadable | 명확한 코드 |
| **U**nified | 일관된 스타일 |
| **S**ecured | 보안 고려 |
| **T**rackable | 로깅, 모니터링 |

## Input

- `.vibe/specs/{기능명}.md` (PTCF SPEC)
- `.vibe/features/{기능명}.feature` (BDD)
- `CLAUDE.md` (프로젝트 컨텍스트)

## Output

- 구현된 코드 파일
- 테스트 파일
- SPEC 문서 업데이트 (체크표시)

## Example

```
User: /vibe.run "벽돌게임"

Claude:
📄 SPEC 읽는 중: .vibe/specs/brick-game.md

<role> 분석:
- 웹 게임 시니어 개발자
- Phaser.js 전문가

<context> 분석:
- 기술 스택: Phaser.js, TypeScript
- 신규 프로젝트

<task> 분석:
- Phase 1: 프로젝트 셋업 (3개 작업)
- Phase 2: 게임 로직 (5개 작업)
- Phase 3: UI/UX (3개 작업)
- Phase 4: 테스트 (2개 작업)

🚀 Phase 1 시작...

✅ Phase 1 완료
  - package.json 생성
  - TypeScript 설정
  - Phaser.js 설치

🚀 Phase 2 시작...
[구현 계속...]

✅ 모든 Phase 완료!
📊 Acceptance Criteria 검증 중...
  ✅ 게임 시작/종료 동작
  ✅ 공-패들 충돌 처리
  ✅ 점수 표시
  ✅ npm run build 성공

🎉 구현 완료!
```

### Phase 지정 실행

```
User: /vibe.run "벽돌게임" --phase 2

Claude:
📄 SPEC 읽는 중: .vibe/specs/brick-game.md
🎯 Phase 2만 실행합니다.

Phase 2: 게임 로직
1. [ ] 패들 이동 구현
2. [ ] 공 물리엔진
3. [ ] 벽돌 충돌 처리
4. [ ] 점수 시스템
5. [ ] 게임 오버 조건

🚀 구현 시작...
```

## Error Handling

실패 시:
1. 에러 메시지 확인
2. `<constraints>` 재검토
3. 코드 수정 후 재시도
4. 계속 실패 시 사용자에게 보고

## Next Step

```
/vibe.verify "벽돌게임"
```
