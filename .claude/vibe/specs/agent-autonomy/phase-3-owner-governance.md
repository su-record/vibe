---
status: pending
phase: 3
---

# SPEC: agent-autonomy — Phase 3: Owner Confirmation & Governance

## Persona
<role>
Senior TypeScript engineer specializing in async workflow orchestration and notification systems.
Implement state machine-based owner confirmation flow with multi-channel notification.
Follow existing vibe notification patterns (Telegram/Slack/Web).
</role>

## Context
<context>
### Background
HIGH 위험 행위 감지 시 오너에게 알림을 보내고 확인을 받는 거버넌스 시스템.
PENDING → APPROVED/REJECTED/EXPIRED 상태 머신으로 관리.
기존 Telegram/Slack/Web 채널을 재사용하여 알림 전송.

### 기존 시스템
- `src/interface/TelegramBot.ts`: Telegram Bot (polling mode)
- `src/interface/SlackBot.ts`: Slack Bot (Socket Mode)
- `src/interface/WebServer.ts`: Web 서버 (SSE + WebSocket)
- Phase 1 EventBus/AuditStore: 이벤트 인프라
- Phase 2 SecuritySentinel: 위험도 분류 + 정책 평가

### Research Insights
- GPT: "Owner confirmation flow as state machine driven by events"
- GPT: "Multi-factor or multi-party approval for HIGH risk intents"
- Gemini: "Async Human-in-the-Loop — pause execution via event suspension"
- Gemini: "Race condition in HITL — atomic state machine in SQLite transaction"
- Gemini: "Cryptographic Action Signing for HIGH_RISK actions"
- Kimi: "Idempotent Circuit Breaker — idempotency keys with retries"
- Kimi: "Confirmation Timeout During Commit — return 200 with existing result"
- Kimi: "State Machine Exhaustive Verification — no path allows CONFIRMED → PENDING"
</context>

## Task
<task>
### Phase 3-1: ConfirmationStore 구현
1. [ ] `src/lib/autonomy/ConfirmationStore.ts` 생성
   - File: `src/lib/autonomy/ConfirmationStore.ts`
   - `confirmations` 테이블:
     ```sql
     confirmations {
       id TEXT PRIMARY KEY (UUIDv7),
       correlationId TEXT NOT NULL,
       actionType TEXT NOT NULL,
       actionSummary TEXT NOT NULL,
       riskLevel TEXT NOT NULL,
       riskScore INTEGER NOT NULL,
       riskFactors JSON NOT NULL,
       status TEXT NOT NULL DEFAULT 'pending'
         ('pending' | 'approved' | 'rejected' | 'expired' | 'cancelled'),
       channel TEXT,
       notifiedAt TEXT,
       respondedAt TEXT,
       ownerResponse TEXT,
       expiresAt TEXT NOT NULL,
       idempotencyKey TEXT UNIQUE,
       createdAt TEXT NOT NULL
     }
     ```
   - 인덱스: `(status, expiresAt)`, `(correlationId)`, `(idempotencyKey)`
   - `create(confirmation)`: 새 확인 요청 생성
   - `resolve(id, status, response?)`: 상태 전환 (원자적 트랜잭션)
   - `getExpired()`: 만료된 pending 확인 목록
   - `getByCorrelation(correlationId)`: 연관 확인 조회
   - Verify: CRUD + 상태 전환 테스트

### Phase 3-2: ConfirmationManager (상태 머신) 구현
2. [ ] `src/lib/autonomy/ConfirmationManager.ts` 생성
   - File: `src/lib/autonomy/ConfirmationManager.ts`
   - 상태 전환 규칙:
     ```
     pending → approved (오너 승인)
     pending → rejected (오너 거부)
     pending → expired (타임아웃)
     pending → cancelled (시스템 취소)
     approved → (terminal)
     rejected → (terminal)
     expired → (terminal)
     cancelled → (terminal)
     ```
   - 잘못된 전환 시도 시 `InvalidTransitionError` throw
   - `requestConfirmation(action, riskAssessment): ConfirmationRequest`
     1. ConfirmationStore.create()
     2. NotificationDispatcher.notify()
     3. EventBus에 confirmation_requested 이벤트 발행
     4. 타이머 시작 (expiresAt 기준)
     5. Promise<ConfirmationResult> 반환 (resolve/reject/expire 시 해소)
   - `handleResponse(confirmationId, approved, response?)`: 오너 응답 처리
   - `checkExpired()`: 만료 확인 일괄 처리 (1분 간격)
   - `loadPendingOnStartup()`: 프로세스 재시작 시 DB에서 pending 확인 로드 → expiresAt 확인 → 만료된 것은 즉시 expired 처리, 유효한 것은 타이머 재등록
   - 동시성 보호: SQLite 트랜잭션 내 상태 체크 + 업데이트
   - 타임아웃 계산: `process.hrtime.bigint()` (monotonic clock) 사용 — 시스템 시계 변경에 영향받지 않음
   - Verify: 상태 머신 전체 경로 + 잘못된 전환 + 재시작 복구 테스트

### Phase 3-3: NotificationDispatcher 구현
3. [ ] `src/lib/autonomy/NotificationDispatcher.ts` 생성
   - File: `src/lib/autonomy/NotificationDispatcher.ts`
   - 기존 채널 인터페이스 재사용:
     | 채널 | 알림 형식 | 응답 방법 |
     |------|----------|----------|
     | Telegram | 인라인 키보드 (Approve/Reject 버튼) | 콜백 쿼리 |
     | Slack | Block Kit (Approve/Reject 버튼) | Interactive Message |
     | Web | WebSocket 이벤트 + REST API | POST /api/confirmations/:id |
   - `notify(confirmation): NotificationResult`
     1. config.json `sentinel.notificationChannels[]` 순서대로 **순차 시도** (동시 전송 아님)
     2. 첫 번째 성공 채널로 전송 후 나머지 채널 skip
     3. 실패 시 다음 채널로 fallback (채널당 타임아웃: 10초)
     4. 모든 채널 실패 시 confirmation을 expired로 마킹 + 행위 차단 (fail-closed) + stderr 에러 로그
     5. 동일 action에 대한 확인 요청: 5분 내 최대 3회 (spam 방지, dedupe key: `${actionType}:${normalizedTarget}:${riskLevel}`)
   - 알림 메시지 포맷:
     ```
     🛡️ Security Sentinel — Confirmation Required

     Action: {actionType}
     Risk: {riskLevel} ({riskScore}/100)
     Summary: {actionSummary}
     Factors: {riskFactors}

     ⏱️ Expires in: {remainingTime}

     [✅ Approve] [❌ Reject]
     ```
   - Verify: 각 채널 알림 + fallback + 메시지 포맷 테스트

### Phase 3-4: 채널별 응답 핸들러
4. [ ] Telegram 응답 핸들러 확장
   - File: `src/interface/TelegramBot.ts` (수정)
   - 콜백 쿼리 핸들러: `sentinel_approve:{id}`, `sentinel_reject:{id}`
   - 오너 검증: `callback_query.from.id === process.env.OWNER_TELEGRAM_ID` (숫자 비교)
   - 비오너 응답 시: "Only the owner can approve/reject" 메시지 반환 + 무시
   - 응답 시 ConfirmationManager.handleResponse() 호출
   - 응답 후 메시지 업데이트 (버튼 제거 + 결과 표시)
   - Verify: 콜백 쿼리 처리 + 오너 검증 테스트

5. [ ] Slack 응답 핸들러 확장
   - File: `src/interface/SlackBot.ts` (수정)
   - Interactive Message 핸들러: action_id `sentinel_approve`, `sentinel_reject`
   - 오너 검증: `action.user.id`가 config.json `sentinel.slackOwnerIds[]`에 포함되는지 확인 (비오너 시 거부 + 경고 메시지)
   - 응답 시 ConfirmationManager.handleResponse() 호출
   - 응답 후 메시지 업데이트 (버튼 제거 + 결과 표시)
   - Verify: Interactive Message 처리 + 오너 검증 테스트

6. [ ] Web API 응답 엔드포인트
   - File: `src/interface/WebServer.ts` (수정)
   - `POST /api/confirmations/:id` body: `{ approved: boolean, response?: string }`
   - JWT 인증 필수:
     - Algorithm: RS256 (비대칭), config.json `sentinel.jwt.publicKeyPath`로 공개키 경로 지정
     - Claims: `{ sub: userId, role: 'owner', iss: 'vibe-sentinel', aud: 'vibe-api' }`
     - Token TTL: 최대 3600초 (1시간), `exp` claim 필수
     - role이 'owner'가 아닌 요청은 403 거부
     - CSRF 보호: Double Submit Cookie 패턴 적용 (CSRF 토큰을 cookie + header로 전송, 서버에서 일치 확인)
   - ConfirmationManager.handleResponse() 호출
   - WebSocket으로 실시간 상태 업데이트 브로드캐스트
   - Verify: API 엔드포인트 + WebSocket 업데이트 테스트

### Phase 3-5: 테스트
7. [ ] 단위 + 통합 테스트
   - File: `src/lib/autonomy/__tests__/governance.test.ts`
   - ConfirmationStore: CRUD + 상태 전환 + 만료
   - ConfirmationManager: 전체 상태 머신 + 동시성 + 타임아웃
   - NotificationDispatcher: 채널 선택 + fallback + 메시지 포맷
   - 통합: 확인 요청 → 알림 → 응답 → 실행 허가 전체 흐름
   - 엣지 케이스: 동시 응답, 만료 직전 응답, 중복 응답 (idempotency)
   - Verify: `vitest run src/lib/autonomy/__tests__/governance.test.ts`
</task>

## Constraints
<constraints>
- 확인 요청은 비동기 (세션 블로킹 없음)
- 타임아웃 기본: 300초 (5분), config.json `sentinel.confirmationTimeout`으로 설정
- 최대 타임아웃: 3600초 (1시간)
- 기존 Telegram/Slack/Web 인터페이스 변경 최소화
- 동시 확인 요청 최대 10개 (초과 시 oldest expired 처리)
- idempotency key로 중복 확인 방지
- 모든 채널 실패 시 안전 모드: 확인 expired 처리 + 행위 차단 (fail-closed), 수동 재시도 가능 (`vibe sentinel approve <id>`)
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/lib/autonomy/ConfirmationStore.ts`
- `src/lib/autonomy/ConfirmationManager.ts`
- `src/lib/autonomy/NotificationDispatcher.ts`
- `src/lib/autonomy/__tests__/governance.test.ts`

### Files to Modify
- `src/lib/memory/MemoryStorage.ts` (confirmations 테이블 추가)
- `src/interface/TelegramBot.ts` (콜백 쿼리 핸들러 추가)
- `src/interface/SlackBot.ts` (Interactive Message 핸들러 추가)
- `src/interface/WebServer.ts` (POST /api/confirmations/:id 추가)
- `src/lib/autonomy/index.ts` (Phase 3 exports 추가)

### Verification Commands
- `vitest run src/lib/autonomy/__tests__/governance.test.ts`
- `npx tsc --noEmit`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: ConfirmationStore가 pending→approved/rejected/expired/cancelled 상태 전환 지원
- [ ] AC-2: 잘못된 상태 전환(예: approved→pending) 시 InvalidTransitionError 발생
- [ ] AC-3: ConfirmationManager가 확인 요청 → 알림 → 응답 → 결과 전체 흐름 처리
- [ ] AC-4: 타임아웃(300초) 경과 시 자동으로 expired 처리
- [ ] AC-5: NotificationDispatcher가 Telegram/Slack/Web 순서로 알림 전송 + fallback
- [ ] AC-6: 모든 채널 실패 시 행위 차단 (fail-closed)
- [ ] AC-7: idempotency key로 중복 확인 방지
- [ ] AC-8: 동시 응답 처리 시 race condition 없음 (SQLite 트랜잭션)
- [ ] AC-9: 모든 테스트 통과 + TypeScript 빌드 성공
</acceptance>
