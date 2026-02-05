# Vibe

[![npm downloads](https://img.shields.io/npm/dt/@su-record/vibe)](https://www.npmjs.com/package/@su-record/vibe)
[![npm downloads](https://img.shields.io/npm/dt/@su-record/core)](https://www.npmjs.com/package/@su-record/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**SPEC 기반 AI 코딩 프레임워크** — Claude Code 전용

바이브코딩을 쉽게, 최소 품질은 자동으로 보장합니다.

```bash
npm install -g @su-record/core
vibe init
```

## 왜 Vibe인가

AI에게 "로그인 기능 만들어줘"라고 던지면 동작은 하지만 품질은 운에 맡기게 됩니다.
Vibe는 이 문제를 구조로 해결합니다.

| 문제 | Vibe의 해결 |
|------|-----------|
| AI가 `any` 타입을 남발 | Quality Gate가 `any`/`@ts-ignore` 차단 |
| 한 번에 완성된 코드를 기대 | SPEC → 구현 → 검증 단계별 워크플로우 |
| 코드 리뷰 없이 머지 | 13개 에이전트 병렬 리뷰 (보안, 성능, 아키텍처 등) |
| AI 결과를 그대로 수신 | 4개 LLM 교차 검증 (Claude + GPT + Gemini + Kimi) |
| 컨텍스트 소실 | Session RAG로 결정사항/목표 자동 저장 및 복원 |

## 동작 원리

```
/vibe.spec "기능"  →  /vibe.run  →  자동 리뷰  →  완료
    SPEC 작성         구현 실행      13개 에이전트
```

1. **`/vibe.spec`** — 요구사항을 SPEC 문서로 정의 (GPT + Gemini 병렬 리서치)
2. **`/vibe.run`** — SPEC 기반으로 구현 실행
3. **자동 리뷰** — 보안, 성능, 아키텍처 등 13개 전문 에이전트가 병렬 검토
4. **P1/P2 자동 수정** — 심각한 이슈는 자동으로 고침

`ultrawork` 키워드를 붙이면 전 과정이 자동화됩니다:
```
/vibe.spec "기능" ultrawork
```

## 주요 기능

### 슬래시 명령어

| 명령어 | 설명 |
|--------|------|
| `/vibe.spec "기능"` | SPEC 작성 + 병렬 리서치 |
| `/vibe.run "기능"` | 구현 실행 |
| `/vibe.verify "기능"` | SPEC 대비 검증 |
| `/vibe.review` | 13개 에이전트 병렬 코드 리뷰 |
| `/vibe.reason "문제"` | 체계적 추론 프레임워크 |
| `/vibe.analyze` | 프로젝트 분석 |
| `/vibe.voice` | 음성 → 코딩 명령 (Gemini + sox) |
| `/vibe.utils` | 유틸리티 (E2E 테스트, 다이어그램, UI 미리보기) |

### 멀티 LLM 오케스트레이션

4개 LLM을 작업 유형에 따라 자동 라우팅합니다.

| 작업 유형 | 우선순위 |
|----------|---------|
| 코드 분석, 리뷰, 추론 | Kimi → GPT → Gemini → Claude |
| 아키텍처, 디버깅 | GPT → Kimi → Gemini → Claude |
| UI/UX, 웹 검색 | Gemini → GPT → Claude |
| 코드 생성, 일반 | Claude |

```bash
# LLM 인증
vibe gpt auth          # GPT OAuth
vibe gemini auth       # Gemini OAuth
vibe nvidia key <KEY>  # NVIDIA API 키
```

### 32개 전문 에이전트

| 카테고리 | 에이전트 | 역할 |
|----------|---------|------|
| **메인** (12) | Explorer, Implementer, Architect... | 탐색, 구현, 설계 |
| **리뷰** (12) | Security, Performance, Architecture... | 병렬 코드 리뷰 |
| **리서치** (4) | Best Practices, Framework Docs... | 병렬 조사 |
| **QA** (4) | Acceptance Tester, Edge Case Finder... | 품질 보증 |

### 35+ 내장 도구

**메모리 & 세션** — 결정사항, 목표, 제약조건을 저장하고 세션 간 복원
```
save_session_item → retrieve_session_context → manage_goals
```

**코드 품질** — 복잡도 분석, 커플링/응집도, 심볼 검색, 의존성 그래프

**SPEC & 테스트** — SPEC 생성, PRD 파싱, 추적성 매트릭스, E2E 테스트 생성

### 23개 프레임워크 지원

프로젝트의 기술 스택을 자동 감지하고, 해당 프레임워크의 코딩 규칙을 적용합니다.

**TypeScript** — Next.js, React, Angular, Vue, Svelte, Nuxt, NestJS, Node, Electron, Tauri, React Native

**Python** — Django, FastAPI

**기타** — Spring, Android (Kotlin), Rails, Go, Rust, Swift (iOS), Unity (C#), Flutter (Dart), Godot (GDScript)

### 품질 보장 시스템

| 가드레일 | 메커니즘 |
|----------|---------|
| 타입 안전성 | Quality Gate (`any`/`Any` 차단) |
| 코드 리뷰 | Race Review (GPT + Gemini 병렬) |
| 완성도 체크 | Ralph Loop (100%까지 반복) |
| 멀티 LLM | 4개 관점 교차 검증 |

## CLI 명령어

```bash
vibe init [project]      # 프로젝트 초기화
vibe update              # 설정 업데이트
vibe status              # 상태 확인
vibe hud <cmd>           # HUD 상태 (show, start, phase, agent, reset)
vibe gpt <cmd>           # GPT (auth, key, status, logout)
vibe gemini <cmd>        # Gemini (auth, key, status, logout)
vibe nvidia <cmd>        # NVIDIA (key, status, logout)
vibe remove              # 제거
vibe help                # 도움말
vibe version             # 버전
```

## 매직 키워드

명령어에 키워드를 추가하면 동작이 바뀝니다.

| 키워드 | 효과 |
|--------|------|
| `ultrawork` / `ulw` | 병렬 처리 + 자동 계속 + Ralph Loop |
| `ralph` | 100% 완성까지 반복 (범위 축소 없음) |
| `ralplan` | 반복적 계획 수립 + 영속화 |
| `verify` | 엄격 검증 모드 |
| `quick` | 빠른 모드, 최소 검증 |

## 프로젝트 구조

```
your-project/
├── .claude/
│   └── vibe/
│       ├── config.json        # 모델 설정, 스택 감지 결과
│       ├── constitution.md    # 프로젝트 원칙
│       ├── specs/             # SPEC 문서
│       ├── features/          # 기능 추적
│       └── todos/             # 이슈 추적
├── CLAUDE.md                  # 프로젝트 가이드 (자동 생성)
└── ...
```

전역 설정:
```
~/.config/vibe/                # LLM 인증 토큰/키
~/.claude/vibe/rules/          # 코딩 규칙 (13개)
~/.claude/commands/            # 슬래시 명령어
~/.claude/agents/              # 에이전트 정의
~/.claude/skills/              # 스킬 정의
```

## 요구사항

- **Node.js** >= 18.0.0
- **Claude Code** (필수 — Claude Code 전용 프레임워크)
- GPT, Gemini, NVIDIA는 선택사항 (멀티 LLM 기능용)

## 라이선스

MIT
