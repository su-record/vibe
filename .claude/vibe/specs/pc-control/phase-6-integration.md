---
status: pending
phase: 6
---

# SPEC: pc-control — Phase 6: Integration (전체 통합)

## Persona
<role>
시스템 통합 전문가. Phase 1~5에서 구현된 Browser, Google Apps, Voice, Vision, Docker Sandbox를 하나의 통합 인터페이스로 연결하고, 메시지/음성 양쪽에서 자연어로 모든 기능을 호출할 수 있는 Unified Command Layer를 구축한다.
</role>

## Context
<context>

### Background
- Phase 1: Browser Automation (Playwright ARIA Snapshot)
- Phase 2: Google Apps (Per-user OAuth)
- Phase 3: Voice Pipeline (STT/TTS/VAD)
- Phase 4: Vision Live (Full/Region/Window 실시간 캡처)
- Phase 5: Docker Sandbox (컨테이너 격리 + Tool Policy)
- **Gap**: 각 Phase가 독립 모듈 → 통합 인터페이스 없음
- **Goal**: Telegram/Slack 메시지 + 음성 → 자연어 의도 파악 → 적절한 모듈 호출 → 결과 반환

### Tech Stack
- VIBE InterfaceManager (기존 Telegram/Slack/Web 인터페이스)
- SmartRouter (기존 LLM 라우팅)
- PolicyEngine (기존 정책 엔진)
- Zod (스키마 검증)

### Integration Points
| Source | Target | 연결 |
|--------|--------|------|
| Telegram 메시지 | Browser/Google/Vision | 자연어 → 도구 호출 |
| Slack 메시지 | Browser/Google/Vision | 자연어 → 도구 호출 |
| Voice (WebSocket) | 모든 모듈 | 음성 → STT → 도구 호출 → TTS |
| Vision 세션 | Voice | "화면 보면서 대화" |
| Browser 결과 | Telegram/Slack | 스크린샷 + 텍스트 응답 |
| Google Apps 결과 | Telegram/Slack | 파일 링크 + 요약 응답 |

### Research Insights
- **GPT**: Capability-based service registry, unified tool dispatcher
- **Gemini**: Semantic state compression, cross-module context sharing
- **Kimi**: Factory pattern for dynamic module provisioning, event bus for inter-module communication
</context>

## Task
<task>

### Phase 6-1: Unified Command Dispatcher
1. [ ] `src/integration/CommandDispatcher.ts` — 통합 명령 분배기
   - 자연어 입력 → 의도 분류 (browser/google/voice/vision/sandbox/general)
   - 의도별 적절한 모듈 라우팅
   - 복합 명령 지원: "Gmail 확인하고 중요한 거 Slack으로 보내줘"
   - 실행 결과를 원래 채널로 반환
   - Verify: 의도 분류 + 라우팅 테스트

2. [ ] `src/integration/ModuleRegistry.ts` — 모듈 등록/관리
   - 각 Phase 모듈 등록 (Browser, Google, Voice, Vision, Sandbox)
   - 모듈 상태 확인 (enabled/disabled/error)
   - 의존성 검증: Vision → Sandbox (SaaS 모드)
   - Lazy loading: 사용 시 초기화
   - Verify: 모듈 등록/조회 테스트

### Phase 6-2: Cross-Module Context
3. [ ] `src/integration/SessionContext.ts` — 크로스 모듈 세션 컨텍스트
   - 대화 컨텍스트 유지 (사용자별)
   - 모듈 간 결과 공유: Browser 스크린샷 → Vision 분석
   - 히스토리: 최근 10개 명령 + 결과 요약
   - 세션 TTL: 30분 비활성 → 정리
   - Verify: 컨텍스트 공유 테스트

4. [ ] `src/integration/ResultFormatter.ts` — 결과 포매터
   - 채널별 포맷 변환:
     - Telegram: Markdown + 인라인 이미지
     - Slack: Block Kit + 파일 업로드
     - Voice: 텍스트 요약 → TTS
     - Web: JSON + Base64 이미지
   - 긴 결과 자동 요약 (3문장 이내)
   - 에러 결과: 사용자 친화적 메시지 + 재시도 제안
   - Verify: 각 채널 포맷 변환 테스트

### Phase 6-3: Security Integration
5. [ ] `src/integration/SecurityGate.ts` — 통합 보안 게이트
   - 요청 인증: 채널별 사용자 식별
   - ToolPolicy 체크: Phase 5의 6단계 정책 체인 호출
   - Rate limiting: 사용자별 분당 30 요청
   - 감사 로그: 모든 명령 실행 기록 (SQLite)
   - 위험 명령 승인: Telegram/Slack 인라인 버튼
   - Verify: 인증 + 정책 + 제한 테스트

### Phase 6-4: InterfaceManager 확장
6. [ ] `src/daemon/InterfaceManager.ts` 수정 — Phase 1~5 초기화
   - 시작 시 모듈 초기화 순서: Sandbox → Browser → Google → Voice → Vision
   - 설정 기반 활성화 (`config.json`의 `modules.*`)
   - 상태 모니터링: 각 모듈 health check (30초 주기)
   - 그레이스풀 셧다운: 역순 정리
   - Verify: 초기화/셧다운 순서 테스트

### Phase 6-5: MCP Tool 통합
7. [ ] `src/tools/integration/index.ts` — 통합 MCP 도구
   - `core_pc_status`: 전체 모듈 상태
   - `core_pc_command`: 자연어 통합 명령 실행
   - `core_pc_modules`: 모듈 활성화/비활성화
   - Verify: MCP 등록 확인

### Phase 6-6: CLI 통합
8. [ ] `src/cli/commands/pc.ts` — 통합 CLI
   - `vibe pc status`: 전체 모듈 상태
   - `vibe pc modules`: 모듈 목록 + 상태
   - `vibe pc health`: 헬스 체크 실행
   - Verify: CLI 실행 테스트

### Phase 6-7: 테스트
9. [ ] `src/integration/CommandDispatcher.test.ts`
10. [ ] `src/integration/SecurityGate.test.ts`
11. [ ] `src/integration/ResultFormatter.test.ts`
</task>

## Constraints
<constraints>
- 기존 InterfaceManager/PolicyEngine/SmartRouter 아키텍처 유지
- 각 Phase 모듈은 독립 동작 가능 (통합 레이어 없이도)
- 모듈 비활성화 시 관련 명령 → "모듈이 비활성화되어 있습니다" 메시지
- SaaS 모드: 반드시 Sandbox 내에서 Browser/코드 실행
- 로컬 모드: Sandbox 선택적
- Rate limit: 사용자별 분당 30 요청 (설정 가능)
- 감사 로그: 90일 보관 (SQLite, 자동 정리)
- [P1] 감사 로그 보안: 필드별 마스킹 (토큰, 이메일 본문 등), at-rest 암호화, 해시체인 무결성, RBAC 조회 권한
- [P1] 복합 명령: stepwise 실행 + idempotency key, 부분 실패 시 보상 작업/스킵 정책, 부분 성공 리포트 반환
- [P1] Rate limit: sliding window 알고리즘, burst 허용 (분당 30 + burst 10), 채널별/사용자별 독립 카운터
- [P1] Health check: 내부 상태 기반 (외부 API 미호출), 외부 API 상태는 저주기 (5분) 별도 체크
- [P2] 의도 분류 신뢰도 임계값: 0.7 미만 시 사용자에게 clarification 요청
- 함수 ≤30줄, 중첩 ≤3레벨
</constraints>

## Output Format
<output_format>

### Files to Create
- `src/integration/CommandDispatcher.ts`
- `src/integration/ModuleRegistry.ts`
- `src/integration/SessionContext.ts`
- `src/integration/ResultFormatter.ts`
- `src/integration/SecurityGate.ts`
- `src/integration/types.ts`
- `src/tools/integration/index.ts`
- `src/cli/commands/pc.ts`
- `src/integration/CommandDispatcher.test.ts`
- `src/integration/SecurityGate.test.ts`
- `src/integration/ResultFormatter.test.ts`

### Files to Modify
- `src/daemon/InterfaceManager.ts` — 모듈 초기화 통합
- `src/policy/` — SecurityGate 연결
- `src/tools/index.ts` — integration 도구 export
- `src/bridge/telegram-bridge.ts` — CommandDispatcher 연결
- `src/bridge/slack-bridge.ts` — CommandDispatcher 연결

### Verification Commands
- `pnpm test -- --grep integration`
- `pnpm build`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] 자연어 명령 → 의도 분류 → 적절한 모듈 라우팅
- [ ] 복합 명령 실행: "Gmail 확인 → Slack 전송" 체인
- [ ] 크로스 모듈 컨텍스트: Browser 결과 → Vision 분석
- [ ] 채널별 결과 포맷: Telegram(Markdown) / Slack(Block Kit) / Voice(TTS)
- [ ] SecurityGate: 인증 + ToolPolicy + Rate Limit 동작
- [ ] 감사 로그: 모든 명령 기록
- [ ] InterfaceManager: 모듈 초기화/셧다운 순서
- [ ] `vibe pc status/modules/health` CLI 동작
- [ ] 의도 분류 응답 ≤500ms
- [ ] 단일 명령 E2E 응답 ≤10초 (AI 처리 시간 제외)
- [ ] 복합 명령 E2E 응답 ≤30초 (AI 처리 시간 제외)
- [ ] 모듈 초기화 실패 시 해당 모듈만 비활성화 (전체 데몬 크래시 방지)
- [ ] Health check 실패 3회 연속 → 모듈 자동 비활성화 + 알림
- [ ] 모든 테스트 통과 + 빌드 성공
</acceptance>
