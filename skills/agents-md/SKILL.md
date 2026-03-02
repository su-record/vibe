---
name: agents-md
description: "Optimize AGENTS.md / CLAUDE.md by removing discoverable info and keeping only gotchas. Based on Addy Osmani's AGENTS.md principles. Activates on agents.md, claude.md, context file optimization."
triggers: [agents.md, claude.md, context file, optimize agents, optimize claude]
priority: 50
---

# agents-md — Context File Optimizer

AGENTS.md / CLAUDE.md를 최적화한다.
근거: https://addyosmani.com/blog/agents-md/

## 핵심 원칙

**한 줄 테스트**: "에이전트가 코드를 읽어서 스스로 알 수 있는가?" → Yes면 삭제.

## Step 1: 대상 파일 찾기

프로젝트 루트에서 다음 파일을 탐색한다:

```
Glob: pattern="AGENTS.md"
Glob: pattern="CLAUDE.md"
Glob: pattern=".cursorrules"
Glob: pattern=".github/copilot-instructions.md"
Glob: pattern=".windsurfrules"
```

대상 파일이 없으면 새로 생성할지 사용자에게 확인한다.

## Step 2: 현재 내용 분류

파일의 각 항목을 다음 기준으로 분류한다:

### 삭제 (Discoverable)

에이전트가 코드 탐색으로 발견 가능한 정보:

| 유형 | 예시 | 발견 경로 |
|------|------|----------|
| 디렉토리 구조 | "src/에 컴포넌트가 있다" | `ls`, `Glob` |
| 기술 스택 | "React + TypeScript 사용" | `package.json`, 파일 확장자 |
| Phase/진행 테이블 | "Phase 1 ✅, Phase 2 ✅..." | 이력일 뿐, 행동 지침 아님 |
| 빌드/테스트 커맨드 | "npm test로 테스트 실행" | `package.json` scripts |
| API 엔드포인트 목록 | "POST /api/users" | 라우터 코드 |
| 기능별 상세 설명 | "Phase 3에서 서킷브레이커 구현" | 해당 코드 읽으면 파악 가능 |
| 아키텍처 다이어그램 | ASCII 박스 다이어그램 | 개념적 설명, 실수 방지 효과 없음 |

### 유지 (Non-discoverable)

에이전트가 코드만으로 알 수 없는 함정과 규칙:

| 유형 | 예시 |
|------|------|
| 런타임 함정 | "Bun이다, Node가 아니다" (package.json에 명시 안 됨) |
| 금지 패턴 | "require() 쓰지 말 것", "React 패턴 금지" |
| SSOT 위치 | "model-registry.ts만 수정할 것, 하드코딩 금지" |
| 불변 순서/규칙 | "우선순위: A → B → C, 이 순서 변경 금지" |
| 재시도/폴백 제한 | "최대 2회, 3회 이상 금지" |
| 도구 선택 | "Zod만 사용, joi/yup 금지" |
| 네이밍 컨벤션 | 비표준 패턴 (표준이면 삭제) |
| 프로젝트 한 줄 소개 | 코드만으로 목적 파악 어려운 경우 |
| 언어/응답 지시 | "한글로 답변" 같은 선호 |

### 앵커링 주의

기술 이름을 언급하면 에이전트가 해당 기술로 편향된다. "무엇을 쓰지 말라"는 유용하지만, "우리는 X를 쓴다"는 코드에서 이미 보인다면 불필요.

## Step 3: 재구성

다음 구조로 재작성한다:

```markdown
# {프로젝트명} — {한 줄 소개}

{프로젝트가 무엇을 하는지 1-2문장. 코드만으로 목적 파악이 어려운 경우에만.}

# Gotchas

- **{함정 제목}.** {구체적 금지/규칙 설명}.
- ...

# Naming

{비표준 네이밍 패턴이 있을 때만. 표준(camelCase 등)이면 생략.}
```

규칙:
- 섹션은 최대 3개 (소개, Gotchas, Naming)
- Gotchas 항목은 각각 **볼드 제목 + 구체적 do/don't**
- "~를 사용한다" 보다 "~를 쓰지 말 것"이 더 유용
- 전체 50줄 이내 목표

## Step 4: CLAUDE.md 분리 (해당 시)

CLAUDE.md가 존재하면 Claude 전용 지시만 남긴다:

```markdown
{Claude 전용 지시. 예: "답변은 반드시 한글로 답변할 것."}
```

공통 규칙은 AGENTS.md에 둔다. Claude Code는 둘 다 읽는다.

## Step 5: 결과 보고

```markdown
## AGENTS.md 최적화 결과

| 지표 | Before | After |
|------|--------|-------|
| 줄 수 | N | N |
| 삭제 항목 | - | N개 (discoverable) |
| 유지 항목 | - | N개 (gotchas) |

### 삭제된 항목
- {항목}: {삭제 이유}

### 유지/추가된 항목
- {항목}: {유지 이유}
```
