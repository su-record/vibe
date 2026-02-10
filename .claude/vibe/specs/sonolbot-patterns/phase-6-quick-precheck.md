---
status: pending
phase: 6
parent: _index.md
depends: [phase-4-mid-task-injection.md]
---

# SPEC: Phase 6 — Quick Pre-Check

## Persona
<role>
데몬 인프라 전문가. 불필요한 에이전트 기동을 방지하는 경량 사전 검사를 구현한다.
소놀봇의 `quick_check.py` (exit code 기반) 패턴을 InterfaceManager에 통합한다.
</role>

## Context
<context>
### Background
현재 Vibe는 메시지가 도착하면 즉시 SessionPool → AgentLoop 전체를 기동한다. 소놀봇은 `quick_check.py`로 0.1초 사전 체크 후, 새 메시지가 있을 때만 Claude Code를 실행하여 불필요한 기동을 90% 줄인다.

### 소놀봇 참조 코드
- `quick_check.py:1-38` — Exit codes: 0=새 메시지 없음, 1=새 메시지 있음, 2=다른 작업 진행 중

### 현재 Vibe 코드
- `src/daemon/InterfaceManager.ts:167` — `registerMessageHandler()`: 메시지 도착 → 즉시 SessionPool 전달
- `src/daemon/VibeDaemon.ts` — IPC health check
</context>

## Task
<task>
### Phase 6-1: InterfaceManager에 quickPreCheck 추가
1. [ ] `quickPreCheck(message: ExternalMessage)` 메서드 구현
   - 반환: `'process' | 'skip' | 'busy'`
   - `'busy'`: 해당 세션이 이미 처리 중 → Phase 4의 pendingInstructions로 전달
   - `'skip'`: 빈 텍스트 + 파일/위치 없음 → 무시
   - `'process'`: 정상 처리 진행
2. [ ] `registerMessageHandler()` 변경: 핸들러 호출 전 quickPreCheck 실행
   - File: `src/daemon/InterfaceManager.ts`

### Phase 6-2: VibeDaemon IPC health check 확장
1. [ ] health check 응답에 `hasPendingMessages: boolean` 필드 추가
2. [ ] `activeSessions: number` 필드 추가
   - File: `src/daemon/VibeDaemon.ts`
</task>

## Constraints
<constraints>
- quickPreCheck는 동기적 O(1) 복잡도, 인메모리 상태만 확인 (I/O, 네트워크 호출 금지)
- 기존 메시지 플로우 변경 최소화
- 'busy' 상태일 때 Phase 4 pendingInstructions로 자동 연동
</constraints>

## Output Format
<output_format>
### Files to Modify
- `src/daemon/InterfaceManager.ts` — quickPreCheck 메서드
- `src/daemon/VibeDaemon.ts` — IPC health check 확장

### Verification Commands
- `npx tsc --noEmit`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] 빈 메시지(텍스트+파일+위치 모두 없음)가 'skip'으로 필터링됨
- [ ] 세션 처리 중일 때 'busy' 반환 + pendingInstructions에 적재
- [ ] 정상 메시지가 'process' 반환 후 기존 플로우 진행
- [ ] IPC health check에 hasPendingMessages, activeSessions 포함
- [ ] TypeScript 컴파일 성공
</acceptance>
