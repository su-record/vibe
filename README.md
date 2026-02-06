<div align="center">

# Vibe

### SPEC-driven AI Coding Framework for Claude Code

[![npm version](https://img.shields.io/npm/v/@su-record/core)](https://www.npmjs.com/package/@su-record/core)
[![npm downloads](https://img.shields.io/npm/dt/@su-record/vibe)](https://www.npmjs.com/package/@su-record/vibe)
[![npm downloads](https://img.shields.io/npm/dt/@su-record/core)](https://www.npmjs.com/package/@su-record/core)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-green)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-blue)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**바이브코딩을 쉽게, 최소 품질은 자동으로 보장합니다.**

46개 에이전트 · 41+ 내장 도구 · 34개 스킬 · 4개 LLM 오케스트레이션 · 23개 프레임워크 지원

</div>

---

## Quick Start

```bash
npm install -g @su-record/core
vibe init
```

멀티 LLM 기능을 사용하려면:

```bash
vibe gpt auth            # GPT OAuth (Plus/Pro)
vibe gemini auth         # Gemini OAuth
vibe nvidia key <KEY>    # NVIDIA NIM API 키
```

새 환경 셋업 (한 줄):
```bash
npm i -g @su-record/core && vibe sync login && vibe sync pull
```

---

## 목차

- [왜 Vibe인가](#왜-vibe인가)
- [동작 원리](#동작-원리)
- [멀티 LLM 오케스트레이션](#멀티-llm-오케스트레이션)
- [에이전트 시스템](#에이전트-시스템)
- [오케스트레이터](#오케스트레이터)
- [Session RAG](#session-rag--세션-간-컨텍스트-유지)
- [훅 시스템](#훅-시스템)
- [슬래시 명령어](#슬래시-명령어)
- [41+ 내장 도구](#41-내장-도구)
- [34개 스킬](#34개-스킬)
- [23개 프레임워크 지원](#23개-프레임워크-지원)
- [품질 보장 시스템](#품질-보장-시스템)
- [CLI 명령어](#cli-명령어)
- [인증 동기화 (vibe sync)](#인증-동기화-vibe-sync)
- [매직 키워드](#매직-키워드)
- [프로젝트 구조](#프로젝트-구조)
- [시스템 아키텍처](#시스템-아키텍처)
- [GitHub Packages 배포](#github-packages-배포)

---

## 왜 Vibe인가

AI에게 "로그인 기능 만들어줘"라고 던지면 동작은 하지만 품질은 운에 맡기게 됩니다.
Vibe는 이 문제를 구조로 해결합니다.

| 문제 | Vibe의 해결 |
|------|-----------|
| AI가 `any` 타입을 남발 | Quality Gate가 `any`/`@ts-ignore` 차단 |
| 한 번에 완성된 코드를 기대 | SPEC → 구현 → 검증 단계별 워크플로우 |
| 코드 리뷰 없이 머지 | 13개 에이전트 병렬 리뷰 (보안, 성능, 아키텍처 등) |
| AI 결과를 그대로 수용 | 4개 LLM 교차 검증 (Claude + GPT + Gemini + NVIDIA NIM) |
| 컨텍스트 소실 | Session RAG로 결정사항/목표 자동 저장 및 복원 |
| 복잡한 작업에서 길을 잃음 | SwarmOrchestrator가 자동 분해 + 병렬 실행 |

### 설계 철학

| 원칙 | 설명 |
|------|------|
| **Easy Vibe Coding** | 빠른 흐름, 직관적 개발, AI와 협업하며 생각하기 |
| **Minimum Quality Guaranteed** | 타입 안전성, 코드 품질, 보안 — 자동으로 하한선 확보 |
| **Iterative Reasoning (6번 유형)** | AI에게 답을 맡기지 말고, 문제를 쪼개고 질문하며 함께 추론 |

---

## 동작 원리

```
/vibe.spec "기능"  →  /vibe.spec.review  →  /vibe.run  →  자동 리뷰  →  완료
    SPEC 작성         GPT/Gemini 3라운드     구현 실행      13개 에이전트
```

1. **`/vibe.spec`** — 요구사항을 SPEC 문서로 정의 (GPT + Gemini 병렬 리서치)
2. **`/vibe.spec.review`** — GPT와 Gemini가 3라운드 교차 리뷰
3. **`/vibe.run`** — SPEC 기반으로 구현 실행 + Gemini 실시간 리뷰
4. **자동 리뷰** — 보안, 성능, 아키텍처 등 13개 전문 에이전트가 병렬 검토
5. **P1/P2 자동 수정** — 심각한 이슈는 자동으로 고침

`ultrawork` 키워드를 붙이면 전 과정이 자동화됩니다:
```
/vibe.spec "기능" ultrawork
```
→ Phase 파이프라이닝, 백그라운드 준비, Ralph Loop(100% 완성까지 반복), 자동 저장

---

## 멀티 LLM 오케스트레이션

4개 LLM 프로바이더를 통합하여 작업 유형별 최적의 모델에 자동 라우팅합니다.

### 지원 모델

| 프로바이더 | 모델 | 역할 | 인증 |
|-----------|------|------|------|
| **Claude** | Opus 4.5 / Sonnet 4 / Haiku 4.5 | 오케스트레이션, 코드 생성 | 내장 |
| **GPT** | GPT-5.2-Codex | 아키텍처, 디버깅 | OAuth / API 키 |
| **Gemini** | Gemini 3 Flash / Pro | UI/UX, 웹 검색, 음성 | OAuth / API 키 |
| **NVIDIA NIM** | 7개 모델 (아래 참조) | 코드 분석, 추론, 리뷰 | API 키 |

```bash
vibe gpt auth          # GPT OAuth (Plus/Pro)
vibe gemini auth       # Gemini OAuth
vibe nvidia key <KEY>  # NVIDIA NIM API 키
```

### NVIDIA NIM 모델 라인업

NVIDIA NIM은 작업 유형에 따라 최적의 모델을 자동 선택합니다.

| 모델 | 컨텍스트 | 용도 | 자동 선택 조건 |
|------|---------|------|---------------|
| **kimi-k2.5** | 256K | 범용 기본 모델 | `general` (기본값) |
| **kimi-k2-thinking** | 256K | 심층 추론 (1T MoE) | `reasoning`, `architecture` |
| **kimi-k2-instruct** | 128K | 에이전틱 코딩 (32B active) | `code-analysis` |
| **deepseek-v3.2** | 128K | 멀티스텝 추론 (685B) | `debugging` |
| **qwen3-coder** | 262K | 코드 생성 (480B MoE) | `code-gen` |
| **devstral-2** | 256K | 코드 리뷰 (SWE-Bench 72.2%) | `code-review` |
| **nv-embed** | 8K | 26개 언어 임베딩 | 임베딩 전용 |

### SmartRouter — 작업 유형별 자동 라우팅

SmartRouter가 작업 유형을 분석하여 최적의 LLM을 선택하고, 실패 시 자동으로 다음 프로바이더로 폴백합니다.

| 작업 유형 | 우선순위 (폴백 체인) |
|----------|---------------------|
| 코드 분석, 리뷰, 추론 | Kimi → GPT → Gemini → Claude |
| 아키텍처, 디버깅 | GPT → Kimi → Gemini → Claude |
| UI/UX, 웹 검색 | Gemini → GPT → Claude |
| 코드 생성, 일반 | Kimi → Claude |

**동작 사양:**
- 프로바이더별 **30초 타임아웃**, 최대 2회 재시도 (지수 백오프)
- **5분 가용성 캐시** — 실패한 프로바이더는 5분간 스킵
- 인증/할당량 에러는 즉시 스킵 (재시도 없음)
- 60초 타임아웃 (NVIDIA NIM), 429/5xx 에러 시 3회 재시도

### LLMCluster — 병렬 멀티 LLM 호출

복수의 LLM에 동시에 쿼리하여 교차 검증합니다.

```
사용자 요청
    ↓
LLMCluster.multiQuery(prompt)
    ├→ GPT    ─→ 응답 A  (gptOrchestrate)
    ├→ Gemini ─→ 응답 B  (geminiOrchestrate)
    └→ NVIDIA ─→ 응답 C  (nvidiaOrchestrate)
    ↓
교차 검증 → 최종 결과
```

- 모든 프로바이더에 동시 요청 (non-blocking)
- 개별 실패는 전체에 영향 없음 (graceful degradation)
- JSON 모드 지원 (`jsonMode` 옵션으로 구조화된 출력)
- `/vibe.spec` 리서치, `/vibe.review` 코드 리뷰에서 활용

### ReviewRace — 병렬 코드 리뷰 + 교차 검증

GPT와 Gemini가 동시에 코드를 리뷰하고, 결과를 교차 검증하여 신뢰도를 산출합니다.

**리뷰 유형** (7종):
보안, 성능, 아키텍처, 복잡도, 데이터 무결성, 테스트 커버리지, 일반

**교차 검증 알고리즘:**
1. 각 LLM의 리뷰 결과를 JSON으로 파싱
2. 유사 이슈 클러스터링:
   - 위치 일치 (동일 파일:라인)
   - 제목 Jaccard 유사도 > 0.5
   - 공유 키워드 (injection, xss, csrf, auth, leak 등)
3. 신뢰도 산출: `발견한 프로바이더 수 / 전체 프로바이더 수`
4. 우선순위 자동 결정:

| 우선순위 | 조건 |
|----------|------|
| **P1 (긴급)** | 신뢰도 >= 0.9 AND 심각도 critical/high |
| **P2 (중요)** | 신뢰도 >= 0.6 OR 심각도 medium |
| **P3 (참고)** | 신뢰도 < 0.6 OR 심각도 low |

P1/P2 이슈는 자동으로 수정됩니다.

---

## 에이전트 시스템

46개 전문 에이전트가 각자의 역할에 맞게 작업을 수행합니다.

### 메인 에이전트 (24)

| 에이전트 | 등급 | 역할 |
|----------|------|------|
| **Explorer** | High/Medium/Low | 코드베이스 탐색, 구조 파악 |
| **Implementer** | High/Medium/Low | 코드 구현 |
| **Architect** | High/Medium/Low | 아키텍처 설계 |
| **Searcher** | - | 코드 검색 |
| **Tester** | - | 테스트 생성 |
| **Simplifier** | - | 코드 단순화 |
| **Refactor Cleaner** | - | 리팩토링 정리 |
| **Build Error Resolver** | - | 빌드 에러 수정 |
| **Compounder** | - | 복합 작업 처리 |
| **Diagrammer** | - | 다이어그램 생성 |
| **E2E Tester** | - | E2E 테스트 실행 |
| **UI Previewer** | - | UI 미리보기 |
| **Junior Mentor** | - | 주니어 개발자 멘토링 |
| **Quality Reviewer** | - | 품질 리뷰 |

**스페셜리스트:**
- Backend Python Expert
- Database Postgres Expert
- Frontend Flutter Expert
- Frontend React Expert

### 리뷰 에이전트 (12)

| 에이전트 | 전문 분야 |
|----------|----------|
| Security Reviewer | 보안 취약점 (OWASP Top 10) |
| Performance Reviewer | 성능 병목 |
| Architecture Reviewer | 아키텍처 패턴 |
| Complexity Reviewer | 순환 복잡도, 중첩 깊이 |
| Simplicity Reviewer | 불필요한 복잡성 |
| Data Integrity Reviewer | 데이터 무결성 |
| Test Coverage Reviewer | 테스트 커버리지 |
| Git History Reviewer | 커밋 히스토리 품질 |
| TypeScript Reviewer | TS 타입 안전성 |
| Python Reviewer | Python 코드 품질 |
| Rails Reviewer | Rails 규약 |
| React Reviewer | React 패턴 |

### 리서치 에이전트 (4)

| 에이전트 | 역할 |
|----------|------|
| Best Practices | 업계 베스트 프랙티스 조사 |
| Framework Docs | 프레임워크 공식 문서 참조 |
| Codebase Patterns | 기존 코드베이스 패턴 분석 |
| Security Advisory | 보안 권고 조사 |

### QA & 기획 에이전트 (6)

| 에이전트 | 역할 |
|----------|------|
| Requirements Analyst | 요구사항 분석 |
| UX Advisor | UX 개선 제안 |
| Acceptance Tester | 인수 테스트 |
| Edge Case Finder | 엣지 케이스 탐색 |
| API Documenter | API 문서 생성 |
| Changelog Writer | 변경 로그 작성 |

---

## 오케스트레이터

### SwarmOrchestrator — 자동 작업 분해

복잡한 요청을 자동으로 서브태스크로 분해하여 병렬 실행합니다.

```
"인증 시스템 구현해줘"
    ↓ (복잡도 분석)
    ↓ 복잡도 15점 이상 → 분해
    ├→ 서브태스크 1: DB 스키마 설계
    ├→ 서브태스크 2: API 엔드포인트 구현
    ├→ 서브태스크 3: 프론트엔드 폼
    └→ 서브태스크 4: 테스트 작성
    ↓ (병렬 실행 → 결과 병합)
```

**복잡도 분석 알고리즘:**
- 프롬프트 길이 (>500자: +5, >1000자: +5)
- 키워드 가중치: implement/create(3), refactor(4), multiple(2), test(2), security(3), database(3), api(2), phase(2)
- 파일 멘션 수 (*.ts/*.js/*.py 등) × 2
- 번호 리스트 항목 수 × 2
- **분해 임계값: 15점**

**구성:**
- 최대 깊이 2단계, 동시 실행 5개
- 기본 타임아웃: 5분
- 분해 전략: 번호 섹션 → 접속사(and/or) → 문장 그룹
- 작업 상태: `pending → analyzing → running/splitting → completed/failed`

### PhasePipeline — 단계별 실행

구현을 여러 Phase로 나누어 순차 실행합니다. 각 Phase는 `prepare()` → `execute()` → `cleanup()` 생명주기를 가집니다.

| Phase | prepare() | execute() | cleanup() |
|-------|-----------|-----------|-----------|
| 1. 분석 | - | 코드 탐색 | - |
| 2. 설계 | 다음 Phase 준비 (ULTRAWORK) | 아키텍처 결정 | - |
| 3. 구현 | 다음 Phase 준비 (ULTRAWORK) | 코드 작성 | - |
| 4. 검증 | - | 테스트 실행 | 정리 |

**ULTRAWORK 모드:** 현재 Phase 실행 중에 다음 Phase의 `prepare()`를 백그라운드로 미리 실행하여 Phase 간 대기 시간을 제거합니다.

- Phase별 최대 3회 재시도
- 진행 상황을 `.claude/vibe/progress.json`에 실시간 기록
- 전체 타임아웃: 30분

### BackgroundManager — 비동기 에이전트 실행

**동시성 제어:**
- 모델별 동시 실행 제한 (CONCURRENCY.MODEL_LIMITS)
- 프로바이더별 동시 실행 제한 (CONCURRENCY.PROVIDER_LIMITS)
- 바운디드 큐 (큐 오버플로 방지)

**태스크 생명주기:** `pending → running → completed/failed/cancelled`

**자동 정리:**
- 24시간 이상 된 완료 태스크 → 10분 주기로 자동 삭제
- `QueueOverflowError`, `TaskTimeoutError`, `PipelineTimeoutError`, `AgentExecutionError` 구조화된 에러

### AgentRegistry — 실행 추적 + 크래시 감지

SQLite WAL 모드 기반 에이전트 실행 추적 시스템.

**기능:**
- 실행 시작/완료/실패 기록
- 고아 프로세스 감지 (1시간 이상 running → orphaned 마킹)
- 에이전트별/전역 통계 조회
- 실행 이력 조회 (에이전트별 필터링)
- 24시간 TTL 자동 정리

**보안:**
- API 키/토큰 패턴 자동 마스킹
- 텍스트 2000자 제한 (prompt, result)
- 파일 권한 0o600 (소유자만 읽기/쓰기)

---

## Session RAG — 세션 간 컨텍스트 유지

SQLite + FTS5 하이브리드 검색으로 세션 간 결정사항, 목표, 제약조건을 저장하고 복원합니다.

### 4가지 엔티티

| 엔티티 | 설명 | 주요 필드 |
|--------|------|-----------|
| **Decision** | 사용자가 확인한 결정사항 | title, rationale, alternatives, impact, priority, status(active/superseded/cancelled) |
| **Constraint** | 명시적 제약조건 | title, type(technical/business/resource/quality), severity(low~critical), scope |
| **Goal** | 현재 목표 (계층 지원) | title, status(active/completed/blocked/cancelled), priority, progressPercent(0-100), parentId, successCriteria |
| **Evidence** | 검증/테스트 결과 | title, type(test/build/lint/coverage/hud/review), status(pass/fail/warning/info), metrics, relatedGoals |

### 하이브리드 검색 알고리즘

```
최종 점수 = BM25 점수 × 0.4 + 최신성 점수 × 0.3 + 우선순위 점수 × 0.3
```

- **BM25 (40%)** — FTS5 전문 검색 (제목+설명), BM25 랭크를 0~1로 정규화
- **최신성 (30%)** — 지수 감쇠 함수: `exp(-age × ln(2) / 7일)` (7일 반감기)
- **우선순위 (30%)** — 엔티티 유형별 가중치 (활성 Goal > 완료된 Goal 등)

FTS5 실패 시 LIKE 쿼리로 자동 폴백. 엔티티 유형별 기본 5개 결과 반환.

### 사용 흐름

```
/vibe.spec "기능"
  → 결정: "JWT 사용" (Decision 저장)
  → 제약: "외부 DB 없음" (Constraint 저장)
  → 목표: "인증 시스템 구현" (Goal 저장)

/new (새 세션)

/vibe.run "기능"
  → retrieveSessionContext("인증")
  → 이전 결정/제약/목표 자동 복원
  → 빌드 성공 (Evidence 저장)
```

**세션 시작 시 자동 주입:** `start_session` 호출 시 활성 Goals, 중요 Constraints, 최근 Decisions가 자동으로 세션 컨텍스트에 포함됨.

---

## 훅 시스템

Claude Code의 이벤트에 자동으로 반응하는 훅 스크립트입니다.

| 이벤트 | 스크립트 | 역할 |
|--------|---------|------|
| **SessionStart** | `session-start.js` | 세션 컨텍스트 복원, 메모리 로드 |
| **PreToolUse[Bash]** | `pre-tool-guard.js` | 파괴적 명령어 차단 (rm -rf, force push 등) |
| **PreToolUse[Edit/Write]** | `pre-tool-guard.js` | 스코프 벗어난 수정 방지 |
| **PostToolUse[Write/Edit]** | `code-check.js` | 린트, 타입 체크, 품질 검증, 관찰 기록 |
| **PostToolUse[Edit]** | `post-edit.js` | Git 인덱스 업데이트 |
| **UserPromptSubmit** | `prompt-dispatcher.js` | `/vibe.spec`, `/vibe.run` 등 명령어 라우팅 |
| **UserPromptSubmit** | `skill-injector.js` | 스킬 자동 주입 |
| **UserPromptSubmit** | `keyword-detector.js` | `ultrawork`, `ralph` 등 매직 키워드 감지 |
| **UserPromptSubmit** | `hud-status.js` | HUD 상태 업데이트 |
| **Notification[80%]** | `context-save.js` | 컨텍스트 80% → 메모리 자동 저장 (medium) |
| **Notification[90%]** | `context-save.js` | 컨텍스트 90% → 적극적 저장 (high) |
| **Notification[95%]** | `context-save.js` | 컨텍스트 95% → 세션 내보내기 (critical) |

추가 훅: `code-review.js`, `llm-orchestrate.js`, `recall.js`, `complexity.js`, `compound.js`

### code-check.js 상세

Write/Edit 후 자동 실행되는 품질 게이트:

1. 수정된 파일 경로 추출
2. `validateCodeQuality()` 호출 — `any` 타입, `@ts-ignore`, 복잡도 초과 등 검사
3. 관찰 메타데이터 분류: 테스트 파일 → `feature`, 설정 파일 → `refactor`
4. 실패 시 로그 출력 후 계속 진행 (non-blocking)

---

## 슬래시 명령어

### 전체 목록 (10개)

| 명령어 | 설명 |
|--------|------|
| `/vibe.spec "기능"` | SPEC 작성 + GPT/Gemini 병렬 리서치 (PTCF 구조) |
| `/vibe.spec.review "기능"` | GPT/Gemini 3라운드 교차 리뷰 (새 세션 권장) |
| `/vibe.run "기능"` | SPEC 기반 구현 실행 + Gemini 실시간 리뷰 |
| `/vibe.verify "기능"` | SPEC 대비 BDD 검증 |
| `/vibe.review` | 13개 에이전트 병렬 코드 리뷰 (P1/P2/P3 자동 분류) |
| `/vibe.trace "기능"` | 요구사항 추적성 매트릭스 |
| `/vibe.reason "문제"` | 체계적 추론 프레임워크 |
| `/vibe.analyze` | 프로젝트 분석 |
| `/vibe.voice` | 음성 → 코딩 명령 (Gemini + sox) |
| `/vibe.utils` | 유틸리티 (E2E 테스트, 다이어그램, UI 미리보기, 세션 복원) |

### 권장 워크플로우

```
/vibe.spec "기능"          ← SPEC 정의
    ↓
/new                       ← 새 세션 (컨텍스트 정리)
    ↓
/vibe.spec.review "기능"   ← GPT/Gemini 3라운드 리뷰
    ↓
/vibe.run "기능"           ← 구현 실행
    ↓
/vibe.trace "기능"         ← 요구사항 추적
    ↓
(자동) 13+ 에이전트 리뷰   ← P1/P2 자동 수정
    ↓
완료
```

### SPEC 문서 구조 (PTCF)

| 섹션 | 설명 |
|------|------|
| `<role>` | AI 역할 정의 |
| `<context>` | 프로젝트 컨텍스트 |
| `<task>` | 구현 작업 |
| `<constraints>` | 제약조건 |
| `<output_format>` | 출력 형식 |
| `<acceptance>` | 인수 기준 |

---

## 41+ 내장 도구

### 메모리 & 세션 (21)

| 도구 | 역할 |
|------|------|
| `save_session_item` | Decision/Constraint/Goal/Evidence 저장 |
| `retrieve_session_context` | 하이브리드 검색 (BM25 + 최신성 + 우선순위) |
| `manage_goals` | Goal 생명주기 관리 (list/update/complete) |
| `core_save_memory` | 중요 결정사항 메모리 저장 |
| `core_recall_memory` | 저장된 메모리 회상 |
| `core_list_memories` | 전체 메모리 목록 |
| `core_search_memories` | 메모리 검색 |
| `core_search_memories_advanced` | 고급 메모리 검색 |
| `core_link_memories` | 관련 메모리 연결 |
| `core_get_memory_graph` | 메모리 그래프 시각화 |
| `core_create_memory_timeline` | 메모리 타임라인 생성 |
| `core_start_session` | 이전 세션 컨텍스트 복원 |
| `core_auto_save_context` | 현재 상태 자동 저장 |
| `core_restore_session_context` | 세션 컨텍스트 복원 |
| `core_prioritize_memory` | 메모리 우선순위 지정 |
| `core_add_observation` | 관찰 기록 추가 |
| `core_search_observations` | 관찰 기록 검색 |
| `core_update_memory` | 메모리 업데이트 |
| `core_delete_memory` | 메모리 삭제 |
| `core_get_session_context` | 현재 세션 컨텍스트 조회 |
| `core_ask_user` | 사용자 질문 |

### 코드 품질 & 분석 (8)

| 도구 | 역할 |
|------|------|
| `core_find_symbol` | 심볼 정의 검색 |
| `core_find_references` | 참조 검색 |
| `core_analyze_dependency_graph` | 의존성 그래프 분석 |
| `core_analyze_complexity` | 순환 복잡도 분석 |
| `core_validate_code_quality` | 품질 검증 (`any`, `@ts-ignore` 차단) |
| `core_check_coupling_cohesion` | 커플링/응집도 체크 |
| `core_suggest_improvements` | 개선 제안 |
| `core_apply_quality_rules` | 품질 규칙 적용 |

### SPEC & 테스트 (9)

| 도구 | 역할 |
|------|------|
| `core_spec_generator` | SPEC 문서 생성 (PTCF 형식) |
| `core_prd_parser` | PRD 문서 파싱 |
| `core_traceability_matrix` | 추적성 매트릭스 생성 |
| `core_e2e_test_generator` | E2E 테스트 생성 |
| `core_spec_versioning` | SPEC 버전 관리 |
| `core_requirement_id` | 요구사항 ID 생성 |
| `core_preview_ui_ascii` | ASCII UI 미리보기 |
| `core_get_current_time` | 현재 시간 (소요 시간 추적) |
| `core_ask_user` | 사용자 상호작용 |

---

## 34개 스킬

에이전트가 특정 도메인 지식을 활용할 수 있는 스킬 모듈입니다.

### 코어 스킬 (18)

| 스킬 | 역할 |
|------|------|
| Brand Assets | 브랜드 가이드라인 |
| Commerce Patterns | 이커머스 패턴 |
| Commit Push PR | Git 워크플로우 |
| Context7 Usage | 컨텍스트 윈도우 최적화 |
| Core Capabilities | Vibe 핵심 기능 활용법 |
| E2E Commerce | E2E 커머스 테스트 패턴 |
| Frontend Design | 프론트엔드 베스트 프랙티스 |
| Git Worktree | Git worktree 패턴 |
| Handoff | 개발자 핸드오프 |
| Multi-LLM Orchestration | 멀티 LLM 활용법 |
| Parallel Research | 병렬 리서치 기법 |
| Priority Todos | TODO 우선순위화 |
| SEO Checklist | SEO 체크리스트 |
| Tech Debt | 기술 부채 관리 |
| Tool Fallback | 도구 폴백 전략 |
| TypeScript Advanced Types | 고급 TypeScript 타입 |
| Vercel React | React + Vercel 패턴 |
| Vibe Capabilities | Vibe 전체 기능 가이드 |

### 도메인별 스킬

**핵심 (3):** Communication Guide, Development Philosophy, Quick Start

**언어별 (5):** TypeScript-Next.js, TypeScript-React, TypeScript-React Native, Python-FastAPI, Dart-Flutter

**품질 (2):** Checklist, Testing Strategy

**표준 (4):** Anti-Patterns, Code Structure, Complexity Metrics, Naming Conventions

**도구 (2):** MCP Hi-AI Guide, MCP Workflow

---

## 23개 프레임워크 지원

프로젝트의 기술 스택을 자동 감지하고, 해당 프레임워크의 코딩 규칙을 적용합니다.
모노레포도 지원합니다 (pnpm-workspace, npm workspaces, Lerna, Nx, Turborepo).

**TypeScript (12)** — Next.js, React, Angular, Vue, Svelte, Nuxt, NestJS, Node, Electron, Tauri, React Native, Astro

**Python (2)** — Django, FastAPI

**Java/Kotlin (4)** — Spring Boot, Java, Android, Kotlin

**기타 (5)** — Rails (Ruby), Go, Rust, Swift (iOS), Unity (C#), Flutter (Dart), Godot (GDScript)

### 자동 감지 대상

| 카테고리 | 감지 항목 |
|----------|----------|
| **데이터베이스** | PostgreSQL, MySQL, MongoDB, Redis, SQLite, Prisma, Drizzle, Sequelize, TypeORM |
| **상태 관리** | Redux, Zustand, Jotai, Recoil, MobX, React Query, SWR, Pinia, Vuex, Riverpod, BLoC, GetX, Provider |
| **CI/CD** | GitHub Actions, GitLab CI, Jenkins, CircleCI |
| **호스팅** | Vercel, Netlify, Google Cloud, Docker, Fly.io, Railway |

---

## 품질 보장 시스템

| 가드레일 | 메커니즘 | 동작 |
|----------|---------|------|
| **타입 안전성** | Quality Gate | `any`, `@ts-ignore` 사용 시 차단 |
| **코드 리뷰** | ReviewRace | GPT + Gemini 병렬 리뷰 → Jaccard 교차 검증 |
| **완성도** | Ralph Loop | `ralph` 키워드 시 100%까지 반복 (범위 축소 없음) |
| **멀티 LLM** | LLMCluster | 4개 관점 교차 검증 |
| **스코프 보호** | pre-tool-guard | 요청 범위 외 코드 수정 방지 |
| **컨텍스트 보호** | context-save | 80/90/95%에서 자동 저장 |

### 코드 복잡도 제한

| 메트릭 | 제한 |
|--------|------|
| 함수 길이 | ≤30줄 (권장), ≤50줄 (허용) |
| 중첩 깊이 | ≤3단계 |
| 매개변수 | ≤5개 |
| 순환 복잡도 | ≤10 |

### 코딩 규칙 (10개 파일, 2,704줄)

| 카테고리 | 규칙 |
|----------|------|
| **핵심** | Development Philosophy, Communication Guide, Quick Start |
| **품질** | BDD Contract Testing, Checklist, Testing Strategy |
| **표준** | Anti-Patterns, Code Structure, Complexity Metrics, Naming Conventions |

---

## CLI 명령어

```bash
# 프로젝트
vibe init [project]      # 프로젝트 초기화
vibe update              # 설정 업데이트 (자동 npm 업그레이드 포함)
vibe status              # 상태 확인 (LLM 인증, 프로젝트, 기능)
vibe remove              # 제거

# HUD
vibe hud show            # HUD 표시
vibe hud start           # HUD 시작
vibe hud phase           # Phase 표시
vibe hud agent           # 에이전트 표시
vibe hud context         # 컨텍스트 표시
vibe hud reset           # HUD 초기화

# GPT
vibe gpt auth            # GPT OAuth (Plus/Pro)
vibe gpt key <KEY>       # GPT API 키 설정
vibe gpt status          # GPT 상태 확인
vibe gpt logout          # GPT 로그아웃

# Gemini
vibe gemini auth         # Gemini OAuth
vibe gemini key <KEY>    # Gemini API 키 설정
vibe gemini status       # Gemini 상태 확인
vibe gemini logout       # Gemini 로그아웃

# NVIDIA NIM
vibe nvidia key <KEY>    # NVIDIA NIM API 키 설정
vibe nvidia status       # NVIDIA NIM 상태 (7개 모델 목록 포함)
vibe nvidia logout       # NVIDIA NIM 로그아웃

# 인증 동기화
vibe sync login          # Google 계정 연결
vibe sync push           # 인증/메모리 업로드
vibe sync pull           # 인증/메모리 복원
vibe sync status         # 동기화 상태 확인
vibe sync logout         # 연결 해제

# 정보
vibe help                # 도움말
vibe version             # 버전
```

### 인증 우선순위

| 프로바이더 | 우선순위 |
|-----------|---------|
| **GPT** | OAuth → API Key → Azure OpenAI |
| **Gemini** | gemini-cli 자동감지 → OAuth → API Key |
| **NVIDIA** | API Key (NVIDIA_API_KEY / MOONSHOT_API_KEY / KIMI_API_KEY) |

---

## 인증 동기화 (vibe sync)

작업 환경이 바뀔 때마다 GPT, Gemini, NVIDIA, Kimi 인증을 반복하는 문제를 해결합니다.
Google Drive AppData에 암호화된 인증 정보를 저장하고, 새 환경에서 한 줄로 복원합니다.

### 사용법

```bash
# 1. Google 계정 연결 (1회)
vibe sync login

# 2. 현재 인증 정보를 클라우드에 업로드
vibe sync push

# 3. 새 환경에서 복원
vibe sync pull

# 4. 선택적 동기화
vibe sync push --only auth       # 인증만
vibe sync push --only memory     # 메모리만
vibe sync pull --only auth       # 인증만 복원

# 5. 상태 확인 / 연결 해제
vibe sync status
vibe sync logout
```

새 환경 셋업 (한 줄):
```bash
npm i -g @su-record/core && vibe sync login && vibe sync pull
```

### 동기화 대상

| 카테고리 | 파일 | 경로 |
|----------|------|------|
| **인증** | gemini-auth.json, gemini-apikey.json | `~/.config/vibe/` |
| | gpt-auth.json, gpt-apikey.json | `~/.config/vibe/` |
| | nvidia-apikey.json, kimi-apikey.json | `~/.config/vibe/` |
| **전역 메모리** | session-rag.db (결정/제약/목표/증거) | `~/.claude/vibe/` |
| | memories.json (저장된 메모리) | `~/.claude/vibe/` |

다른 노트북에서 동일 작업을 이어갈 때, 이전 환경에서의 결정사항과 컨텍스트를 그대로 사용 가능합니다.

> 프로젝트별 설정(`.claude/vibe/config.json`)은 git으로 관리하므로 동기화 대상이 아님

### 아키텍처

```
┌─────────────┐     OAuth      ┌──────────────┐
│  vibe CLI   │ ←──────────→   │ Google OAuth  │
│             │                │ (브라우저)     │
└──────┬──────┘                └──────────────┘
       │
       │ push: 로컬 키 수집 → 암호화 → Drive 업로드
       │ pull: Drive 다운로드 → 복호화 → 로컬 키 복원
       │
┌──────▼──────┐
│ Google Drive │
│  AppData/   │
│  vibe-sync/ │
│   auth.enc  │  ← 인증 키 (AES-256-GCM 암호화)
│  memory.enc │  ← 전역 메모리 (AES-256-GCM 암호화)
└─────────────┘
```

### 핵심 설계

| 항목 | 설명 |
|------|------|
| **Gemini 인증과 독립** | Sync용 Google 계정은 Gemini OAuth와 별도. 동일/다른 계정 모두 가능 |
| **Google Drive AppData** | `drive.appdata` 스코프 — 사용자 Drive UI에 보이지 않는 앱 전용 공간 |
| **암호화** | AES-256-GCM. 기본: 자동 생성 키, 옵션: `--passphrase`로 사용자 패스프레이즈 추가 |
| **최소 권한** | `drive.appdata`만 사용 — 사용자의 다른 Drive 파일 접근 불가 |
| **OAuth 플로우** | PKCE + localhost 콜백 (포트 51122). 기존 Gemini OAuth 패턴 재사용 |
| **충돌 처리** | push: 덮어쓰기 (최신 wins), pull: 클라우드 버전으로 교체 (로컬 백업 생성) |

### 보안

| 항목 | 대응 |
|------|------|
| 전송 중 암호화 | HTTPS (Google API 기본) |
| 저장 시 암호화 | AES-256-GCM (Drive에 암호문만 저장) |
| 토큰 노출 방지 | 파일 권한 0o600, .gitignore 포함 |
| 스코프 최소화 | `drive.appdata`만 사용 |

> 상세 설계 문서: [docs/auth-sync-design.md](docs/auth-sync-design.md)

---

## 매직 키워드

명령어에 키워드를 추가하면 동작이 바뀝니다.

| 키워드 | 효과 |
|--------|------|
| `ultrawork` / `ulw` | 병렬 처리 + Phase 파이프라이닝 + 백그라운드 prepare() + 자동 계속 + Ralph Loop |
| `ralph` | 100% 완성까지 반복 (범위 축소 없음) |
| `ralplan` | 반복적 계획 수립 + 영속화 |
| `verify` | 엄격 검증 모드 |
| `quick` | 빠른 모드, 최소 검증 |

---

## 프로젝트 구조

```
your-project/
├── .claude/
│   └── vibe/
│       ├── config.json        # 모델 설정, 스택 감지 결과
│       ├── constitution.md    # 프로젝트 원칙
│       ├── specs/             # SPEC 문서
│       ├── features/          # 기능 추적
│       ├── todos/             # 이슈 추적 (P1/P2/P3)
│       ├── reports/           # 리뷰 및 분석 리포트
│       └── agents/
│           └── registry.db    # 에이전트 실행 추적 (SQLite WAL)
├── CLAUDE.md                  # 프로젝트 가이드 (자동 생성)
└── ...
```

전역 설정:
```
~/.config/vibe/                # LLM 인증 토큰/키
~/.claude/vibe/
│   ├── rules/                 # 코딩 규칙 (10개 파일, 2,704줄)
│   ├── session-rag.db         # Session RAG (SQLite + FTS5)
│   └── memories.json          # 저장된 메모리
~/.claude/commands/            # 슬래시 명령어 (10개)
~/.claude/agents/              # 에이전트 정의 (46개)
~/.claude/skills/              # 스킬 정의 (34개)
```

---

## 시스템 아키텍처

```
사용자 요청
    ↓
keyword-detector.js (ultrawork/ralph/quick 감지)
    ↓
prompt-dispatcher.js (명령어 라우팅)
    ↓
SmartRouter (작업 유형별 LLM 선택 + 폴백 체인)
    ↓
    ├→ LLMCluster (병렬 멀티 LLM 리서치)
    │   ├→ GPT (gpt-5.2-codex)
    │   ├→ Gemini (gemini-3-flash/pro)
    │   └→ NVIDIA NIM (7개 모델 자동 선택)
    │
    ├→ PhasePipeline (순차 Phase 실행)
    │   ├→ SwarmOrchestrator (복잡도 15+ → 자동 분해)
    │   │   └→ BackgroundManager (비동기 에이전트 큐)
    │   │       └→ ConcurrencyManager (모델/프로바이더별 제한)
    │   │           └→ AgentRegistry (SQLite WAL 실행 추적)
    │   │
    │   └→ ULTRAWORK: 현재 Phase 중 다음 Phase prepare() 병렬 실행
    │
    └→ ReviewRace (구현 후 코드 리뷰)
        ├→ GPT 리뷰 + Gemini 리뷰 (병렬)
        └→ 교차 검증 (Jaccard > 0.5 클러스터링 → P1/P2/P3)

Session RAG 루프:
    saveSessionItem() → Decision/Constraint/Goal/Evidence 저장
    → retrieveSessionContext() → BM25×0.4 + 최신성×0.3 + 우선순위×0.3
    → context-save.js → 컨텍스트 80/90/95% 도달 시 자동 저장

품질 게이트:
    pre-tool-guard.js → 파괴적 명령어/스코프 이탈 차단
    code-check.js → 타입 안전성/복잡도 검증
    post-edit.js → Git 인덱스 동기화
```

---

## GitHub Packages 배포

패키지는 **GitHub Packages**로 비공개 배포됩니다. Release 발행 시 자동 배포되며, 설치 시 인증(PAT, `read:packages`)이 필요합니다. 상세한 배포·설치 방법은 [docs/github-packages.md](docs/github-packages.md)를 참고하세요.

---

## 요구사항

- **Node.js** >= 18.0.0
- **Claude Code** (필수 — Claude Code 전용 프레임워크)
- GPT, Gemini, NVIDIA NIM은 선택사항 (멀티 LLM 기능용)
- sox는 선택사항 (`/vibe.voice` 음성 입력용)

### 주요 의존성

| 패키지 | 용도 |
|--------|------|
| `@anthropic-ai/claude-agent-sdk` | Claude Agent SDK |
| `better-sqlite3` | Session RAG, AgentRegistry |
| `ts-morph` | TypeScript AST 조작 |
| `chalk` | 터미널 색상 |
| `glob` | 파일 패턴 매칭 |

## 라이선스

MIT
