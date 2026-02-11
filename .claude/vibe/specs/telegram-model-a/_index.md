---
status: pending
currentPhase: 0
totalPhases: 4
createdAt: 2026-02-07T09:39:00+09:00
lastUpdated: 2026-02-07T09:39:00+09:00
---

# SPEC: telegram-model-a (Master)

## Overview

텔레그램 기반 개인 AI 비서 시스템 "Model A". 텔레그램 메시지를 받아 LLM+키워드 하이브리드 IntentClassifier가 의도를 분류하고, 6개 라우트(개발/Google/리서치/유틸리티/모니터/복합)로 자동 실행한다.

- **사용자**: 본인 전용 (1인)
- **실행 환경**: 로컬 PC (Windows + macOS)
- **크로스 플랫폼**: Windows/macOS 모두 100% 동작 필수
- **기존 인프라**: TelegramBot, ClaudeCodeBridge, JobManager, IntentParser, SmartRouter, LLMCluster, PolicyEngine, SessionPool, SyncEngine, WebhookHandler 활용

## Sub-SPECs

| Order | SPEC File | Feature File | Description | Status |
|-------|-----------|--------------|-------------|--------|
| 1 | phase-1-core-dev.md | phase-1-core-dev.feature | 코어 라우터 + 개발 라우트 |  |
| 2 | phase-2-google.md | phase-2-google.feature | Google Apps 라우트 |  |
| 3 | phase-3-research-utility.md | phase-3-research-utility.feature | 리서치 + 유틸리티 라우트 |  |
| 4 | phase-4-monitor-composite.md | phase-4-monitor-composite.feature | 모니터링 + 복합 라우트 |  |

## Shared Context

### Tech Stack
- Runtime: Node.js 18+ / TypeScript 5.5+
- Testing: Vitest
- Database: SQLite (better-sqlite3, WAL mode)
- LLM: Claude Code CLI (stream-json), GPT, Gemini, AZ (Kimi K2.5)
- Google: googleapis v144+
- Browser: Playwright v1.50+
- Scheduler: node-cron v3.0+
- Build: tsc

### Architecture Pattern
- **계층 아키텍처**: Transport (TelegramBot) → Router (ModelARouter) → IntentClassifier → Routes → Services → Adapters
- **Strategy Pattern**: BaseRoute 추상 클래스 + 라우트별 구현체
- **Event-Driven**: Job 큐 + 상태 업데이트 (기존 JobManager 활용)
- **Circuit Breaker**: 외부 API 호출 시 장애 전파 방지
- **Adapter Pattern**: 외부 서비스 추상화

### Shared Constraints
- 기존 타입 시스템 준수 (ExternalMessage, ClaudeStreamMessage, JobStatus)
- spawn with args array 사용 (shell 금지, 보안)
- 토큰/키 암호화: AES-256-GCM, 키 관리는 keytar 라이브러리 (macOS Keychain / Windows Credential Manager), fallback: 환경변수 키 기반 AES 암호화 파일
- LLM API 키도 동일한 암호화 패턴 적용 (OpenAI/Gemini/AZ 키 포함)
- 입력 유효성 검증: 명령어 허용 목록, path traversal 방지 (resolve+startsWith), 메시지 최대 4096자, UTF-8 인코딩만 허용
- 로그에 토큰/API 키 노출 금지 (logger 래퍼: 구조화된 sensitive 필드 + 정규식 기반 이중 필터링)
- Google OAuth: 기존 SyncEngine 토큰 통합 + PKCE (S256) + state 파라미터 검증
- Gmail 스코프: `gmail.readonly` + `gmail.send` (gmail.modify 대신, 최소 권한 원칙)
- Playwright: 전용 봇 프로필 사용 (플랫폼별: Windows `%APPDATA%/vibe/browser-profile/`, macOS `~/.vibe/browser-profile/`), 공개 웹만 접근 (인증된 콘텐츠는 API 사용)
- 텔레그램 사용자 인증: `TELEGRAM_ALLOWED_USER_ID` 환경변수, **문자열 비교** (BigInt 정밀도 이슈 방지), private chat만 허용, Transport 레이어에서 차단
- 기존 모듈 활용 원칙: 수정하지 않되, Adapter/Wrapper 패턴으로 감싸서 필요한 인터페이스 노출 허용
- 파일 권한: macOS/Linux 0600(파일)/0700(디렉토리), Windows icacls 기반 Owner-only ACL 설정, 시작 시 플랫폼별 권한 검증
- Graceful shutdown 순서: 1) Telegram polling 중단 2) 진행 중 요청 완료 대기(10초) 3) Playwright 컨텍스트 종료 4) SQLite WAL checkpoint 5) 프로세스 종료 (전체 30초 타임아웃)

### Dependencies Between Phases
- Phase 1 (코어): 독립 실행 가능, 모든 Phase의 기반
- Phase 2 (Google): Phase 1 완료 필수 (라우터 + BaseRoute)
- Phase 3 (리서치/유틸): Phase 1 완료 필수
- Phase 4 (모니터/복합): Phase 1 완료 필수, Phase 2-3 일부 서비스 참조

### Research Summary (10 Agent Consensus)

**아키텍처 합의:**
- 계층 아키텍처 + Strategy 패턴으로 라우트 확장
- 이벤트 기반 비동기 처리 (무거운 작업은 백그라운드)
- Circuit Breaker로 외부 API 장애 격리
- 멱등성 보장 (Telegram update_id 기반 중복 방지)

**보안 합의:**
- 토큰 암호화 저장, 로그 노출 금지
- spawn args array (shell injection 방지)
- OAuth PKCE + state 검증
- Google API 스코프 최소화 (least privilege)
- Playwright 프로필 격리

**엣지 케이스 합의:**
- LLM 의도 분류 실패 시 confidence threshold + fallback
- Google API 429 시 exponential backoff + jitter
- DAG 순환 의존성 감지 (topological sort)
- Telegram flood limit 시 circuit breaker
- Claude Code 크래시 시 세션 복구
