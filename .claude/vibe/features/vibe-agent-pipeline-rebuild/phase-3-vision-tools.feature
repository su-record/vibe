# Feature: vibe-agent-pipeline-rebuild - Phase 3: Vision + Tools

**SPEC**: `.claude/vibe/specs/vibe-agent-pipeline-rebuild/phase-3-vision-tools.md`
**Master Feature**: `.claude/vibe/features/vibe-agent-pipeline-rebuild/_index.feature`

## User Story (Phase Scope)
**As a** Vibe 사용자
**I want** 실시간 비전 분석과 채널 간 메시지 전달이 작동하길 원한다
**So that** 화면 분석, 이미지 인식, 크로스 채널 협업이 가능하다

## Scenarios

### Scenario 1: GeminiLive WebSocket 연결
```gherkin
Scenario: GeminiLive가 WebSocket으로 Gemini API에 연결된다
  Given GEMINI_API_KEY가 설정되었다
  When GeminiLive.connect()가 호출된다
  Then WSS 연결이 성립된다
  And setup 메시지가 전송된다
  And setupComplete 응답이 수신된다
```
**Verification**: SPEC AC #1

### Scenario 2: 이미지 프레임 분석
```gherkin
Scenario: 이미지가 base64로 인코딩되어 Gemini에 전송되고 분석 결과를 받는다
  Given GeminiLive가 연결된 상태이다
  When 640x480 JPEG 이미지가 sendContent()로 전송된다
  Then 이미지가 base64로 인코딩되어 inlineData로 전송된다
  And Gemini로부터 분석 결과 텍스트가 스트리밍으로 수신된다
  And 전체 응답이 조합되어 반환된다
```
**Verification**: SPEC AC #2

### Scenario 3: WebSocket 자동 재연결
```gherkin
Scenario: WebSocket 연결이 끊어지면 자동으로 재연결한다
  Given GeminiLive가 연결된 상태이다
  When WebSocket 연결이 예기치 않게 끊어진다
  Then 1초 후 첫 번째 재연결 시도
  And 실패 시 2초 후 두 번째 시도
  And 실패 시 4초 후 세 번째 시도
  And 3회 모두 실패 시 에러를 보고한다
```
**Verification**: SPEC AC #3

### Scenario 4: Heartbeat 유지
```gherkin
Scenario: 30초마다 PING을 보내 연결을 유지한다
  Given GeminiLive가 연결된 상태이다
  When 30초가 경과한다
  Then PING 프레임이 서버로 전송된다
  And PONG 응답이 수신된다
  And 연결이 유지된다
```
**Verification**: SPEC AC #4

### Scenario 5: vision_analyze 도구 실시간 분석
```gherkin
Scenario: vision_analyze 도구가 GeminiLive를 통해 실시간 이미지 분석을 수행한다
  Given GeminiLive가 연결된 상태이다
  And vision_analyze 도구가 등록되었다
  When GPT가 vision_analyze를 호출한다
  Then GeminiLive.sendContent()로 이미지가 전송된다
  And 분석 결과가 도구 결과로 반환된다
```
**Verification**: SPEC AC #5

### Scenario 6: DM Pairing 채널 간 전달
```gherkin
Scenario: DM pairing으로 Telegram 메시지를 Slack으로 전달한다
  Given dm_pair 도구가 등록되었다
  And allowlist에 Telegram→Slack 경로가 허용되었다
  When GPT가 dm_pair를 { sourceChannel: "telegram", targetChannel: "slack", message: "안녕" }로 호출한다
  Then 메시지가 Slack 대상 채널로 전달된다
```
**Verification**: SPEC AC #6

### Scenario 7: SSRF 방어
```gherkin
Scenario: 브라우저/Vision 도구에서 private IP 접근이 차단된다
  Given web_browse_advanced 도구가 등록되었다
  When URL "http://169.254.169.254/latest/meta-data/"가 요청된다
  Then isPrivateIP() 검증에 의해 요청이 차단된다
  And "SSRF blocked: private IP range" 에러가 반환된다
```
**Verification**: SPEC AC #7

### Scenario 8: base64 이미지 크기 제한
```gherkin
Scenario: 5MB 초과 이미지 전송 시 에러가 반환된다
  Given GeminiLive가 연결된 상태이다
  When 6MB 크기의 이미지가 sendContent()로 전송된다
  Then "Image size exceeds 5MB limit" 에러가 반환된다
  And WebSocket 연결은 유지된다
```
**Verification**: SPEC Constraints (base64 이미지 크기 제한: 5MB)

### Scenario 9: WebSocket 메시지 크기 제한
```gherkin
Scenario: 10MB 초과 WebSocket 메시지가 거부된다
  Given GeminiLive가 연결된 상태이다
  When 11MB 크기의 메시지가 전송된다
  Then "WebSocket message exceeds 10MB limit" 에러가 반환된다
  And WebSocket 연결은 유지된다
```
**Verification**: SPEC Constraints (WebSocket 메시지 크기 제한: 10MB)

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 | ✅ |
| 2 | AC-2 | ✅ |
| 3 | AC-3 | ✅ |
| 4 | AC-4 | ✅ |
| 5 | AC-5 | ✅ |
| 6 | AC-6 | ✅ |
| 7 | AC-7 | ✅ |
| 8 | Constraint | ✅ |
| 9 | Constraint | ✅ |
