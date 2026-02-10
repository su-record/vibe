---
status: pending
phase: 5
---

# SPEC: agent-autonomy — Phase 5: Multi-Agent Collaboration & Integration

## Persona
<role>
Senior TypeScript engineer specializing in multi-agent systems and task orchestration.
Implement autonomous task decomposition and multi-agent collaboration protocol.
Integrate all Phase 1-4 components into unified system with CLI and hook integration.
</role>

## Context
<context>
### Background
사용자의 자연어 요청을 자율적으로 분해하여 SPEC → Review → Implementation → Test 파이프라인으로 실행.
멀티 에이전트 협업으로 병렬 처리하고, SecuritySentinel이 전 과정을 감시.
Full Auto 모드에서는 체크포인트 없이 자동 실행.

### 기존 시스템
- `src/lib/OrchestrateWorkflow.ts`: 기존 오케스트레이션 패턴
- `src/lib/UltraQA.ts`: 5-Cycle QA 패턴
- Agent Teams: TeamCreate/SendMessage 패턴
- Phase 1-4: EventBus, SecuritySentinel, ConfirmationManager, ProactiveAnalyzer

### Research Insights
- GPT: "Segregate execution worker from decision-making; use IPC/message queue"
- GPT: "Require multi-factor approval for HIGH risk intents"
- Gemini: "Strict Type-Safe Contracts for inter-agent communication"
- Kimi: "Optimistic Locking with version vectors for distributed agent decisions"
- Kimi: "Event Storming Load Tests — 10k+ concurrent governance proposals"
</context>

## Task
<task>
### Phase 5-1: TaskDecomposer 구현
1. [ ] `src/lib/autonomy/TaskDecomposer.ts` 생성
   - File: `src/lib/autonomy/TaskDecomposer.ts`
   - `decompose(userPrompt: string): DecomposedTask`
   - DecomposedTask:
     ```typescript
     interface DecomposedTask {
       id: string;
       originalPrompt: string;
       steps: TaskStep[];
       estimatedComplexity: 'low' | 'medium' | 'high';
       requiresConfirmation: boolean;
       createdAt: string;
     }
     interface TaskStep {
       id: string;
       order: number;
       type: 'spec' | 'review' | 'implement' | 'test' | 'deploy';
       description: string;
       dependencies: string[]; // DAG (Directed Acyclic Graph) 검증 필수, 순환 의존성 시 CircularDependencyError throw
       estimatedFiles: number;
       riskLevel: RiskLevel;
       status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
     }
     ```
   - 분해 규칙:
     | 요청 유형 | 분해 단계 |
     |----------|----------|
     | 단순 수정 (1-2 파일) | implement → test |
     | 기능 추가 (3-5 파일) | spec → implement → test |
     | 대규모 기능 (6+ 파일) | spec → review → implement → test |
   - 복잡도 추정 (결정론적, LLM 호출 없음):
     - 키워드 분석: "refactor"/"migration"/"architecture" → high, "add"/"create"/"implement" → medium, "fix"/"update"/"change" → low
     - 파일 수 추정: AST 기반 import/export 분석으로 영향 파일 수 계산
     - 기준: 1-2 파일 → low, 3-5 파일 → medium, 6+ 파일 → high
   - SecuritySentinel을 통한 전체 태스크 위험도 평가
   - Verify: 분해 규칙 + 복잡도 추정 테스트

### Phase 5-2: AutonomyOrchestrator 구현
2. [ ] `src/lib/autonomy/AutonomyOrchestrator.ts` 생성
   - File: `src/lib/autonomy/AutonomyOrchestrator.ts`
   - `execute(task: DecomposedTask, mode: 'suggest' | 'auto'): ExecutionResult`
   - suggest 모드:
     1. 분해 결과를 사용자에게 표시
     2. 사용자 승인 후 실행
   - auto 모드 (Full Auto):
     1. LOW/MEDIUM 위험: 체크포인트 없이 자동 실행
     2. HIGH 위험: ConfirmationManager로 오너 확인
     3. 각 step 완료 시 EventBus 이벤트 발행
     4. 실패 시 자동 롤백:
        - auto 모드 시작 전 `git stash push -u -m "autonomy-backup-{taskId}"` 로 현재 변경사항 백업
        - **파일 수정 step은 순차 실행** (git working tree 충돌 방지)
        - 각 step 시작 전 `HEAD` commit hash 기록 (`stepStartRef`)
        - step 실행 중 생성된 파일 목록 추적 (파일 시스템 diff: step 시작 시 스냅샷 vs 현재)
        - step 실패 시: `git reset --hard {stepStartRef}` + 추적된 신규 파일만 삭제 (무분별한 `git clean -fd` 금지)
        - 전체 실패 시 `git stash pop` 으로 원래 상태 복원
        - DB 변경은 SQLite 트랜잭션으로 원자적 롤백
        - auto 모드 시작 전 clean working directory 확인 (uncommitted changes 있으면 경고 후 사용자 확인)
   - 병렬 실행: 의존성 없는 **비파일 step만** 병렬 처리 (최대 3개, config.json `autonomy.maxConcurrentSteps`). 파일 수정 step은 순차 실행
   - 진행 상황 추적: `getProgress(taskId): TaskProgress`
   - 최대 실행 시간: 600초 (10분) per step
   - Verify: suggest/auto 모드 + 병렬 실행 + 롤백 테스트

### Phase 5-3: CollaborationProtocol 구현
3. [ ] `src/lib/autonomy/CollaborationProtocol.ts` 생성
   - File: `src/lib/autonomy/CollaborationProtocol.ts`
   - 에이전트 간 통신 프로토콜:
     ```typescript
     interface AgentMessage {
       id: string;
       from: string;
       to: string;
       type: 'request' | 'response' | 'broadcast' | 'handoff';
       payload: unknown;
       correlationId: string;
       timestamp: string;
     }
     ```
   - 역할 기반 에이전트 할당:
     | 역할 | 에이전트 | 책임 |
     |------|---------|------|
     | Planner | architect | 태스크 분석 + 계획 |
     | Implementer | implementer | 코드 구현 |
     | Reviewer | security-reviewer + typescript-reviewer | 코드 리뷰 |
     | Tester | tester | 테스트 작성 + 실행 |
     | Sentinel | SecuritySentinel | 전 과정 감시 |
   - `assignAgent(step: TaskStep): AgentAssignment`
   - `handoff(from, to, context): HandoffResult`
   - 에이전트 간 컨텍스트 전달: 파일 목록, 변경 사항, 결정 사항
   - 에이전트 실패/타임아웃 처리:
     - step당 타임아웃: 600초 (10분), 초과 시 AbortController로 중단
     - 실패 시 1회 재시도 (동일 에이전트)
     - 재시도 실패 시: 오너에게 알림 + step을 'failed'로 마킹 + 사용자 수동 개입 대기
     - failed step이 있어도 독립적인 다른 step은 계속 실행
   - 메시지 크기 제한: 최대 10KB per AgentMessage
   - Verify: 에이전트 할당 + 핸드오프 + 컨텍스트 전달 + 실패 처리 테스트

### Phase 5-4: CLI 통합
4. [ ] `src/cli/commands/sentinel.ts` 생성
   - File: `src/cli/commands/sentinel.ts`
   - CLI 명령어:
     | 명령어 | 설명 |
     |--------|------|
     | `vibe sentinel status` | Sentinel 현황 (정책, 감사 통계, 확인 대기) |
     | `vibe sentinel audit [--type] [--risk] [--days]` | 감사 로그 조회 |
     | `vibe sentinel approve <id>` | 확인 요청 승인 |
     | `vibe sentinel reject <id>` | 확인 요청 거부 |
     | `vibe sentinel policy list` | 정책 목록 |
     | `vibe sentinel policy enable/disable <name>` | 정책 활성화/비활성화 |
     | `vibe sentinel suggestions` | 프로액티브 제안 목록 |
     | `vibe sentinel suggestions accept/dismiss <id>` | 제안 수락/무시 |
     | `vibe sentinel audit --dead-letter` | Dead Letter Queue 목록 |
     | `vibe sentinel audit --retry <id>` | Dead Letter 이벤트 수동 재시도 |
     | `vibe sentinel audit --discard <id>` | Dead Letter 이벤트 폐기 |
   - Verify: 각 CLI 명령어 실행 테스트

5. [ ] CLI commands/index.ts 업데이트
   - File: `src/cli/commands/index.ts` (수정)
   - sentinel 명령어 export 추가
   - Verify: import 테스트

### Phase 5-5: Hook 통합
6. [ ] UserPromptSubmit hook 확장
   - File: `hooks/scripts/prompt-dispatcher.js` (수정)
   - autonomy.mode="auto" 설정 시:
     1. 사용자 프롬프트를 TaskDecomposer로 전달
     2. 분해 결과의 위험도에 따라 자동 실행 또는 확인 요청
     3. EventBus에 agent_action 이벤트 발행
   - autonomy.mode="suggest" (기본):
     1. 프롬프트 분석 후 분해 결과만 표시
     2. 사용자 확인 후 실행
   - Verify: auto/suggest 모드 hook 동작 테스트

7. [ ] 세션 시작 통합
   - File: `hooks/scripts/session-start.js` (수정)
   - 세션 시작 시 autonomy 현황 요약:
     ```
     🤖 Agent Autonomy: auto mode
       🛡️ Sentinel: 5 policies active, 0 pending confirmations
       💡 Suggestions: 3 pending (1 security, 2 quality)
       📊 Last 24h: 47 actions (45 allowed, 2 blocked)
     ```
   - Verify: 세션 시작 출력 테스트

### Phase 5-6: Config 통합
8. [ ] config.json 스키마 확장
   - File: `.claude/vibe/config.json` (문서화)
   - 새 키:
     ```json
     {
       "sentinel": {
         "enabled": true,
         "notificationChannels": ["telegram", "slack", "web"],
         "confirmationTimeout": 300,
         "rules": []
       },
       "autonomy": {
         "mode": "suggest",
         "proactive": {
           "enabled": true,
           "modules": ["security", "performance", "quality", "dependency"]
         },
         "maxConcurrentSteps": 3,
         "maxStepTimeout": 600
       }
     }
     ```
   - Zod 스키마로 config 검증:
     - `confirmationTimeout`: min 60, max 3600 (초)
     - `maxConcurrentSteps`: min 1, max 5
     - `maxStepTimeout`: min 60, max 3600 (초)
     - `notificationChannels`: enum ['telegram', 'slack', 'web'] 배열
     - `mode`: enum ['suggest', 'auto', 'disabled']
     - 잘못된 값 입력 시 기본값 사용 + stderr 경고 로그
   - config.json에서 설정 미존재 시 기본값 사용
   - `sentinel.enabled=false` 시: sentinel-guard hook 비활성화, AuditStore는 EventBus의 모든 이벤트를 직접 구독하여 감사 로그 계속 기록 (PolicyEngine/RiskClassifier 우회, outcome='unmonitored')
   - `autonomy.mode="disabled"` 시: TaskDecomposer 비활성화
   - Verify: 설정 로드 + 기본값 테스트

### Phase 5-7: Module Export & 통합 테스트
9. [ ] 모듈 export 최종화
   - File: `src/lib/autonomy/index.ts` (최종 업데이트)
   - Phase 1-5 전체 export
   - `src/tools/index.ts`에 autonomy 도구 추가
   - Verify: import 테스트

10. [ ] 통합 테스트
    - File: `src/lib/autonomy/__tests__/integration.test.ts`
    - 전체 흐름: 프롬프트 → 분해 → 위험 평가 → 실행/확인 → 감사
    - auto 모드: LOW 위험 자동 실행
    - auto 모드: HIGH 위험 확인 요청 → 승인 → 실행
    - suggest 모드: 분해 결과 표시
    - 비활성화: sentinel.enabled=false, autonomy.mode="disabled"
    - Verify: `vitest run src/lib/autonomy/__tests__/integration.test.ts`
</task>

## Constraints
<constraints>
- 기존 OrchestrateWorkflow, UltraQA 인터페이스 유지
- TaskDecomposer는 LLM 호출 없이 규칙 기반 (결정론적)
- auto 모드에서도 HIGH 위험 행위는 반드시 오너 확인
- 에이전트 간 메시지 크기: 최대 10KB
- 동시 step 실행: 최대 3개 (config.json 설정)
- 전체 태스크 타임아웃: 3600초 (1시간)
- CLI 명령어는 기존 vibe CLI 패턴 따르기
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/lib/autonomy/TaskDecomposer.ts`
- `src/lib/autonomy/AutonomyOrchestrator.ts`
- `src/lib/autonomy/CollaborationProtocol.ts`
- `src/cli/commands/sentinel.ts`
- `src/tools/autonomy/proactiveSuggestions.ts` (Phase 4에서 이미 생성)
- `src/lib/autonomy/__tests__/integration.test.ts`

### Files to Modify
- `src/cli/commands/index.ts` (sentinel 명령어 추가)
- `src/cli/index.ts` (sentinel 라우팅 추가)
- `src/tools/index.ts` (autonomy 도구 추가)
- `hooks/scripts/prompt-dispatcher.js` (autonomy 분기 추가)
- `hooks/scripts/session-start.js` (autonomy 현황 표시)
- `src/lib/autonomy/index.ts` (전체 export 최종화)

### Verification Commands
- `vitest run src/lib/autonomy/__tests__/`
- `npx tsc --noEmit`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: TaskDecomposer가 사용자 프롬프트를 단계별로 분해하고 복잡도 추정
- [ ] AC-2: AutonomyOrchestrator suggest 모드에서 분해 결과만 표시
- [ ] AC-3: AutonomyOrchestrator auto 모드에서 LOW/MEDIUM 자동 실행
- [ ] AC-4: auto 모드에서 HIGH 위험 시 ConfirmationManager로 오너 확인
- [ ] AC-5: CollaborationProtocol이 에이전트 간 핸드오프 + 컨텍스트 전달
- [ ] AC-6: CLI `vibe sentinel` 명령어가 정상 동작
- [ ] AC-7: 세션 시작 시 autonomy 현황 요약 표시
- [ ] AC-8: config.json sentinel/autonomy 설정이 정상 적용
- [ ] AC-9: sentinel.enabled=false 시 모든 감시 비활성화 (감사 로그만 유지)
- [ ] AC-10: 전체 통합 테스트 통과 + TypeScript 빌드 성공
</acceptance>
