# Vibe

**SPEC-driven AI coding framework (Claude Code 전용)**

SPEC 문서 하나로 AI가 바로 구현하는 2-step 워크플로우.

[![npm version](https://img.shields.io/npm/v/@su-record/vibe.svg)](https://www.npmjs.com/package/@su-record/vibe)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP Tools](https://img.shields.io/badge/MCP_Tools-36-blue.svg)](https://github.com/su-record/hi-ai)

---

## Features

- **Claude Code 전용**: 네이티브 슬래시 커맨드 + MCP 통합
- **ULTRAWORK Mode**: `ulw` 한 단어로 모든 최적화 자동 활성화
- **Boulder Loop**: 모든 Phase 완료까지 자동 진행 (시지푸스처럼)
- **병렬 서브에이전트**: Haiku 3+ 동시 탐색으로 ~3배 속도 향상
- **PTCF 구조**: Persona, Task, Context, Format - Gemini 프롬프트 최적화
- **코딩 규칙 내장**: `.vibe/rules/` - 품질 기준, 복잡도 제한, 안티패턴
- **자동 컨텍스트 관리**: 70%+ 시 자동 압축/저장
- **36개 MCP 도구**: @su-record/hi-ai 통합

---

## Installation

```bash
npm install -g @su-record/vibe
```

---

## Quick Start

### 1. 프로젝트 초기화 (터미널)

```bash
# 기존 프로젝트에서
vibe init
# → hi-ai MCP가 .vibe/mcp/에 로컬 설치됨

# 새 프로젝트 생성
vibe init my-project
cd my-project
```

### 2. 슬래시 커맨드 사용 (Claude Code)

```
/vibe.spec "로그인 기능"              # SPEC 작성 (대화형)
/vibe.run "로그인 기능"               # 구현 실행
/vibe.run "로그인 기능" ultrawork     # 🚀 최대 성능 모드 (권장)
/vibe.verify "로그인 기능"            # 검증
```

---

## Workflow

```
┌─────────────────────────────────────────────────────┐
│  /vibe.spec "기능명"                                │
│  ↓ 대화형 요구사항 수집                              │
│  ↓ .vibe/specs/{기능명}.md (PTCF 구조)              │
│  ↓ .vibe/features/{기능명}.feature (BDD)            │
├─────────────────────────────────────────────────────┤
│  /vibe.run "기능명" ultrawork                       │
│  ↓ 🚀 ULTRAWORK: 병렬 탐색 + 자동 진행              │
│  ↓ Boulder Loop: 모든 Phase 완료까지 자동 실행      │
│  ↓ 에러 자동 재시도 (3회)                           │
├─────────────────────────────────────────────────────┤
│  /vibe.verify "기능명"                              │
│  ↓ Acceptance Criteria 검증                        │
│  ↓ 품질 점수 (A+ ~ F)                              │
└─────────────────────────────────────────────────────┘
```

---

## Commands

### 터미널 명령어

| 명령어 | 설명 |
|--------|------|
| `vibe init` | 현재 폴더에 vibe 초기화 |
| `vibe init <name>` | 새 프로젝트 생성 |
| `vibe update` | 설정 업데이트 (커맨드, 규칙, Hooks) |
| `vibe remove` | vibe 완전 제거 |
| `vibe status` | 현재 설정 상태 |
| `vibe help` | 도움말 |
| `vibe version` | 버전 정보 |

### 외부 LLM 연동 (선택적)

| 명령어 | 설명 |
|--------|------|
| `vibe gpt <api-key>` | GPT 활성화 (아키텍처/디버깅) |
| `vibe gemini <api-key>` | Gemini 활성화 (UI/UX) |
| `vibe <name> --remove` | 비활성화 |

### Claude Code 슬래시 커맨드

#### 핵심 워크플로우

| 명령어 | 설명 |
|--------|------|
| `/vibe.spec "기능명"` | SPEC 작성 (PTCF 구조) |
| `/vibe.run "기능명"` | 구현 실행 |
| `/vibe.run "기능명" ultrawork` | 🚀 **최대 성능 모드** (권장) |
| `/vibe.run "기능명" ulw` | ultrawork 단축어 |
| `/vibe.run "기능명" --phase N` | 특정 Phase만 실행 |
| `/vibe.verify "기능명"` | 검증 |

#### 분석 & 도구

| 명령어 | 설명 |
|--------|------|
| `/vibe.analyze` | 프로젝트 전체 분석 |
| `/vibe.analyze "기능명"` | 특정 기능/모듈 분석 |
| `/vibe.analyze --code` | 코드 품질 분석만 |
| `/vibe.analyze --deps` | 의존성 분석만 |
| `/vibe.analyze --arch` | 아키텍처 분석만 |
| `/vibe.reason "문제"` | 체계적 추론 (9단계) |
| `/vibe.ui "설명"` | ASCII UI 미리보기 |
| `/vibe.diagram` | 아키텍처 다이어그램 |
| `/vibe.diagram --er` | ERD 다이어그램 |
| `/vibe.diagram --flow` | 플로우차트 |

---

## ULTRAWORK Mode

> `ultrawork` 또는 `ulw` 키워드 하나로 **모든 최적화가 자동 활성화**됩니다.

```bash
/vibe.run "기능명" ultrawork    # 최대 성능 모드
/vibe.run "기능명" ulw          # 동일 (단축어)
```

### 활성화 기능

| 기능 | 설명 |
|------|------|
| **병렬 탐색** | 3+ Task(haiku) 에이전트 동시 실행 |
| **Boulder Loop** | 모든 Phase 완료까지 자동 진행 (멈추지 않음) |
| **자동 재시도** | 에러 발생 시 최대 3회 자동 재시도 |
| **컨텍스트 관리** | 70%+ 시 자동 압축 및 저장 |
| **무중단 실행** | Phase 간 확인 없이 연속 진행 |
| **외부 LLM** | GPT/Gemini 활성화 시 자동 참조 |

### Boulder Loop

시지푸스처럼 바위를 굴리듯, **모든 작업이 완료될 때까지** 자동으로 진행:

```
Phase 1 → Phase 2 → Phase 3 → ... → Phase N
    ↓         ↓         ↓              ↓
[병렬탐색] [병렬탐색] [병렬탐색]    [병렬탐색]
[구현]     [구현]     [구현]        [구현]
[테스트]   [테스트]   [테스트]      [테스트]
                                      ↓
                               🎉 완료까지 자동!
```

### 일반 모드 vs ULTRAWORK

| 항목 | 일반 모드 | ULTRAWORK |
|------|----------|-----------|
| Phase 전환 | 일시정지 가능 | 자동 진행 |
| 에러 발생 | 보고 후 중단 | 자동 재시도 (3회) |
| 컨텍스트 70%+ | 경고만 | 자동 압축/저장 |
| 탐색 방식 | 순차 가능 | **강제 병렬** |
| 완료 조건 | Phase별 | 전체 완료까지 |

---

## Project Structure

`vibe init` 실행 후 생성되는 구조:

```
project/
├── CLAUDE.md                 # 프로젝트 컨텍스트
├── .claude/
│   ├── commands/             # 슬래시 커맨드 (7개)
│   ├── agents/               # 서브에이전트 (simplifier)
│   └── settings.json         # Hooks 설정
└── .vibe/
    ├── config.json           # 프로젝트 설정
    ├── constitution.md       # 프로젝트 원칙
    ├── mcp/                   # hi-ai MCP (로컬 설치, .gitignore)
    ├── rules/                 # 코딩 규칙
    │   ├── core/              # 핵심 원칙
    │   ├── quality/           # 품질 체크리스트
    │   ├── standards/         # 복잡도, 네이밍
    │   ├── languages/         # 언어별 규칙
    │   └── tools/             # MCP 가이드
    ├── specs/                 # SPEC 문서들
    └── features/              # BDD Feature 파일들
```

---

## SPEC Document (PTCF Structure)

```markdown
# SPEC: {기능명}

## Persona
<role>
AI의 역할과 전문성 정의
</role>

## Context
<context>
- 배경, 목적
- 기술 스택
- 관련 코드
- 디자인 레퍼런스
</context>

## Task
<task>
### Phase 1: {단계명}
1. [ ] 작업 1
2. [ ] 작업 2

### Phase 2: {단계명}
...
</task>

## Constraints
<constraints>
- 기존 코드 패턴 준수
- 에러 메시지 한글화
</constraints>

## Output Format
<output_format>
- 생성할 파일
- 수정할 파일
- 검증 명령어
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] 검증 기준 1
- [ ] 검증 기준 2
</acceptance>
```

---

## Coding Rules (.vibe/rules/)

### 핵심 원칙

- **수술적 정밀도**: 요청받지 않은 코드는 절대 수정하지 않음
- **한국어 우선**: 모든 커뮤니케이션은 한국어로
- **DRY**: 반복하지 말고 재사용
- **SRP**: 하나의 함수는 하나의 목적만
- **YAGNI**: 필요하지 않으면 만들지 않음

### 복잡도 기준

| 메트릭 | 기준 |
|--------|------|
| 순환 복잡도 | ≤ 10 |
| 함수 길이 | ≤ 20줄 |
| 중첩 깊이 | ≤ 3단계 |
| 매개변수 | ≤ 5개 |
| 컴포넌트 JSX | ≤ 50줄 |

### 품질 등급

| 등급 | 점수 | 설명 |
|------|------|------|
| A+ | 95-100 | 완벽 |
| A | 90-94 | 우수 |
| B+ | 85-89 | 양호 |
| B | 80-84 | 개선 권장 |
| C | 70-79 | 개선 필요 |
| F | < 70 | 리팩토링 필요 |

---

## MCP Integration

### 자동 설치 (vibe init)

| MCP 서버 | 설명 | 설치 위치 |
|----------|------|----------|
| `vibe` (hi-ai) | 코드 분석, 품질 검증, 세션 메모리 | `.vibe/mcp/` (로컬) |
| `context7` | 라이브러리 문서 실시간 검색 | Smithery (온라인) |

> **Note**: hi-ai MCP는 프로젝트별 `.vibe/mcp/` 폴더에 로컬 설치되어 안정적으로 작동합니다.

### Hooks (자동 설정)

| Hook | 트리거 | 동작 |
|------|--------|------|
| `SessionStart` | 세션 시작 | 이전 컨텍스트 자동 복원 |
| `UserPromptSubmit` | `ultrawork`/`ulw` 감지 | 🚀 ULTRAWORK 모드 활성화 |
| `PostToolUse` | Write/Edit 후 | 품질 체크 (멈추지 않음) |
| `Notification` | 컨텍스트 70% | 경고 (ULTRAWORK: 자동 저장) |
| `Notification` | 컨텍스트 85% | 즉시 저장 + 압축 |
| `Notification` | 컨텍스트 95% | 긴급 저장 + 세션 전환 준비 |

### 선택적 연동 (외부 LLM)

| MCP 서버 | 명령어 | 설명 |
|----------|--------|------|
| GPT 5.2 | `vibe gpt <key>` | 아키텍처/디버깅 |
| Gemini 3 | `vibe gemini <key>` | UI/UX 설계 |

### hi-ai 주요 도구

- **코드 분석**: `analyze_complexity`, `validate_code_quality`
- **시맨틱 검색**: `find_symbol`, `find_references`
- **추론**: `apply_reasoning_framework`, `create_thinking_chain`
- **메모리**: `save_memory`, `recall_memory`, `auto_save_context`
- **UI**: `preview_ui_ascii`

---

## Example

```
User: /vibe.spec "벽돌게임"

Claude:
벽돌게임을 만드시는군요! 어떤 스타일을 생각하고 계신가요?

1. 클래식 벽돌깨기 (Breakout)
2. 아르카노이드 (파워업 포함)
3. 커스텀 스타일

또는 직접 설명해주셔도 됩니다.

User: 1

Claude: 어떤 플랫폼에서 실행하시겠어요?

1. 웹 (브라우저)
2. 모바일
3. 데스크톱

User: 1

Claude: 기술 스택을 제안드립니다:

1. Phaser.js (추천) - 게임 프레임워크
2. Canvas + JavaScript
3. PixiJS + Matter.js

User: 1

[대화 계속...]

✅ SPEC 문서 작성 완료!
📄 .vibe/specs/brick-game.md
📄 .vibe/features/brick-game.feature

다음 단계: /vibe.run "벽돌게임"
```

---

## Requirements

- **Node.js**: 18.0.0+
- **Claude Code**: 필수

---

## Links

- **Repository**: [github.com/su-record/vibe](https://github.com/su-record/vibe)
- **MCP Server**: [@su-record/hi-ai](https://github.com/su-record/hi-ai)
- **Issues**: [GitHub Issues](https://github.com/su-record/vibe/issues)

---

## License

MIT License

---

**Built with ❤️ by Su & Claude**
