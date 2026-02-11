---
status: pending
phase: 4
createdAt: 2026-02-06T17:31:00+09:00
---

# SPEC: Phase 4 - telegram-bridge.ts 업그레이드 + 설정 확장

## Persona

<role>
Senior TypeScript engineer specializing in:
- 기존 코드 리팩토링 (최소 변경)
- CLI 설정 관리
- 프로세스 생명주기 관리
- 시스템 통합 (Phase 1-3 모듈 연동)
</role>

## Context

<context>

### Background
Phase 1-3에서 만든 모듈(claude-agent, message-router, task-notifier)을
기존 `telegram-bridge.ts`에 통합한다. 기존 `askClaude()`를 MessageRouter로 교체하고,
슬래시 명령 추가, 동시 요청 큐잉, 설정 확장을 적용한다.

### Why
- 현재 단일 요청만 처리 (processing 플래그)
- 슬래시 명령으로 작업 관리 필요
- 설정에 defaultWorkspace, maxTurns, timeout 등 추가
- 동시 여러 메시지 큐잉 처리

### Related Code
- `src/bridge/telegram-bridge.ts`: 현재 구현 (186줄)
- `src/bridge/claude-agent.ts`: Phase 1 결과물
- `src/bridge/message-router.ts`: Phase 2 결과물
- `src/bridge/task-notifier.ts`: Phase 3 결과물
- `src/cli/commands/telegram.ts`: CLI 설정 관리

</context>

## Task

<task>

### 1. telegram-bridge.ts 업그레이드

1. [ ] import 추가
   - `MessageRouter` from `./message-router.js`
   - `TaskNotifier`, `SessionContextManager` from `./task-notifier.js`
   - `buildSystemPrompt` from `./system-prompt.js`
   - `findClaudePath` from `./claude-agent.js`

2. [ ] 설정 인터페이스 확장
   ```typescript
   interface TelegramBridgeConfig {
     botToken: string;
     allowedChatIds: string[];
     defaultWorkspace?: string;   // 기본 작업 디렉토리
     maxTurns?: number;           // Claude CLI 턴 수 (기본 5)
     timeout?: number;            // 타임아웃 ms (기본 300000)
     provider?: 'auto' | 'claude' | 'gpt' | 'gemini';  // LLM 선택
   }
   ```

3. [ ] `askClaude()` 제거 → `MessageRouter.route()` 교체
   - `findClaude()` 함수 제거 (claude-agent.ts로 이동됨)
   - `askClaude()` 함수 제거
   - 대신 MessageRouter.route() 호출

4. [ ] 슬래시 명령 핸들러 구현
   - `/start` → 웰컴 메시지 (기존)
   - `/status` → 봇 상태 (uptime, 활성 작업 수, LLM 상태)
   - `/tasks` → 진행 중인 작업 목록
   - `/cancel <taskId>` → 작업 취소
   - `/workspace <path>` → 기본 작업 디렉토리 변경
   - `/help` → 사용 가능한 명령 목록

5. [ ] 동시 요청 큐잉 구현
   - `processing` 플래그 → `messageQueue: Map<string, ExternalMessage[]>` 교체
   - per-chatId 큐 관리
   - 현재 처리 중이면 큐에 추가
   - 처리 완료 후 다음 메시지 자동 처리
   - 큐 최대 크기: 10 (초과 시 "잠시 후 다시 시도" 응답)

6. [ ] 메시지 처리 흐름 업그레이드
   ```
   onMessage 수신
     ↓
   슬래시 명령? → 슬래시 핸들러
     ↓ (아님)
   세션 컨텍스트 로드 (SessionContextManager.getContext)
     ↓
   MessageRouter.route(message, chatId)
     ↓
   async 응답? → "작업 시작됨" (TaskNotifier가 완료 알림)
   sync 응답? → 즉시 텔레그램 전송
     ↓
   세션 컨텍스트 저장
   AgentRegistry 기록
   ```

7. [ ] 봇 시작 시 초기화
   - MessageRouter 인스턴스 생성 (RouterConfig 적용)
   - TaskNotifier 인스턴스 생성
   - SessionContextManager 인스턴스 생성
   - AgentRegistry.getIncompleteExecutions()로 미완료 작업 복구 시도
   - 시작 로그에 설정 정보 출력

8. [ ] 종료 시 정리
   - 진행 중인 작업에 취소 요청 (graceful)
   - SessionRAG 컨텍스트 저장
   - 로그에 종료 사유 기록

### 2. CLI 설정 확장 (`src/cli/commands/telegram.ts`)

9. [ ] `telegramSetup` 확장
   - 기존: `vibe telegram setup <token>` (토큰만)
   - 추가 옵션: `--workspace`, `--max-turns`, `--timeout`, `--provider`
   - 기존 설정 유지하면서 새 필드만 업데이트

10. [ ] `telegramConfig` 신규 명령 추가
    - `vibe telegram config` → 현재 설정 표시
    - `vibe telegram config set <key> <value>` → 설정 변경
    - key: defaultWorkspace, maxTurns, timeout, provider
    - 값 검증: maxTurns(1-20), timeout(30000-600000), provider 열거형

11. [ ] CLI 라우터에 config 명령 등록
    - `src/cli/commands/index.ts`에 export 추가
    - `src/cli/index.ts`에 case 추가

### 3. 통합 테스트 고려사항

12. [ ] 에러 복구 흐름
    - SmartRouter 모든 LLM 실패 → Claude CLI 폴백
    - Claude CLI 실패 → 에러 메시지 반환
    - 네트워크 에러 → 재시도 (최대 2회)
    - 텔레그램 전송 실패 → 로그 기록 후 다음 메시지 처리

</task>

## Constraints

<constraints>
- 기존 telegram-bridge.ts의 동작(봇 시작/종료, 로깅)은 유지
- 하위 호환: 기존 telegram.json 설정 파일도 정상 동작 (새 필드는 선택적)
- 큐 크기 제한: per-chatId 최대 10개 (OOM 방지)
- 슬래시 명령은 즉시 응답 (LLM 호출 없음)
- /workspace 경로 변경 시 path traversal 검증
- 봇 재시작 후 미완료 작업은 알림만 (자동 재실행 안 함)
- CLI config 명령에서 botToken 변경은 setup으로만 가능 (보안)
</constraints>

## Output Format

<output_format>

### Files to Create
- (없음)

### Files to Modify
- `src/bridge/telegram-bridge.ts` - 전면 업그레이드
- `src/cli/commands/telegram.ts` - telegramConfig 명령 추가
- `src/cli/commands/index.ts` - telegramConfig export 추가
- `src/cli/index.ts` - config 라우터 케이스 추가

### Verification Commands
- `npm run build`
- `vibe telegram start` → 봇 시작
- 텔레그램에서 `/start`, `/status`, `/tasks` 명령 테스트
- 일반 메시지 → SmartRouter 경유 응답 확인
- `vibe telegram stop` → 정상 종료

</output_format>

## Acceptance Criteria

<acceptance>
- [ ] 기존 telegram.json으로 봇 시작 가능 (하위 호환)
- [ ] 일반 메시지 → MessageRouter를 통해 적절한 경로로 라우팅됨
- [ ] `/start` → 웰컴 메시지
- [ ] `/status` → 봇 상태 (uptime, 활성 작업, LLM 상태)
- [ ] `/tasks` → 진행 중인 작업 목록
- [ ] `/cancel taskId` → 작업 취소
- [ ] `/help` → 명령 목록
- [ ] 동시 메시지 수신 시 큐잉되어 순차 처리됨
- [ ] 큐 10개 초과 시 거부 메시지 반환
- [ ] 개발 작업 완료 시 텔레그램으로 알림 수신
- [ ] `vibe telegram config` → 현재 설정 표시
- [ ] `vibe telegram config set maxTurns 10` → 설정 변경됨
- [ ] `npm run build` 성공
- [ ] `vibe telegram start/stop` 정상 동작
</acceptance>
