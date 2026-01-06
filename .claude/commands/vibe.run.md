---
description: Execute implementation from SPEC
argument-hint: "feature name" or --phase N
---

# /vibe.run

SPEC을 기반으로 구현합니다 (Implementation Agent).

## Usage

```
/vibe.run "기능명"              # 전체 구현
/vibe.run "기능명" --phase 1    # 특정 Phase만
```

## Description

PTCF 구조의 SPEC 문서를 읽고 바로 구현을 실행합니다.

> **PLAN, TASKS 문서 불필요** - SPEC이 곧 실행 가능한 프롬프트

## Process

### 1. SPEC 읽기

`.vibe/specs/{기능명}.md` 파싱:

| 섹션 | 용도 |
|------|------|
| `<role>` | AI 역할 정의 |
| `<context>` | 배경, 기술 스택, 관련 코드 |
| `<task>` | Phase별 작업 목록 |
| `<constraints>` | 제약 조건 |
| `<output_format>` | 생성/수정할 파일 |
| `<acceptance>` | 검증 기준 |

### 2. Feature 파일 확인

`.vibe/features/{기능명}.feature`:
- BDD Scenarios 확인
- 테스트 케이스로 활용

### 3. Phase별 구현

`<task>` 섹션의 Phase 순서대로:

1. **관련 코드 분석**: `<context>`의 관련 코드 읽기
2. **파일 생성/수정**: `<output_format>` 기준
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
