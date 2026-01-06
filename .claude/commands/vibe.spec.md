---
description: Create SPEC document with Specification Agent
argument-hint: "feature name"
---

# /vibe.spec

SPEC 문서를 작성합니다 (Specification Agent).

## Usage

```
/vibe.spec "기능명"
```

## Description

사용자와 대화를 통해 요구사항을 수집하고, AI가 바로 실행 가능한 **PTCF 구조의 SPEC 문서**를 작성합니다.

> **PTCF**: Persona, Task, Context, Format - Google Gemini 프롬프트 최적화 프레임워크

## Process

### 1. 프로젝트 분석

**기존 프로젝트** (`vibe init`):
- 소스코드 분석: `package.json`, `pyproject.toml`, `pubspec.yaml`, `go.mod` 등
- `CLAUDE.md` 파일 참조 (기술 스택)
- 파일 구조로 프레임워크 추정

**신규 프로젝트** (`vibe init <프로젝트명>`):
- 기술 스택 제안 (2-3가지 옵션)

### 2. 대화로 요구사항 수집

**원칙:**
- 질문은 **한 번에 하나씩**
- 선택지는 **번호로 제시** + "직접 설명해주셔도 됩니다"
- 고정된 순서 없이 **자연스러운 대화**

**필수 확인 사항:**
- 목적 (Why): 왜 필요한가?
- 사용자 (Who): 누가 사용하는가?
- 기능 범위 (What): 어떤 기능들이 필요한가?
- 기술 스택: 기존 스택 확인 또는 새로 제안
- 디자인 레퍼런스: 참고할 UI/UX

### 3. SPEC 문서 작성 (PTCF 구조)

`.vibe/specs/{기능명}.md` 생성:

```markdown
# SPEC: {기능명}

## Persona
<role>
구현을 담당할 AI의 역할과 전문성 정의
- 프로젝트의 시니어 개발자
- 기존 코드 패턴 준수
- 테스트 가능한 코드 작성
</role>

## Context
<context>
### 배경
- 왜 이 기능이 필요한가
- 누가 사용하는가

### 기술 스택
- Backend: {기술}
- Frontend: {기술}
- Database: {기술}

### 관련 코드
- `src/xxx/`: 참조할 기존 구현
- `src/yyy/`: 수정할 파일들

### 디자인 레퍼런스
- {참고 앱/서비스}
</context>

## Task
<task>
### Phase 1: {단계명}
1. [ ] {구체적 작업}
   - 파일: `path/to/file`
   - 검증: `command`
2. [ ] {구체적 작업}

### Phase 2: {단계명}
1. [ ] {구체적 작업}
2. [ ] {구체적 작업}

### Phase 3: 테스트 및 검증
1. [ ] Unit Tests
2. [ ] Integration Tests
</task>

## Constraints
<constraints>
- 기존 코드 패턴 준수
- 에러 메시지 한글화
- 환경변수로 설정 분리
- {기타 제약 조건}
</constraints>

## Output Format
<output_format>
### 생성할 파일
- `path/to/new/file.ts`
- `path/to/new/file.test.ts`

### 수정할 파일
- `path/to/existing/file.ts`

### 검증 명령어
- `npm test`
- `npm run build`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] {검증 가능한 기준 1}
- [ ] {검증 가능한 기준 2}
- [ ] 모든 테스트 통과
- [ ] 빌드 성공
</acceptance>
```

### 4. Feature 파일 생성 (BDD)

`.vibe/features/{기능명}.feature` 생성:
- SPEC의 Acceptance Criteria를 Scenario로 변환
- Given-When-Then 형식

### 5. 품질 검증

TRUST 5 기준 자체 평가 (0-100점)

## Output

- `.vibe/specs/{기능명}.md` - PTCF 구조 SPEC
- `.vibe/features/{기능명}.feature` - BDD Feature 파일
- 품질 점수 및 개선 제안

## Example

```
User: /vibe.spec "벽돌게임"

Claude:
벽돌게임을 만드시는군요! 어떤 스타일의 게임을 생각하고 계신가요?

1. 클래식 벽돌깨기 (Breakout 스타일)
2. 아르카노이드 (파워업 아이템 포함)
3. 특별한 게임플레이가 있는 커스텀 스타일

또는 직접 설명해주셔도 됩니다.

User: 1

Claude: 어떤 플랫폼에서 실행하시겠어요?

1. 웹 (브라우저)
2. 모바일 (iOS/Android)
3. 데스크톱

User: 1

Claude:
웹 게임 개발에 적합한 기술 스택을 제안드립니다:

1. **Phaser.js** (추천) - 게임 프레임워크, 물리엔진 내장
2. **Canvas + JavaScript** - 가볍고 세밀한 제어
3. **PixiJS + Matter.js** - 고성능 렌더링

User: 1

Claude: 디자인 스타일은요?

1. 레트로 픽셀 (Atari Breakout)
2. 네온 그래픽 (Arkanoid)
3. 모던 3D 효과

User: 2

[대화 계속...]

✅ SPEC 문서 작성 완료!
📄 .vibe/specs/brick-game.md (PTCF 구조)
📄 .vibe/features/brick-game.feature
```

## Next Step

```
/vibe.run "벽돌게임"
```
