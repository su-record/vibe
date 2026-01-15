# Vibe

**SPEC 기반 AI 코딩 프레임워크** (Claude Code 전용)

[![npm version](https://img.shields.io/npm/v/@su-record/vibe.svg)](https://www.npmjs.com/package/@su-record/vibe)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 설치

```bash
npm install -g @su-record/vibe
vibe init
```

## 명령어

### 터미널

| 명령어 | 설명 |
|--------|------|
| `vibe init` | 프로젝트 초기화 |
| `vibe update` | 설정 업데이트 |
| `vibe status` | 현재 상태 확인 |
| `vibe auth gpt` | GPT OAuth 인증 |
| `vibe auth gemini` | Gemini OAuth 인증 |
| `vibe help` | 도움말 |

### Claude Code

| 명령어 | 설명 |
|--------|------|
| `/vibe.spec "기능"` | SPEC 문서 작성 + 병렬 리서치 |
| `/vibe.run "기능"` | 구현 실행 |
| `/vibe.run "기능" ultrawork` | 최대 성능 모드 |
| `/vibe.verify "기능"` | BDD 검증 |
| `/vibe.review` | 13+ 에이전트 병렬 리뷰 |
| `/vibe.analyze` | 코드 분석 |
| `/vibe.reason "문제"` | 체계적 추론 |
| `/vibe.utils` | 유틸리티 (--e2e, --diagram 등) |

## 워크플로우

```
/vibe.spec → /vibe.run → /vibe.verify → /vibe.review
```

## 주요 기능

| 기능 | 설명 |
|------|------|
| **멀티모델 오케스트레이션** | Claude + GPT-5.2 + Gemini 3 Pro 통합 |
| **13+ 병렬 리뷰 에이전트** | 보안, 성능, 아키텍처 동시 검토 |
| **BDD 자동 검증** | Given/When/Then 시나리오별 검증 |
| **ULTRAWORK 모드** | `ulw` 한 단어로 모든 최적화 활성화 |
| **36개 내장 도구** | 코드 분석, 메모리 관리, 품질 검증 |
| **자동 컨텍스트 관리** | 80%+ 자동 저장, 세션 복원 |

## ULTRAWORK 모드

`ultrawork` 또는 `ulw` 키워드로 최대 성능 모드 활성화:

```bash
/vibe.run "기능명" ultrawork
/vibe.run "기능명" ulw        # 동일
```

**활성화 기능:**
- 병렬 서브에이전트 탐색 (3+ 동시)
- Boulder Loop (모든 시나리오 완료까지 자동 진행)
- 에러 자동 재시도 (최대 3회)
- Phase 간 확인 없이 연속 실행
- 컨텍스트 80%+ 시 자동 저장

## 멀티모델 오케스트레이션

Claude Code에서 GPT-5.2, Gemini 3 Pro를 Hook으로 직접 호출:

| 상황 | 추천 모델 | 호출 방법 |
|------|----------|----------|
| 아키텍처 검토 | GPT-5.2 | "gpt한테 물어봐" 또는 직접 import |
| UI/UX 리뷰 | Gemini 3 Pro | "gemini한테 물어봐" 또는 직접 import |
| 디버깅 | GPT-5.2 | Hook 자동 트리거 |
| 코드 분석 | Gemini 3 Pro | Hook 자동 트리거 |

**직접 API 호출:**

```javascript
import('@su-record/vibe/lib/gpt').then(g => g.quickAsk('질문'))
import('@su-record/vibe/lib/gemini').then(g => g.quickAsk('질문'))
```

## 병렬 리뷰 에이전트

`/vibe.review` 실행 시 13+ 에이전트가 동시 검토:

| 분야 | 에이전트 |
|------|----------|
| 보안 | security-reviewer, data-integrity-reviewer |
| 성능 | performance-reviewer, complexity-reviewer |
| 아키텍처 | architecture-reviewer, simplicity-reviewer |
| 언어별 | python, typescript, rails, react reviewers |
| 컨텍스트 | git-history, test-coverage reviewers |

**우선순위:**
- 🔴 P1 (Critical): 머지 차단
- 🟡 P2 (Important): 수정 권장
- 🔵 P3 (Nice-to-have): 백로그

## 내장 도구

| 도구 | 설명 |
|------|------|
| `vibe_find_symbol` | 심볼 정의 찾기 |
| `vibe_find_references` | 참조 찾기 |
| `vibe_analyze_complexity` | 복잡도 분석 |
| `vibe_validate_code_quality` | 품질 검증 |
| `vibe_start_session` | 세션 시작 (이전 컨텍스트 복원) |
| `vibe_save_memory` | 중요 결정사항 저장 |
| `vibe_auto_save_context` | 현재 상태 자동 저장 |

## 프로젝트 구조

**전역 설치 (`~/.claude/`):**

```text
~/.claude/
├── commands/       # 슬래시 커맨드 (7개)
├── agents/         # 리뷰/리서치 에이전트
├── skills/         # 자동 활성화 가이드 (7개)
└── settings.json   # Hooks + MCP 설정
```

**프로젝트별 (`프로젝트/.claude/vibe/`):**

```text
.claude/vibe/
├── specs/          # SPEC 문서
├── features/       # BDD 시나리오
├── rules/          # 코딩 규칙 (기술스택별)
├── solutions/      # 해결책 아카이브
├── config.json     # 프로젝트 설정
└── constitution.md # 프로젝트 원칙
```

## 코드 품질 기준

| 메트릭 | 제한 |
|--------|------|
| 함수 길이 | 30줄 권장, 50줄 허용 |
| 중첩 깊이 | 3단계 이하 |
| 매개변수 | 5개 이하 |
| 순환 복잡도 | 10 이하 |

## 사용 예시

```
User: /vibe.spec "로그인 기능"

Claude: 로그인 기능을 만드시는군요! 몇 가지 질문이 있습니다.
        1. 인증 방식은? (이메일/비밀번호, OAuth, Passkey)
        2. 기술 스택은?
        ...

[대화로 요구사항 확정]
[4개 병렬 리서치 에이전트 실행]

✅ SPEC 문서 생성 완료
📄 .claude/vibe/specs/login.md
📄 .claude/vibe/features/login.feature

다음 단계: /vibe.run "로그인 기능" ultrawork
```

## 요구사항

- Node.js 18.0.0+
- Claude Code

## 라이선스

MIT - [GitHub](https://github.com/su-record/vibe)

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
