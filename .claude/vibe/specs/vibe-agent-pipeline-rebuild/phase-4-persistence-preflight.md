---
status: pending
phase: 4
parent: _index.md
depends_on: [phase-1, phase-2]
---

# SPEC: Phase 4 - Conversation Persistence + Daemon Preflight

## Persona
<role>
Senior backend engineer specializing in SQLite persistence, daemon lifecycle management, and operational reliability.
- ConversationState를 in-memory에서 SQLite WAL 영속화로 전환
- daemon start 시 preflight 체크 추가
- 운영 안정성 보장
</role>

## Context
<context>
### Background
두 가지 운영 이슈:
1. ConversationState가 in-memory — 데몬 재시작 시 모든 대화 기록 소실
2. `vibe start` 시 preflight 체크 없음 — API 키 미설정, 포트 충돌 등을 사전 감지 못함

### 현재 ConversationState (In-Memory)
`src/agent/ConversationState.ts`:
- `sessions = new Map<string, ConversationSession>()`
- Sliding window: 최근 20개 메시지 (message 단위, user+assistant 턴 포함)
- 세션 만료: 기본 30분 비활성 (채널별 설정 가능: Telegram/Slack 24시간, Web 30분)
- Token counting: 한국어 2chars≈1token (기존 ConversationState 로직 재사용)
- **문제**: daemon 재시작 시 모든 세션 소실

### SQLite 사용 패턴 (기존)
`src/lib/memory/MemoryStorage.ts`:
- WAL mode, busy_timeout=5000
- FTS5 검색
- 준비된 statement 캐싱

### Daemon 시작 (현재)
`src/daemon/daemon.ts` + `src/daemon/VibeDaemon.ts`:
- IPC 서버 시작 → SessionPool 초기화 → InterfaceManager 시작
- 환경변수/API 키 검증 없음
- 포트 충돌 감지 없음

### Research Insights
- better-sqlite3 WAL: 동시 reader + writer 안전 (busy_timeout)
- 대화 영속화: 30분 세션 타임아웃은 유지, 재시작 후 활성 세션만 복원
- Preflight: 빠른 실패 (fail-fast) 원칙 — 시작 전 모든 의존성 검증
</context>

## Task
<task>
### Task 4.1: ConversationState SQLite 영속화
1. [ ] `src/agent/ConversationStore.ts` 작성 (SQLite 백엔드)
   - Schema:
     ```sql
     CREATE TABLE conversations (
       chatId TEXT PRIMARY KEY,
       messages TEXT NOT NULL,  -- JSON array
       lastActivity INTEGER NOT NULL,
       metadata TEXT  -- JSON
     );
     CREATE INDEX idx_conversations_activity ON conversations(lastActivity);
     ```
   - WAL mode, busy_timeout=5000, foreign_keys=ON
   - Schema 버전 관리: `schema_version` 테이블로 마이그레이션 추적
     ```sql
     CREATE TABLE schema_version (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);
     ```
   - API:
     a. `addMessage(chatId, message)`: 메시지 추가 + sliding window 적용
     b. `getMessages(chatId, provider)`: 토큰 한도 내 메시지 반환
     c. `clearSession(chatId)`: 세션 삭제
     d. `cleanExpired(expiryMs?: number)`: 만료 세션 정리 (기본 30분, 채널별 설정 가능)
     e. `close()`: DB 연결 종료
   - 기존 ConversationState의 로직(token counting, sliding window) 유지
   - Verify: `npx vitest run src/agent/ConversationStore.test.ts`

2. [ ] `src/agent/ConversationStore.test.ts` 작성
   - 메시지 추가/조회
   - Sliding window (20개 초과 시 오래된 메시지 제거)
   - 세션 만료 정리
   - 데몬 재시작 시 데이터 유지 검증
   - Verify: `npx vitest run src/agent/ConversationStore.test.ts`

### Task 4.2: AgentLoop ConversationStore 통합
1. [ ] `src/agent/AgentLoop.ts` 수정
   - ConversationState → ConversationStore 교체
   - AgentLoopDeps에 `conversationStore?: ConversationStore` 추가
   - ConversationStore 미제공 시 기존 in-memory ConversationState 사용 (하위 호환)
   - Verify: `npx vitest run src/agent/AgentLoop.test.ts`

### Task 4.3: Daemon Preflight Check
1. [ ] `src/daemon/preflight.ts` 작성
   - 체크 항목:
     a. HeadModel API 키 존재 여부 (GPT API key or OAuth)
     b. 활성화된 채널별 필수 환경변수:
        - Telegram: `TELEGRAM_BOT_TOKEN`
        - Slack: `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`
        - iMessage: macOS 확인 + Full Disk Access
        - Vision: `GEMINI_API_KEY`
     c. IPC 소켓 파일 잠금 확인 (이미 실행 중인 데몬)
     d. Web 포트 7860 사용 가능 여부
     e. SQLite DB 파일 접근 가능 여부
   - 반환: `{ passed: boolean; errors: string[]; warnings: string[] }`
   - 실패 시 데몬 시작 중단 + 에러 메시지
   - Verify: `npx vitest run src/daemon/preflight.test.ts`

2. [ ] `src/daemon/preflight.test.ts` 작성
   - API 키 누락 시 에러
   - 포트 충돌 시 에러
   - iMessage on non-macOS 시 경고
   - 모든 체크 통과 시 성공

### Task 4.4: VibeDaemon preflight 통합
1. [ ] `src/daemon/VibeDaemon.ts` start() 수정
   - preflight check 실행
   - 실패 시 `start()` 에러 반환 (데몬 시작 안 함)
   - 경고 시 로그 출력 후 계속
   - ConversationStore 초기화 + SessionPool에 전달
   - Verify: `npx vitest run src/daemon/daemon.test.ts`

### Task 4.5: CLI 개선
1. [ ] `src/cli/index.ts` 또는 `src/daemon/daemon.ts` 수정
   - `vibe start` 시 preflight 결과 출력
   - 실패 항목별 해결 방법 제시:
     a. "GPT API 키 미설정 → `vibe gpt auth` 또는 `vibe gpt key <key>` 실행"
     b. "포트 7860 사용 중 → 기존 프로세스 종료 또는 VIBE_WEB_PORT 환경변수 변경"
   - Verify: `npm run build`

### Task 4.6: 통합 테스트
1. [ ] `src/daemon/persistence-integration.test.ts` 작성
   - 대화 → 데몬 재시작 → 대화 복원 시나리오
   - Preflight 실패 시 데몬 시작 거부 시나리오
   - Expired session 자동 정리 시나리오
   - Verify: `npx vitest run src/daemon/persistence-integration.test.ts`
</task>

## Constraints
<constraints>
- ConversationStore는 ConversationState와 동일한 API 유지 (drop-in 교체)
- SQLite DB 위치: `~/.vibe/conversations.db`
- WAL 체크포인트: 1000 페이지마다 자동 (sqlite3 기본값)
- 메시지 JSON 직렬화 시 민감 필드(tool call args의 token/key) 마스킹
- Preflight는 2초 이내 완료 (빠른 시작)
- iMessage preflight: macOS 외 플랫폼에서는 경고만 (에러 아님)
- 기존 ConversationState.ts는 삭제하지 않음 (in-memory fallback으로 유지)
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/agent/ConversationStore.ts`
- `src/agent/ConversationStore.test.ts`
- `src/daemon/preflight.ts`
- `src/daemon/preflight.test.ts`
- `src/daemon/persistence-integration.test.ts`

### Files to Modify
- `src/agent/AgentLoop.ts` (ConversationStore 통합)
- `src/agent/types.ts` (AgentLoopDeps 확장)
- `src/daemon/VibeDaemon.ts` (preflight + ConversationStore)
- `src/daemon/daemon.ts` 또는 `src/cli/index.ts` (CLI 출력)

### Verification Commands
- `npx tsc --noEmit`
- `npm run build`
- `npx vitest run src/agent/ConversationStore.test.ts`
- `npx vitest run src/daemon/`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: 대화 기록이 SQLite에 저장되어 데몬 재시작 후에도 유지
- [ ] AC-2: Sliding window (20개)가 SQLite 레벨에서 적용
- [ ] AC-3: 30분 초과 비활성 세션이 자동 정리
- [ ] AC-4: ConversationStore 미제공 시 기존 in-memory 동작 유지 (하위 호환)
- [ ] AC-5: Preflight에서 API 키 누락 감지 시 데몬 시작 거부 + 해결 방법 출력
- [ ] AC-6: Preflight에서 포트 충돌 감지 시 에러 메시지 출력
- [ ] AC-7: Preflight 2초 이내 완료
- [ ] AC-8: 민감 필드가 SQLite 저장 시 마스킹
- [ ] AC-9: 모든 테스트 통과 + 빌드 성공
</acceptance>
