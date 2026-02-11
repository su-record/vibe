---
status: pending
currentPhase: 0
totalPhases: 4
createdAt: 2026-02-06T17:31:00+09:00
lastUpdated: 2026-02-06T17:31:00+09:00
---

# SPEC: telegram-agent (Master)

## Overview

현재 `telegram-bridge.ts`는 `claude -p` (텍스트 1턴)로만 동작하는 단순 에코 봇이다.
이를 Vibe 인프라(SmartRouter, LLMCluster, BackgroundManager, AgentRegistry, SessionRAG, MemoryManager)를 최대한 활용하는 **Personal AI Agent Bridge**로 업그레이드한다.

- **Total Phases**: 4
- **Dependencies**: 기존 Vibe 인프라 (orchestrator, interface, memory, daemon)
- **Target**: 텔레그램에서 8가지 역할을 수행하는 AI 에이전트

## 봇 역할 (8가지)

| # | 역할 | 설명 |
|---|------|------|
| 1 | 개발 작업 | 새 프로젝트 생성/기존 레포 코딩/분석/Git → 완료 알림 |
| 2 | 웹 리서치 | 브라우저/YouTube 검색 → 결과 정리 보고 |
| 3 | 일정 관리 | 캘린더 연동 + 스케줄 예약 실행 |
| 4 | 메일 발송 | Chrome 브라우저로 Gmail 발송 |
| 5 | 시스템 모니터링 | 디스크/CPU/프로세스 상태 확인, 이상 시 알림 |
| 6 | 파일 관리 | 검색/정리/백업/스크린샷 |
| 7 | 메모/지식 | vibe memory 연동 → 메모 저장/검색/리마인더 |
| 8 | 문서 생성 | Markdown/PDF/다이어그램/이미지 생성 후 전송 |

## Sub-SPECs

| Order | SPEC File | Feature File | Description | Status |
|-------|-----------|--------------|-------------|--------|
| 1 | phase-1-claude-agent.md | phase-1-claude-agent.feature | Claude CLI JSON 모드 핸들러 + 시스템 프롬프트 | ⬜ |
| 2 | phase-2-message-router.md | phase-2-message-router.feature | 의도 분류 + 라우팅 엔진 | ⬜ |
| 3 | phase-3-task-notifier.md | phase-3-task-notifier.feature | 비동기 작업 + 완료 알림 + 세션 컨텍스트 | ⬜ |
| 4 | phase-4-bridge-upgrade.md | phase-4-bridge-upgrade.feature | telegram-bridge.ts 업그레이드 + 설정 확장 | ⬜ |

## Shared Context

### Tech Stack
- Runtime: Node.js 18+
- Language: TypeScript (strict mode, ESM)
- Database: SQLite (better-sqlite3, WAL mode)
- IPC: child_process.spawn (Claude CLI JSON 스트리밍)
- Telegram: 네이티브 HTTPS polling (TelegramBot 클래스)

### Existing Infrastructure (활용 대상)

| 컴포넌트 | 용도 | 경로 |
|----------|------|------|
| SmartRouter | 작업 유형별 최적 LLM 라우팅 + fallback | `src/orchestrator/SmartRouter.ts` |
| LLMCluster | 병렬 멀티 LLM 쿼리 (분석/리뷰) | `src/orchestrator/LLMCluster.ts` |
| BackgroundManager | 비동기 작업 큐 + 완료 폴링 | `src/orchestrator/BackgroundManager.ts` |
| AgentRegistry | SQLite 기반 실행 추적/크래시 복구 | `src/orchestrator/AgentRegistry.ts` |
| SessionRAGStore | BM25+recency 하이브리드 검색 | `src/lib/memory/SessionRAGStore.ts` |
| MemoryManager | 메모 저장/검색/지식 관리 파사드 | `src/lib/MemoryManager.ts` |
| TelegramBot | 텔레그램 polling 송수신 | `src/interface/telegram/TelegramBot.ts` |
| ClaudeCodeBridge | stream-json 프로토콜 통신 | `src/interface/ClaudeCodeBridge.ts` |

### Architecture

```
텔레그램 메시지
    ↓
TelegramBot (기존, polling)
    ↓
MessageRouter (의도 분류)
    ├─ quick (Q&A, 상태조회) → SmartRouter → 최적 LLM → 즉시 응답
    ├─ multi-llm (분석, 리뷰) → LLMCluster.multiQuery() → 병렬 → 종합 응답
    ├─ dev-task (코딩, Git) → TaskNotifier → BackgroundManager → 완료 알림
    ├─ local (파일, 시스템, 메일, 캘린더) → Claude CLI → 즉시 응답
    └─ memory (메모, 검색) → MemoryManager → 직접 처리
    ↓
AgentRegistry (모든 실행 추적)
SessionRAG (대화 컨텍스트 저장/복원)
```

### Constraints (전 Phase 공통)
- 기존 인프라 수정 최소화 (래핑 방식)
- 텔레그램 메시지 4096자 제한 고려 (긴 응답은 분할 전송)
- child_process.spawn은 shell:false 필수 (명령어 주입 방지)
- 사용자 입력은 프롬프트로만 전달, CLI 인자로 사용 금지
- 봇 토큰/민감 정보는 로그에 마스킹
- allowedChatIds 기반 인가 검증 필수
- ESM 모듈 import 시 `.js` 확장자 포함

### Security Considerations (리서치 결과 반영)
- **명령어 주입 방지**: spawn({shell: false}) + 인자 배열 전달
- **프롬프트 주입 완화**: 시스템 프롬프트와 사용자 입력 분리, XML 태그 구분
- **토큰 관리**: 환경변수/파일 저장, 로그 마스킹, 600 퍼미션
- **인가 검증**: 매 메시지마다 chatId 검증 (BaseInterface에서 처리)
- **Rate limiting**: per-chat 동시 요청 제한 (큐잉)
- **타임아웃**: Claude CLI 300초, LLM 30초, 폴링 재시도 5회
