# vide

> **Vi**be **De**velopment - SPEC-driven AI coding framework with MCP integration

자연어 요구사항을 SPEC → PLAN → TASKS → CODE로 변환합니다.

---

## Installation

```bash
npm install -g @su-record/vide
```

설치 시 자동으로:
- ✅ vide CLI 설치
- ✅ MCP 서버 자동 등록 (38개 도구)
- ✅ 슬래시 명령어 사용 가능

---

## Quick Start

```bash
# 1. 프로젝트 초기화
cd your-project
vide init

# 2. SPEC 작성 (6개 질문 Q&A)
vide spec "기능명"

# 3. PLAN 생성 (기술 스택, 아키텍처, 비용)
vide plan "기능명"

# 4. TASKS 분해 (Phase별 작업 목록)
vide tasks "기능명"

# 5. 구현 (Task별 가이드 + 코드 작성)
vide run "Task 1-1"

# 6. 검증 (SPEC 요구사항 충족 확인)
vide verify "기능명"
```

---

## Workflow

```
자연어 요구사항
  ↓ vide spec
SPEC 문서 (EARS 형식)
  ↓ vide plan
PLAN 문서 (15 섹션)
  ↓ vide tasks
TASKS 문서 (Phase별)
  ↓ vide run
코드 구현
  ↓ vide verify
검증 완료
```

---

## Commands

### CLI

```bash
# SPEC-driven 워크플로우
vide init                # .vide/ 폴더 생성
vide spec <name>         # SPEC 작성
vide plan <name>         # PLAN 생성
vide tasks <name>        # TASKS 생성
vide run <task>          # Task 구현
vide run --phase <N>     # Phase N 전체 실행
vide run --all           # 전체 실행
vide verify <name>       # SPEC 검증

# 분석 & 도구
vide analyze             # 프로젝트 분석 (전체)
vide analyze --code      # 코드 품질 분석
vide analyze --deps      # 의존성 분석
vide ui <description>    # UI ASCII 미리보기
vide diagram             # 아키텍처 다이어그램
vide diagram --er        # ERD 다이어그램

# 정보
vide agents              # Agent 목록
vide skills              # Skill 목록
```

### Slash Commands (Claude Code)

```
# SPEC-driven
/vide.spec "기능명"
/vide.plan "기능명"
/vide.tasks "기능명"
/vide.run "Task 1-1"
/vide.run --phase 1
/vide.verify "기능명"

# 분석 & 도구
/vide.analyze
/vide.ui "로그인 페이지"
/vide.diagram --er
```

---

## Project Structure

```
your-project/
├── .vide/
│   ├── config.json          # 언어 설정 (ko/en)
│   ├── constitution.md      # 프로젝트 원칙
│   ├── specs/               # SPEC 문서
│   ├── plans/               # PLAN 문서
│   ├── tasks/               # TASKS 문서
│   ├── guides/              # 구현 가이드 (자동 생성)
│   ├── reports/             # 분석 리포트
│   └── diagrams/            # 다이어그램
└── CLAUDE.md                # 기술 스택 문서 (권장)
```

---

## MCP Integration

vide는 설치 시 MCP 서버를 자동으로 등록합니다.

### 사용 가능한 도구 (38개)

- **코드 분석**: `analyze_complexity`, `validate_code_quality`, `check_coupling_cohesion`
- **프로젝트 분석**: `find_symbol`, `find_references`
- **사고 과정**: `create_thinking_chain`, `step_by_step_analysis`
- **품질 검증**: `apply_quality_rules`, `suggest_improvements`
- **UI 미리보기**: `preview_ui_ascii`
- **메모리 관리**: `save_memory`, `recall_memory`
- **기타**: 현재 시간, 컨텍스트 저장 등

### MCP 서버 확인

```bash
claude mcp list
# vide: node /path/to/vide/mcp/dist/index.js - ✓ Connected
```

---

## Configuration

### .vide/config.json

```json
{
  "language": "ko",
  "agents": {
    "default": "backend-python-expert"
  },
  "mcp": {
    "enabled": true,
    "servers": ["vide"]
  }
}
```

### CLAUDE.md (권장)

프로젝트 루트에 생성하면 vide가 기술 스택을 자동 분석합니다.

```markdown
# CLAUDE.md

## Tech Stack

### Backend
- Framework: FastAPI 0.104+
- Database: PostgreSQL 17
- Cache: Redis 7.2

### Frontend
- Framework: Flutter 3.24+
- State: Provider
```

---

## SPEC Format (EARS)

```markdown
# SPEC: 기능명

## Metadata
- 작성일: 2025-01-17
- 우선순위: HIGH
- 언어: ko

## Requirements

### REQ-001: 요구사항 제목
**WHEN** 사용자가 X를 하면
**THEN** 시스템은 Y를 해야 한다 (SHALL)

#### Acceptance Criteria
- [ ] 검증 기준 1
- [ ] 검증 기준 2
```

---

## Agents

| Agent | 역할 |
|-------|------|
| Specification Agent | SPEC 작성 (6개 질문 Q&A) |
| Planning Agent | PLAN 생성 (15개 섹션) |
| Task Agent | TASKS 분해 (Phase별) |
| Backend Python Expert | Python/FastAPI 구현 |
| Frontend Flutter Expert | Flutter/Dart 구현 |
| Database PostgreSQL Expert | PostgreSQL/PostGIS 설계 |
| Quality Reviewer | 코드 품질 검증 |

---

## Example

### 1. SPEC 작성

```bash
$ vide spec "푸시 알림 설정"

Q1. Why: 불필요한 알림으로 인한 앱 이탈 방지
Q2. Who: 전체 사용자
Q3. What: 6개 카테고리별 ON/OFF 토글
Q4. How: P95 < 500ms, Redis 캐싱
Q5. When: 3일 소요
Q6. With What: FastAPI + Flutter + PostgreSQL + FCM

✅ .vide/specs/push-notification-settings.md
```

### 2. PLAN 생성

```bash
$ vide plan "푸시 알림 설정"

✅ .vide/plans/push-notification-settings.md

- 3 Phases (Backend → Frontend → FCM)
- 24시간 (3일)
- $0.50/월 추가 비용
- 기존 스택 100% 재사용
```

### 3. TASKS 생성

```bash
$ vide tasks "푸시 알림 설정"

✅ .vide/tasks/push-notification-settings.md

- 19개 Task
- Phase 1: Backend (8개)
- Phase 2: Frontend (8개)
- Phase 3: FCM 연동 (3개)
- 의존성 그래프 포함
```

### 4. 구현

```bash
$ vide run "Task 1-1"

1. TASKS 문서 읽기
2. 구현 가이드 생성: .vide/guides/task-1-1.md
3. 코드 작성: backend/alembic/versions/xxxx_add_notification_settings.py
4. 검증: alembic upgrade head
5. Task 상태 업데이트: ⬜ → ✅
```

### 5. 분석

```bash
$ vide analyze --code

📊 코드 품질 점수: 85/100 (B+)

주요 발견사항:
- 높은 복잡도: src/service.py (CC: 15)
- 낮은 응집도: src/utils.py

개선 제안:
1. src/service.py를 3개 모듈로 분리
2. Dependency Injection 패턴 도입

리포트: .vide/reports/analysis-2025-11-17.md
```

### 6. UI 미리보기

```bash
$ vide ui "로그인 페이지"

┌─────────────────────────────────────────┐
│               Welcome                    │
├─────────────────────────────────────────┤
│         ┌─────────────────────┐          │
│  Email: │                     │          │
│         └─────────────────────┘          │
│         ┌─────────────────────┐          │
│  Pass:  │                     │          │
│         └─────────────────────┘          │
│         ┌─────────────────────┐          │
│         │       Login         │          │
│         └─────────────────────┘          │
└─────────────────────────────────────────┘

필요한 컴포넌트:
- Header.tsx
- LoginForm.tsx
- Input.tsx
- Button.tsx
```

---

## Best Practices

### 1. CLAUDE.md 작성

프로젝트 루트에 기술 스택 문서를 작성하면 vide가 기존 기술을 재사용합니다.

### 2. Phase별 실행

전체 실행(`--all`) 대신 Phase별로 실행하고 검증하는 것을 권장합니다.

```bash
vide run --phase 1  # Backend
# 검증 후
vide run --phase 2  # Frontend
# 검증 후
vide run --phase 3  # 통합
```

### 3. Acceptance Criteria 확인

각 Task의 Acceptance Criteria를 반드시 확인하고 모두 통과해야 완료입니다.

---

## Framework Structure

```
vide/
├── bin/vide                # CLI
├── agents/                 # 7개 Agent
├── templates/              # 4개 템플릿
├── mcp/dist/               # MCP 서버 (38개 도구)
└── .claude/commands/       # 슬래시 명령어 (8개)
```

---

## Requirements

- Node.js 18+
- npm 7+
- Claude Code (슬래시 명령어 사용 시)

---

## License

MIT

---

## Links

- Repository: [GitHub](https://github.com/su-record/vide)
- Issues: [GitHub Issues](https://github.com/su-record/vide/issues)
- MCP Server: [@su-record/hi-ai](https://github.com/su-record/hi-ai)
