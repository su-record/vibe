# Vibe

**SPEC-driven AI coding framework (Claude Code 전용)**

SPEC 문서 하나로 AI가 바로 구현하고, **시나리오별 자동 검증**으로 품질을 보장하는 프레임워크.

> **품질은 사용자가 신경 쓰는 게 아니라, 시스템이 보장하는 것.**

[![npm version](https://img.shields.io/npm/v/@su-record/vibe.svg)](https://www.npmjs.com/package/@su-record/vibe)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built-in Tools](https://img.shields.io/badge/Built--in_Tools-36-blue.svg)](https://github.com/su-record/vibe)

---

## Features

- **🤖 멀티모델 AI 오케스트레이션**: Claude + GPT + Gemini를 서브에이전트로 통합 (OAuth 인증)
- **시나리오 주도 개발 (SDD)**: 각 시나리오 = 구현 단위 = 검증 단위
- **BDD 자동 검증**: Given/When/Then 단계별 자동 품질 검증
- **품질 보장 시스템**: 비개발자도 품질을 신뢰할 수 있는 자동화
- **ULTRAWORK Mode**: `ulw` 한 단어로 모든 최적화 자동 활성화
- **Boulder Loop**: 모든 시나리오 완료까지 자동 진행
- **병렬 서브에이전트**: Haiku 3+ 동시 탐색으로 ~3배 속도 향상
- **자동 컨텍스트 관리**: 80%+ 시 자동 저장, 세션 자동 복원
- **36개 내장 도구**: 코드 분석, 품질 검증, 세션 메모리 (MCP 오버헤드 제거)

### v2.3.0 신규 기능

- **📦 14개 프레임워크별 언어 룰**: Next.js, React, Vue, Nuxt, React Native 등 프레임워크별 최적화 규칙
- **🔄 모노레포 완벽 지원**: packages/*, apps/* 하위 패키지별 자동 감지 및 룰 적용
- **🧹 레거시 자동 정리**: `vibe update` 시 이전 버전 파일 자동 정리
- **⚙️ 명령어 구조 개선**: 7개 core 명령어 + `/vibe.utils` 유틸리티 통합

### v2.2.0 기능

- **⚡ ULTRAWORK Pipeline**: 구현 중 백그라운드 에이전트로 다음 Phase 준비
- **🔄 Phase 파이프라이닝**: Phase 간 대기 시간 제거 (~50% 속도 향상)

### v2.1.0 기능

- **🔍 병렬 코드 리뷰**: 13+ 전문 에이전트가 동시 리뷰 (P1/P2/P3 우선순위)
- **🎭 E2E 테스트**: Playwright 기반 브라우저 자동화 (시각적 회귀, 비디오 녹화)
- **📚 지식 복리**: 해결책 자동 문서화 → `.claude/vibe/solutions/`
- **🔬 병렬 리서치**: 요구사항 확정 후 4개 에이전트 동시 조사

---

## Installation

### CLI 설치

```bash
npm install -g @su-record/vibe
vibe init
```

CLI 설치 시 생성되는 구조:

```text
project/
├── CLAUDE.md              # 프로젝트 컨텍스트
└── .claude/
    ├── commands/          # 슬래시 커맨드 (7개)
    ├── agents/            # 서브에이전트
    │   ├── review/        # 리뷰 에이전트 (12개)
    │   └── research/      # 리서치 에이전트 (4개)
    ├── settings.json      # Hooks 설정
    └── vibe/
        ├── rules/         # 코딩 규칙
        ├── specs/         # SPEC 문서
        ├── features/      # BDD Feature 파일
        └── config.json    # 프로젝트 설정
```

---

## Quick Start

```bash
# 기존 프로젝트에서
vibe init
# → 커맨드/에이전트 설치 + MCP 서버 등록 (context7, vibe-gemini, vibe-gpt)

# 새 프로젝트 생성
vibe init my-project
cd my-project
```

### 슬래시 커맨드 사용 (Claude Code)

```
/vibe.spec "로그인 기능"              # SPEC 작성 (대화형)
/vibe.run "로그인 기능"               # 구현 실행
/vibe.run "로그인 기능" ultrawork     # 🚀 최대 성능 모드 (권장)
/vibe.verify "로그인 기능"            # 검증
```

---

## Workflow

```
/vibe.spec "기능명"
  ↓ 대화형 요구사항 수집
  ↓ 요구사항 확정 후 4개 병렬 리서치
  ↓ .claude/vibe/specs/{기능명}.md + .feature

/vibe.run "기능명" ultrawork
  ↓ 시나리오별 구현 + 즉시 검증 (SDD)
  ↓ Scenario 1 → Scenario 2 → ...

/vibe.verify "기능명"
  ↓ Given/When/Then 단계별 검증

/vibe.review
  ↓ 13+ 병렬 리뷰 에이전트 (P1/P2/P3)

/vibe.analyze "기능명"
  ↓ 코드 탐색/구조 분석

/vibe.reason "문제"
  ↓ 9단계 체계적 추론

/vibe.utils --옵션
  ↓ 유틸리티 (--ui, --diagram, --e2e, --compound)
```

### 시나리오 주도 개발 (SDD)

> **각 시나리오가 곧 구현 단위이자 검증 단위입니다.**

```
Feature 로드 → Scenario 1 [구현→검증] → Scenario 2 [구현→검증] → ... → 품질 리포트
                    ↓                        ↓
               ✅ 통과 시 다음         ❌ 실패 시 수정 후 재검증
```

비개발자도 시나리오 통과율만 보면 품질을 알 수 있습니다:
- ✅ 4/4 시나리오 통과 = 품질 보장
- 📈 품질 점수: 94/100

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
| `vibe auth gpt` | GPT OAuth 인증 (ChatGPT Plus/Pro 구독자용, 권장) |
| `vibe auth gpt --key <key>` | GPT API 키 방식 |
| `vibe auth gemini` | Gemini OAuth 인증 (구독자용, 권장) |
| `vibe auth gemini --key <key>` | Gemini API 키 방식 |
| `vibe status gpt` / `vibe status gemini` | 인증 상태 확인 |
| `vibe logout gpt` / `vibe logout gemini` | 로그아웃 |
| `vibe remove gpt` / `vibe remove gemini` | 비활성화 |

> **OAuth 인증** 또는 API 키를 등록해서 사용할 수 있습니다.

### Claude Code 슬래시 커맨드

| 명령어 | 설명 |
|--------|------|
| `/vibe.spec "기능명"` | SPEC 작성 (PTCF 구조) + 병렬 리서치 |
| `/vibe.run "기능명"` | 구현 실행 |
| `/vibe.run "기능명" ultrawork` | 🚀 **최대 성능 모드** (권장) |
| `/vibe.verify "기능명"` | 검증 |
| `/vibe.review` | **병렬 코드 리뷰** (13+ 에이전트) |
| `/vibe.analyze "기능명"` | 코드 탐색/분석 |
| `/vibe.reason "문제"` | 체계적 추론 (9단계) |
| `/vibe.utils --옵션` | 유틸리티 (--ui, --diagram, --e2e) |

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
| **컨텍스트 관리** | 80%+ 시 자동 저장 |
| **무중단 실행** | Phase 간 확인 없이 연속 진행 |
| **외부 LLM** | GPT/Gemini 활성화 시 자동 참조 |

### Boulder Loop

시지푸스처럼 바위를 굴리듯, **모든 시나리오가 통과될 때까지** 자동으로 진행:

```
Scenario 1 → Scenario 2 → Scenario 3 → ... → Scenario N
    ↓             ↓            ↓                 ↓
[탐색+구현]   [탐색+구현]   [탐색+구현]      [탐색+구현]
[즉시 검증]   [즉시 검증]   [즉시 검증]      [즉시 검증]
    ✅            ✅            ✅               ✅
                                                 ↓
                                        🎉 품질 보장 완료!
```

### 일반 모드 vs ULTRAWORK

| 항목 | 일반 모드 | ULTRAWORK |
|------|----------|-----------|
| 시나리오 전환 | 일시정지 가능 | 자동 진행 |
| 검증 실패 | 보고 후 중단 | 자동 재시도 (3회) |
| 컨텍스트 80%+ | 경고만 | 자동 저장 |
| 탐색 방식 | 순차 가능 | **강제 병렬** |
| 완료 조건 | 시나리오별 | 전체 시나리오 통과까지 |

---

## BDD 자동 검증

### 품질 리포트 예시

`/vibe.verify` 실행 시 자동 생성되는 품질 리포트:

**VERIFICATION REPORT: login**

시나리오: 4/4 통과 (100%)

| # | Scenario | Given | When | Then | Status |
|---|----------|-------|------|------|--------|
| 1 | 유효한 로그인 성공 | ✅ | ✅ | ✅ | ✅ |
| 2 | 잘못된 비밀번호 에러 | ✅ | ✅ | ✅ | ✅ |
| 3 | 이메일 형식 검증 | ✅ | ✅ | ✅ | ✅ |
| 4 | 비밀번호 찾기 링크 | ✅ | ✅ | ✅ | ✅ |

품질 점수: **94/100**

### 검증 실패 시

```
❌ Scenario 4: 비밀번호 찾기 링크

When: "비밀번호 찾기" 클릭
❌ 문제: 링크가 구현되지 않음
📍 위치: LoginForm.tsx line 42
💡 수정: "Forgot password" 링크 추가 필요

🔧 자동 수정: /vibe.run "login" --fix
```

비개발자가 알아야 할 것:
- ✅ 시나리오 4/4 통과 → **품질 보장됨**
- ❌ 시나리오 3/4 통과 → **수정 필요** (자동 수정 가능)

---

## New in v2.1.0

### 병렬 코드 리뷰 (/vibe.review)

13+ 전문 에이전트가 동시에 코드 리뷰:

| 분야 | 검토 항목 |
|------|----------|
| Security | OWASP Top 10, SQL injection, XSS |
| Performance | N+1 queries, memory leaks |
| Architecture | SOLID violations, layer breaches |
| Language | Python, TypeScript, Rails, React |
| Quality | Complexity, test coverage, git |

**우선순위 시스템:**
- 🔴 **P1 (Critical)**: 머지 차단 - 보안 취약점, 데이터 손실
- 🟡 **P2 (Important)**: 수정 권장 - 성능 문제, 테스트 누락
- 🔵 **P3 (Nice-to-have)**: 백로그 - 코드 스타일, 리팩토링

### E2E 테스트 (/vibe.utils --e2e)

Playwright 기반 브라우저 자동화 테스트:

```bash
/vibe.utils --e2e "login flow"    # 시나리오 테스트
/vibe.utils --e2e --visual        # 시각적 회귀 테스트
/vibe.utils --e2e --record        # 비디오 녹화
```

**기능:**
- 스크린샷 캡처 및 비교
- 콘솔 에러 자동 수집
- 접근성(a11y) 검사
- 버그 재현 자동화

### 지식 복리 (자동 트리거)

해결한 문제를 자동 문서화하여 지식 축적:

```
.claude/vibe/solutions/
├── security/           # 보안 해결책
├── performance/        # 성능 최적화
├── database/           # DB 관련
└── integration/        # 외부 연동
```

**자동 트리거**: "버그 해결됨", "bug fixed", "PR merged" 등 (Hooks에서 자동 감지)

### 리서치 에이전트 강화

`/vibe.spec` 실행 시 **요구사항 확정 후** 4개 병렬 리서치:

```
문답으로 요구사항 확정 → 병렬 리서치 → SPEC 작성
```

| 에이전트 | 역할 | 외부 LLM 강화 |
|----------|------|--------------|
| best-practices-agent | 확정된 기능+스택 베스트 프랙티스 | - |
| framework-docs-agent | 확정된 스택 최신 문서 (context7) | Gemini (웹 검색) |
| codebase-patterns-agent | 기존 유사 패턴 분석 | - |
| security-advisory-agent | 확정된 기능 보안 권고 | GPT (CVE 지식) |

> ⚠️ **리서치는 요구사항 확정 후 실행** (VIBE 원칙: 요구사항 먼저)

### 외부 LLM 통합 (선택적)

GPT/Gemini가 활성화되어 있으면 특정 에이전트가 자동으로 활용합니다:

| 에이전트 | 외부 LLM | 용도 |
|----------|----------|------|
| framework-docs-agent | Gemini | context7 문서 부재 시 웹 검색으로 최신 문서 보강 |
| security-advisory-agent | GPT | CVE/보안 취약점 DB 지식 보강 |
| python-reviewer | GPT Codex | Python 코드 리뷰 2nd opinion |

**동작 방식:**
```
Primary: Task(Haiku) 실행
      ↓
[외부 LLM 활성화?]
      ↓ YES
외부 LLM 호출 → 결과 병합
      ↓ NO
Primary 결과만 사용
```

> **후방 호환성**: GPT/Gemini가 설정되지 않아도 Primary(Haiku)만으로 정상 작동합니다.

---

## Project Structure

`vibe init` 실행 후 생성되는 구조:

```
project/
├── CLAUDE.md                 # 프로젝트 컨텍스트        ← git 공유
└── .claude/                  # ⚠️ 반드시 git에 커밋    ← git 공유
    ├── commands/             # 슬래시 커맨드 (7개)
    ├── agents/               # 서브에이전트
    │   ├── review/           # 리뷰 에이전트 (12개)
    │   └── research/         # 리서치 에이전트 (4개)
    ├── settings.json         # Hooks 설정
    ├── settings.local.json   # 개인 설정              ← git 제외 (자동)
    └── vibe/
        ├── config.json       # 프로젝트 설정
        ├── constitution.md   # 프로젝트 원칙
        ├── rules/            # 코딩 규칙
        ├── specs/            # SPEC 문서들
        ├── features/         # BDD Feature 파일들
        ├── solutions/        # 해결책 아카이브
        └── todos/            # 우선순위 TODO
```

> **⚠️ 중요**: `.claude/` 폴더는 팀과 공유해야 합니다. 커밋 시 제외하지 마세요.
> `settings.local.json`만 개인 설정이므로 자동으로 git에서 제외됩니다.

---

## Feature 파일 (BDD 시나리오)

```gherkin
# .claude/vibe/features/login.feature

Feature: 로그인

  Scenario: 유효한 로그인 성공
    Given 사용자가 등록되어 있다
      # 검증: 사용자 생성 API 존재
    When 유효한 이메일과 비밀번호로 로그인
      # 검증: POST /login 엔드포인트
    Then 로그인 성공 + JWT 토큰 반환
      # 검증: 200 응답 + 토큰 포함

  Scenario: 잘못된 비밀번호 에러
    Given 사용자가 등록되어 있다
    When 잘못된 비밀번호로 로그인
    Then 401 에러 + "비밀번호가 틀립니다" 메시지
```

각 시나리오의 Given/When/Then이 자동 검증 포인트가 됩니다.

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
</context>

## Task
<task>
### Scenario 1: {시나리오명}
Given: {전제 조건}
When: {사용자 행동}
Then: {예상 결과}

### Scenario 2: {시나리오명}
...
</task>

## Constraints
<constraints>
- 기존 코드 패턴 준수
- 에러 메시지 한글화
</constraints>

## Acceptance Criteria
<acceptance>
- [ ] Scenario 1 통과
- [ ] Scenario 2 통과
</acceptance>
```

---

## Coding Rules (.claude/vibe/rules/)

### 14개 프레임워크별 언어 룰 (v2.3.0)

`vibe init` / `vibe update` 시 프로젝트의 기술 스택을 감지하여 **프레임워크별 최적화 규칙**을 자동 설치합니다.

| 감지 스택 | 룰 파일 | 주요 내용 |
|----------|---------|----------|
| Next.js | `typescript-nextjs.md` | App Router, Server Components, Server Actions |
| React | `typescript-react.md` | Hooks, 컴포넌트 패턴, 상태관리 |
| Vue.js | `typescript-vue.md` | Composition API, Pinia, script setup |
| Nuxt 3 | `typescript-nuxt.md` | useFetch, Server API, Auto-imports |
| React Native | `typescript-react-native.md` | 네이티브 모듈, 성능 최적화 |
| Node.js | `typescript-node.md` | Express/Fastify/NestJS 패턴 |
| FastAPI | `python-fastapi.md` | Pydantic, 비동기 처리, 의존성 주입 |
| Django | `python-django.md` | ORM, 뷰 패턴, 시그널 |
| Flutter | `dart-flutter.md` | Riverpod/BLoC, 위젯 트리 |
| Go | `go.md` | 에러 처리, 고루틴, 인터페이스 |
| Rust | `rust.md` | Result/Option, 소유권, unsafe |
| Spring Boot | `java-spring.md` | DI, JPA, 트랜잭션 |
| Android | `kotlin-android.md` | Compose, ViewModel, Coroutines |
| iOS | `swift-ios.md` | SwiftUI, Combine, 프로토콜 |

### 모노레포 지원

`packages/*`, `apps/*` 하위 패키지별로 각각 감지하여 필요한 룰만 설치:

```bash
# 모노레포 예시
monorepo/
├── packages/
│   ├── web/         → typescript-nextjs.md 설치
│   ├── mobile/      → typescript-react-native.md 설치
│   └── api/         → python-fastapi.md 설치
```

> 각 패키지에 맞는 프레임워크 규칙이 자동 적용됩니다.

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

## 내장 도구 & MCP

### 내장 도구 (v2.0+)

vibe는 36개의 도구를 **내장**하여 MCP 프로토콜 오버헤드 없이 직접 실행합니다.

| 도구 | 설명 |
|------|------|
| `vibe_find_symbol` | 심볼 정의 찾기 |
| `vibe_find_references` | 참조 찾기 |
| `vibe_analyze_complexity` | 복잡도 분석 |
| `vibe_validate_code_quality` | 품질 검증 |
| `vibe_start_session` | 세션 시작 (이전 컨텍스트 자동 복원) |
| `vibe_auto_save_context` | 현재 상태 저장 |
| `vibe_save_memory` | 중요 결정사항 저장 |

### MCP 서버 (외부 LLM)

| MCP 서버 | 설명 | 등록 방식 |
|----------|------|----------|
| `vibe-gemini` | Gemini 3 Flash/Pro 서브에이전트 | 전역 (`-s user`) |
| `vibe-gpt` | GPT-5.2 Codex 서브에이전트 | 전역 (`-s user`) |
| `context7` | 라이브러리 문서 실시간 검색 | 전역 (`-s user`) |

> **Note**: MCP 서버들은 전역 등록되어 모든 프로젝트에서 사용 가능합니다.
> OAuth 인증 후 Claude Code에서 GPT/Gemini를 서브에이전트로 호출할 수 있습니다.

### Hooks (자동 설정)

| Hook | 트리거 | 동작 |
|------|--------|------|
| `SessionStart` | 세션 시작 | `vibe_start_session` 자동 호출 → 이전 컨텍스트 복원 |
| `UserPromptSubmit` | `ultrawork`/`ulw` 감지 | 🚀 ULTRAWORK 모드 활성화 |
| `PostToolUse` | Write/Edit 후 | 품질 체크 (멈추지 않음) |
| `Notification` | 컨텍스트 80% | **MANDATORY** `vibe_auto_save_context` 호출 |
| `Notification` | 컨텍스트 90% | **MANDATORY** 즉시 저장 (urgency=high) |
| `Notification` | 컨텍스트 95% | **MANDATORY** 긴급 저장 + 세션 전환 준비 |

### 선택적 연동 (외부 LLM)

| MCP 서버 | 명령어 | 설명 |
|----------|--------|------|
| GPT-5.2 Codex | `vibe auth gpt` | OAuth 인증 (ChatGPT Plus/Pro, 권장) |
| GPT-5.2 Codex | `vibe auth gpt --key <key>` | API 키 방식 |
| Gemini 3 Flash/Pro | `vibe auth gemini` | OAuth 인증 (구독자용, 권장) |
| Gemini 3 Flash/Pro | `vibe auth gemini --key <key>` | API 키 방식 |

> **OAuth 인증** 또는 API 키를 등록해서 사용할 수 있습니다.

### 주요 내장 도구

- **코드 분석**: `vibe_analyze_complexity`, `vibe_validate_code_quality`
- **시맨틱 검색**: `vibe_find_symbol`, `vibe_find_references`
- **추론**: `vibe_create_thinking_chain`, `vibe_analyze_problem`
- **메모리**: `vibe_save_memory`, `vibe_recall_memory`, `vibe_auto_save_context`
- **UI**: `vibe_preview_ui_ascii`

### context7 사용법

최신 라이브러리 문서가 필요할 때:

```
"React 19의 use() 훅 사용법을 context7으로 검색해줘"
"Next.js 15 App Router 문서를 확인해줘"
```

---

## 컨텍스트 관리 팁

### 모델 선택 전략

| 작업 유형 | 권장 모델 | 이유 |
|----------|----------|------|
| 탐색/검색 | Haiku | 빠르고 저비용 |
| 구현/디버깅 | Sonnet | 균형잡힌 성능 |
| 아키텍처/복잡한 로직 | Opus | 최고 성능 |

> vibe의 서브에이전트는 기본적으로 Haiku를 사용합니다. 고비용 모델이 필요 없는 탐색 작업을 저비용 모델에게 위임하는 전략입니다.

### Claude Code 기본 명령어

| 명령어 | 용도 |
|--------|------|
| `/context` | 현재 컨텍스트 사용량 확인 |
| `/rewind` | 이전 시점으로 되돌리기 |
| `/new` | 새 세션 시작 |
| `Shift + Tab` | 플랜 모드 진입 |

> **⚠️ `/compact` 사용 금지**: 정보 손실/왜곡 위험. vibe 메모리 시스템 사용 권장.

### 컨텍스트 80%+ 시 자동 처리

```
80% 도달 → vibe_auto_save_context 자동 호출 (MANDATORY)
90% 도달 → 즉시 저장 (urgency=high)
95% 도달 → 긴급 저장 + 세션 전환 준비

새 세션 시작 → vibe_start_session 자동 호출 → 이전 컨텍스트 복원
```

> **⚠️ `/compact` 사용 금지**: 정보 손실/왜곡 위험. vibe 메모리 시스템이 자동으로 관리합니다.

### 가치 밀도 높은 컨텍스트 유지

1. **계획 먼저** - `/vibe.spec`으로 명확한 계획 수립
2. **필요한 정보만** - 서브에이전트가 탐색하고 요약만 전달
3. **자동 저장** - 80%+ 시 `vibe_auto_save_context` 자동 호출
4. **Just-in-Time** - context7로 필요할 때만 문서 검색

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
📄 .claude/vibe/specs/brick-game.md
📄 .claude/vibe/features/brick-game.feature

다음 단계: /vibe.run "벽돌게임"
```

---

## Requirements

- **Node.js**: 18.0.0+
- **Claude Code**: 필수

---

## Links

- **Repository**: [github.com/su-record/vibe](https://github.com/su-record/vibe)
- **Issues**: [GitHub Issues](https://github.com/su-record/vibe/issues)

---

## License

MIT License

---

**Built with ❤️ by Su & Claude**

## Vibe Setup (AI Coding)

이 프로젝트는 [Vibe](https://github.com/su-record/vibe) AI 코딩 프레임워크를 사용합니다.

### 협업자 설치

```bash
# 전역 설치 (권장)
npm install -g @su-record/vibe
vibe update

# 또는 setup 스크립트 실행
./.claude/vibe/setup.sh
```

### 사용법

Claude Code에서 슬래시 커맨드 사용:
- `/vibe.spec "기능명"` - SPEC 문서 작성
- `/vibe.run "기능명"` - 구현 실행
