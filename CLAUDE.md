# VIBE

SPEC 주도 AI 코딩 프레임워크 (Claude Code 전용)

## 코드 품질 기준 (필수)

모든 코드 작성 시 아래 기준을 준수합니다. 상세 규칙은 `.claude/vibe/rules/` 참조.

### 핵심 원칙
- **요청 범위만 수정** - 관련 없는 코드 건드리지 않음
- **기존 스타일 유지** - 프로젝트 컨벤션 따름
- **작동하는 코드 보존** - 불필요한 리팩토링 금지

### 코드 복잡도 제한
| 메트릭 | 제한 |
|--------|------|
| 함수 길이 | 30줄 이하 (권장), 50줄 이하 (허용) |
| 중첩 깊이 | 3단계 이하 |
| 매개변수 | 5개 이하 |
| 순환 복잡도 | 10 이하 |

### 에러 처리 필수
- try-catch 또는 error state 필수
- 로딩 상태 처리
- 사용자 친화적 에러 메시지

### 금지 패턴
- console.log 커밋 금지 (디버깅 후 제거)
- 하드코딩된 문자열/숫자 → 상수로 추출
- 주석 처리된 코드 커밋 금지
- TODO 없이 미완성 코드 커밋 금지

## Workflow

```
/vibe.spec → /vibe.run → /vibe.verify → /vibe.compound
```

## Plan Mode vs VIBE (워크플로우 선택)

**개발 요청 시 사용자에게 선택권 제공:**

| 작업 규모 | 권장 방식 |
|----------|----------|
| 간단한 수정 (1-2 파일) | Plan Mode |
| 복잡한 기능 (3+ 파일, 리서치/검증 필요) | `/vibe.spec` |

| 항목 | Plan Mode | VIBE |
|------|-----------|------|
| 저장 위치 | `~/.claude/plans/` (전역) | `.claude/vibe/specs/` (프로젝트) |
| 문서 형식 | 자유 형식 | PTCF 구조 (AI 실행 최적화) |
| 리서치 | 없음 | 4개 병렬 에이전트 |
| 검증 | 없음 | `/vibe.verify`로 SPEC 대비 검증 |
| 히스토리 | 추적 불가 | Git으로 버전 관리 |

**규칙:**
- `/vibe.analyze` 또는 `/vibe.review` 후 개발/수정 요청 시 → **사용자에게 워크플로우 선택 질문**
- 사용자가 VIBE 선택 → `/vibe.spec` 대기
- 사용자가 Plan Mode 선택 → EnterPlanMode 진행

## ULTRAWORK Mode (권장)

`ultrawork` 또는 `ulw` 키워드를 포함하면 최대 성능 모드 활성화:

```bash
/vibe.run "기능명" ultrawork   # 모든 최적화 자동 활성화
/vibe.run "기능명" ulw         # 동일 (단축어)
```

**활성화 기능:**
- 병렬 서브에이전트 탐색 (3+ 동시)
- **백그라운드 에이전트** - 구현 중 다음 Phase 준비
- **Phase 파이프라이닝** - Phase 간 대기 시간 제거
- Boulder Loop (모든 Phase 완료까지 자동 진행)
- 에러 자동 재시도 (최대 3회)
- 컨텍스트 70%+ 시 자동 압축/저장
- Phase 간 확인 없이 연속 실행

**속도 비교:**

| Mode | Phase당 | 5 Phase |
|------|---------|---------|
| Sequential | ~2분 | ~10분 |
| Parallel Exploration | ~1.5분 | ~7.5분 |
| **ULTRAWORK Pipeline** | **~1분** | **~5분** |

## Commands

| 명령어 | 설명 |
|--------|------|
| `/vibe.spec "기능명"` | SPEC 작성 (PTCF 구조) + 병렬 리서치 |
| `/vibe.run "기능명"` | 구현 실행 |
| `/vibe.run "기능명" ultrawork` | **최대 성능 모드** |
| `/vibe.verify "기능명"` | 검증 |
| `/vibe.review` | **병렬 코드 리뷰** (13+ 에이전트) |
| `/vibe.compound` | **지식 문서화** (해결책 아카이브) |
| `/vibe.e2e` | **E2E 테스트** (Playwright) |
| `/vibe.reason "문제"` | 체계적 추론 |
| `/vibe.analyze` | 프로젝트 분석 |
| `/vibe.diagram` | 다이어그램 생성 |
| `/vibe.ui "설명"` | UI 미리보기 |
| `/vibe.continue` | **세션 복원** (이전 컨텍스트 로드) |

## 새로운 기능 (v2.1.0)

### 병렬 코드 리뷰 (/vibe.review)

13+ 전문 에이전트가 동시에 코드 리뷰:

```
┌─────────────────────────────────────────────────────────────────┐
│  🚀 PARALLEL REVIEW AGENTS                                       │
├─────────────────────────────────────────────────────────────────┤
│  Security          │ security-reviewer, data-integrity-reviewer │
│  Performance       │ performance-reviewer, complexity-reviewer  │
│  Architecture      │ architecture-reviewer, simplicity-reviewer │
│  Language-Specific │ python, typescript, rails, react reviewers │
│  Context           │ git-history, test-coverage reviewers       │
└─────────────────────────────────────────────────────────────────┘
```

**우선순위 시스템:**
- 🔴 P1 (Critical): 머지 차단
- 🟡 P2 (Important): 수정 권장
- 🔵 P3 (Nice-to-have): 백로그

### 지식 복리 (/vibe.compound)

해결한 문제를 자동 문서화:

```
.claude/vibe/solutions/
├── security/           # 보안 해결책
├── performance/        # 성능 최적화
├── database/           # DB 관련
└── integration/        # 외부 연동
```

트리거: "it's fixed", "해결됨", PR 머지 후

### E2E 테스트 (/vibe.e2e)

Playwright 기반 자동화 테스트:

```bash
/vibe.e2e "login flow"        # 시나리오 테스트
/vibe.e2e --visual            # 시각적 회귀 테스트
/vibe.e2e --record            # 비디오 녹화
```

### 리서치 에이전트 강화

`/vibe.spec` 실행 시 **요구사항 확정 후** 4개 병렬 리서치:

```
문답으로 요구사항 확정 → 병렬 리서치 실행 → SPEC 작성
```

| 에이전트 | 역할 |
|----------|------|
| best-practices-agent | 확정된 기능+스택 베스트 프랙티스 |
| framework-docs-agent | 확정된 스택 최신 문서 (context7) |
| codebase-patterns-agent | 기존 유사 패턴 분석 |
| security-advisory-agent | 확정된 기능 보안 권고 |

**⚠️ 리서치는 요구사항 확정 후 실행** (VIBE 원칙: 요구사항 먼저)

## PTCF Structure

SPEC 문서는 AI가 바로 실행 가능한 프롬프트 형태:

```
<role>      AI 역할 정의
<context>   배경, 기술 스택, 관련 코드
<task>      Phase별 작업 목록
<constraints> 제약 조건
<output_format> 생성/수정할 파일
<acceptance> 검증 기준
```

## 내장 도구

### 시맨틱 코드 분석
| 도구 | 용도 |
|------|------|
| `vibe_find_symbol` | 심볼 정의 찾기 |
| `vibe_find_references` | 참조 찾기 |
| `vibe_analyze_complexity` | 복잡도 분석 |
| `vibe_validate_code_quality` | 품질 검증 |

### 컨텍스트 관리
| 도구 | 용도 |
|------|------|
| `vibe_start_session` | 세션 시작 (이전 컨텍스트 복원) |
| `vibe_auto_save_context` | 현재 상태 저장 |
| `vibe_save_memory` | 중요 결정사항 저장 |

## 에이전트

### Review 에이전트 (12개)
```
.claude/agents/review/
├── security-reviewer.md        # 보안 취약점
├── performance-reviewer.md     # 성능 병목
├── architecture-reviewer.md    # 아키텍처 위반
├── complexity-reviewer.md      # 복잡도 초과
├── simplicity-reviewer.md      # 과도한 추상화
├── data-integrity-reviewer.md  # 데이터 무결성
├── test-coverage-reviewer.md   # 테스트 누락
├── git-history-reviewer.md     # 위험 패턴
├── python-reviewer.md          # Python 전문
├── typescript-reviewer.md      # TypeScript 전문
├── rails-reviewer.md           # Rails 전문
└── react-reviewer.md           # React 전문
```

### Research 에이전트 (4개)
```
.claude/agents/research/
├── best-practices-agent.md     # 베스트 프랙티스
├── framework-docs-agent.md     # 프레임워크 문서
├── codebase-patterns-agent.md  # 코드 패턴 분석
└── security-advisory-agent.md  # 보안 권고
```

## 스킬

### Git Worktree
```bash
# PR 리뷰용 격리 환경
git worktree add ../review-123 origin/pr/123
cd ../review-123 && npm test
git worktree remove ../review-123
```

### Priority Todos
```
.claude/vibe/todos/
├── P1-security-sql-injection.md   # 🔴 머지 차단
├── P2-perf-n1-query.md            # 🟡 수정 권장
└── P3-style-extract-helper.md     # 🔵 백로그
```

## 컨텍스트 관리 전략

### 모델 선택
- **탐색/검색**: Haiku (서브에이전트 기본값)
- **구현/디버깅**: Sonnet
- **아키텍처/복잡한 로직**: Opus

### 컨텍스트 70%+ 시 (⚠️ 중요)
```
❌ /compact 사용 금지 (정보 손실/왜곡 위험)
✅ save_memory로 중요 결정사항 저장 → /new로 새 세션
```

vibe는 자체 메모리 시스템으로 세션 간 컨텍스트를 유지합니다:
1. `save_memory` - 중요 결정사항 명시적 저장
2. `/new` - 새 세션 시작
3. `start_session` - 이전 세션 자동 복원

### 세션 복원
새 세션에서 이전 작업을 이어가려면:
```
/vibe.continue
```
이 명령어가 `vibe_start_session`을 호출하여 프로젝트별 메모리에서 이전 컨텍스트를 복원합니다.

### 기타 명령어
- `/rewind` - 이전 시점으로 되돌리기
- `/context` - 현재 사용량 확인

### context7 활용
최신 라이브러리 문서가 필요할 때 context7 MCP 사용:
```
"React 19 use() 훅을 context7으로 검색해줘"
```

## 문서 작성 규칙

### 다이어그램/구조 표현
- 아스키 박스 (┌─┐) 사용 금지 → 한글 폭 문제로 정렬 깨짐
- 대안 사용:
  - Mermaid 다이어그램 (GitHub/노션 지원)
  - 마크다운 테이블
  - 들여쓰기 + 구분선

### 선호 형식
| 용도 | 권장 방식 |
|------|----------|
| 흐름도 | Mermaid flowchart |
| 구조/계층 | 들여쓰기 리스트 |
| 비교/목록 | 마크다운 테이블 |
| 시퀀스 | Mermaid sequenceDiagram |

## Git Commit 규칙

**반드시 포함:**
- `.claude/` 폴더 전체 (commands, agents, skills, settings.json)
- `.claude/vibe/rules/`, `.claude/vibe/specs/`, `.claude/vibe/features/`, `.claude/vibe/solutions/`, `.claude/vibe/todos/`
- `CLAUDE.md`

**제외:**
- `.claude/settings.local.json` (개인 설정, 자동 제외)
- `.claude/vibe/mcp/` (node_modules, 자동 제외)

## Getting Started

```bash
vibe init
/vibe.spec "로그인 기능"
```

## 전체 워크플로우

```
┌─────────────────────────────────────────────────────────────────┐
│  VIBE Complete Workflow                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. /vibe.spec "기능명"                                         │
│     ├── 문답으로 요구사항 수집                                   │
│     ├── 요구사항 확정 후 4개 병렬 리서치                         │
│     └── SPEC 문서 생성                                          │
│                                                                 │
│  2. /vibe.run "기능명" ultrawork                                │
│     ├── 구현                                                    │
│     ├── 테스트                                                  │
│     └── 자동 진행                                               │
│                                                                 │
│  3. /vibe.verify "기능명"                                       │
│     └── BDD 시나리오 검증                                       │
│                                                                 │
│  4. /vibe.review                                                │
│     ├── 13+ 병렬 리뷰 에이전트                                  │
│     └── P1/P2/P3 우선순위 분류                                  │
│                                                                 │
│  5. /vibe.e2e                                                   │
│     └── Playwright E2E 테스트                                   │
│                                                                 │
│  6. /vibe.compound                                              │
│     └── 해결책 문서화 → .claude/vibe/solutions/                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
