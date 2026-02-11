# Feature: pc-control — Phase 6: Integration

**SPEC**: `.claude/vibe/specs/pc-control/phase-6-integration.md`
**Master Feature**: `.claude/vibe/features/pc-control/_index.feature`

## User Story (Phase Scope)
**As a** VIBE 사용자
**I want** Telegram/Slack 메시지 또는 음성으로 자연어 명령을 보내면 AI가 적절한 모듈을 자동 호출하도록
**So that** "Gmail 확인하고 중요한 거 Slack으로 보내줘" 같은 복합 명령을 하나의 인터페이스로 실행할 수 있다

## Scenarios

### Scenario 1: 자연어 의도 분류 + 모듈 라우팅
```gherkin
Scenario: 자연어 명령의 의도를 분류하여 적절한 모듈로 라우팅한다
  Given CommandDispatcher가 활성화되어 있다
  When 사용자가 "Google에서 Node.js 22 검색해줘"를 입력한다
  Then 의도가 "browser"로 분류된다
  And Browser 모듈이 호출된다
  And 검색 결과가 원래 채널로 반환된다
```
**Verification**: SPEC AC #1

### Scenario 2: 복합 명령 체인 실행
```gherkin
Scenario: 복합 명령을 순차적으로 실행한다
  Given Browser, Google 모듈이 활성화되어 있다
  When 사용자가 "Gmail 확인하고 중요한 거 Slack으로 보내줘"를 입력한다
  Then Gmail 모듈이 호출되어 미읽은 메일을 조회한다
  And 중요 메일이 필터링된다
  And Slack으로 요약이 전송된다
```
**Verification**: SPEC AC #2

### Scenario 3: 크로스 모듈 컨텍스트 공유
```gherkin
Scenario: 모듈 간 결과를 공유한다
  Given Browser로 페이지를 캡처했다
  When "이 페이지 분석해줘"라고 요청한다
  Then Browser 스크린샷이 Vision 모듈로 전달된다
  And Gemini가 화면 분석 결과를 반환한다
```
**Verification**: SPEC AC #3

### Scenario 4: 채널별 결과 포맷팅
```gherkin
Scenario: 결과를 채널에 맞게 포맷팅한다
  Given 사용자가 Telegram에서 명령을 보냈다
  When 결과에 이미지와 텍스트가 포함된다
  Then Telegram: Markdown + 인라인 이미지로 포맷팅된다
  When 사용자가 Slack에서 동일 명령을 보냈다
  Then Slack: Block Kit + 파일 업로드로 포맷팅된다
  When 음성으로 명령했다
  Then 텍스트 요약 (3문장 이내) → TTS로 변환된다
```
**Verification**: SPEC AC #4

### Scenario 5: SecurityGate 인증 + 정책 검증
```gherkin
Scenario: 요청이 보안 게이트를 통과한다
  Given 사용자가 Telegram에서 인증된 상태이다
  When Browser 도구 사용을 요청한다
  Then 채널별 사용자 식별이 수행된다
  And ToolPolicy 6단계 체인이 검증된다
  And 통과 시 명령이 실행된다
```
**Verification**: SPEC AC #5

### Scenario 6: Rate Limiting
```gherkin
Scenario: 분당 30 요청 초과 시 차단된다
  Given 사용자가 1분 내에 30개 요청을 보냈다
  When 31번째 요청을 보낸다
  Then "요청 한도 초과" 메시지가 반환된다
  And 1분 후 다시 요청이 허용된다
```
**Verification**: SPEC AC #5 (Rate Limit)

### Scenario 7: 감사 로그 기록
```gherkin
Scenario: 모든 명령 실행이 로그에 기록된다
  Given SecurityGate가 활성화되어 있다
  When 사용자가 명령을 실행한다
  Then 명령, 사용자, 채널, 시간, 결과가 SQLite에 기록된다
  And 90일 이상 된 로그는 자동 정리된다
```
**Verification**: SPEC AC #6

### Scenario 8: InterfaceManager 모듈 초기화
```gherkin
Scenario: 데몬 시작 시 모듈이 순서대로 초기화된다
  Given VIBE 데몬이 시작된다
  When 모듈 초기화가 진행된다
  Then Sandbox → Browser → Google → Voice → Vision 순서로 초기화된다
  And 비활성화된 모듈은 건너뛴다
  And 30초 주기로 health check가 실행된다
```
**Verification**: SPEC AC #7

### Scenario 9: 비활성 모듈 명령 처리
```gherkin
Scenario: 비활성 모듈 관련 명령 시 안내 메시지
  Given Vision 모듈이 비활성화되어 있다
  When 사용자가 "화면 캡처해줘"를 요청한다
  Then "Vision 모듈이 비활성화되어 있습니다. 'vibe pc modules'로 확인하세요" 메시지가 반환된다
```
**Verification**: SPEC AC (Module Disabled)

### Scenario 10: CLI 전체 상태 확인
```gherkin
Scenario: CLI로 전체 PC 제어 모듈 상태를 확인한다
  Given VIBE 데몬이 실행 중이다
  When "vibe pc status" 명령을 실행한다
  Then Browser, Google, Voice, Vision, Sandbox 각 모듈의 상태가 표시된다
  When "vibe pc health" 명령을 실행한다
  Then 각 모듈의 health check 결과가 표시된다
```
**Verification**: SPEC AC #8, #9

### Scenario 11: 모듈 초기화 실패 시 부분 가동
```gherkin
Scenario: 특정 모듈 초기화 실패 시 나머지 모듈은 정상 가동한다
  Given Vision 모듈 초기화가 실패한다 (Gemini API 키 미설정)
  When VIBE 데몬이 시작된다
  Then Vision 모듈만 비활성화된다
  And Browser, Google, Voice, Sandbox 모듈은 정상 초기화된다
  And "Vision 모듈 초기화 실패: GEMINI_API_KEY 미설정" 경고 로그가 기록된다
```
**Verification**: SPEC AC (Error Handling)

### Scenario 12: Health Check 실패 시 자동 비활성화
```gherkin
Scenario: Health check 3회 연속 실패 시 모듈을 자동 비활성화한다
  Given Browser 모듈이 활성 상태이다
  When Health check가 3회 연속 실패한다 (30초 간격)
  Then Browser 모듈이 자동 비활성화된다
  And Telegram/Slack으로 "Browser 모듈이 비활성화되었습니다" 알림이 전송된다
```
**Verification**: SPEC AC (Error Handling + Health Check)

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | 의도 분류 + 라우팅 | ✅ |
| 2 | 복합 명령 체인 | ✅ |
| 3 | 크로스 모듈 컨텍스트 | ✅ |
| 4 | 채널별 포맷팅 | ✅ |
| 5 | SecurityGate 인증 | ✅ |
| 6 | Rate Limiting | ✅ |
| 7 | 감사 로그 | ✅ |
| 8 | 모듈 초기화 순서 | ✅ |
| 9 | 비활성 모듈 안내 | ✅ |
| 10 | CLI 상태 확인 | ✅ |
| 11 | 모듈 초기화 실패 | ✅ |
| 12 | Health Check 자동 비활성화 | ✅ |
