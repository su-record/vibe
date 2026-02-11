# Feature: pc-control — Phase 4: Vision Live

**SPEC**: `.claude/vibe/specs/pc-control/phase-4-vision-live.md`
**Master Feature**: `.claude/vibe/features/pc-control/_index.feature`

## User Story (Phase Scope)
**As a** VIBE 사용자
**I want** AI가 내 화면을 실시간으로 보면서 대화하듯 피드백을 주도록
**So that** "지금 화면 봐봐, 이 에러 뭔지 알겠어?" 같은 실시간 디버깅이 가능하다

## Scenarios

### Scenario 1: Full Screen 캡처
```gherkin
Scenario: 전체 화면을 캡처하여 Gemini에 전송한다
  Given Vision 세션이 "full" 모드로 시작된다
  When 화면 캡처가 실행된다
  Then 전체 화면이 1280x720으로 다운스케일된다
  And WebP/AVIF로 압축된다
  And Gemini Live WebSocket으로 전송된다
```
**Verification**: SPEC AC #1

### Scenario 2: Region 캡처
```gherkin
Scenario: 지정 영역만 캡처한다
  Given Vision 세션이 "region" 모드이다
  When captureRegion(100, 200, 800, 600) 을 호출한다
  Then (100,200) 좌표에서 800x600 영역만 캡처된다
  And 원본 해상도로 전송된다
```
**Verification**: SPEC AC #2

### Scenario 3: Window 캡처
```gherkin
Scenario: 특정 윈도우만 캡처한다
  Given "Visual Studio Code" 윈도우가 열려 있다
  When captureWindow("Visual Studio Code") 를 호출한다
  Then 해당 윈도우 영역만 캡처된다
  And 다른 윈도우가 가려도 정상 캡처된다
```
**Verification**: SPEC AC #3

### Scenario 4: 적응형 프레임 샘플링
```gherkin
Scenario: 화면 변경이 없으면 프레임을 스킵한다
  Given Vision 세션이 스트리밍 중이다
  And 최소 FPS가 1로 설정되어 있다
  When 2초간 화면에 변경이 없다
  Then 프레임 전송이 스킵된다 (대역폭 절감)
  And 변경 감지 시 즉시 프레임이 전송된다
```
**Verification**: SPEC AC #4

### Scenario 5: Gemini Live 양방향 스트리밍
```gherkin
Scenario: 비디오+오디오를 양방향으로 스트리밍한다
  Given Gemini Live WebSocket이 연결된 상태이다
  When 비디오 프레임과 오디오를 인터리빙 전송한다
  Then Gemini가 텍스트 + 오디오 응답을 반환한다
  And 응답이 실시간으로 수신된다
```
**Verification**: SPEC AC #5

### Scenario 6: 모드 실시간 전환
```gherkin
Scenario: 캡처 모드를 실시간으로 전환한다
  Given Full Screen 모드로 스트리밍 중이다
  When core_vision_mode 도구를 { mode: "region", x: 0, y: 0, w: 800, h: 600 } 으로 호출한다
  Then Region 모드로 즉시 전환된다
  And 새 모드로 캡처가 계속된다
```
**Verification**: SPEC AC #6

### Scenario 7: CLI Vision Snapshot
```gherkin
Scenario: CLI로 단발 스냅샷을 캡처한다
  Given VIBE 데몬이 실행 중이다
  When "vibe vision snapshot --region 0,0,800,600" 명령을 실행한다
  Then 지정 영역의 스냅샷이 캡처된다
  And 파일 경로가 출력된다
```
**Verification**: SPEC AC #7

### Scenario 8: 10분 비활성 자동 종료
```gherkin
Scenario: 10분 비활성 시 Vision 세션이 자동 종료된다
  Given Vision 세션이 활성 상태이다
  When 10분간 사용자 상호작용이 없다
  Then 세션이 자동 종료된다
  And 리소스가 해제된다
```
**Verification**: SPEC AC (Timeout)

### Scenario 9: 캡처 실패 시 JSON 에러 반환
```gherkin
Scenario: 캡처 권한 거부 시 JSON 에러를 반환한다
  Given 사용자가 화면 캡처 권한을 거부한다
  When core_vision_start 도구를 호출한다
  Then JSON 에러가 반환된다: { error: "CAPTURE_PERMISSION_DENIED" }
  And 크래시 없이 세션이 idle 상태로 복귀한다
```
**Verification**: SPEC AC (Error Handling)

### Scenario 10: Gemini WebSocket 재연결
```gherkin
Scenario: Gemini WebSocket 연결이 끊기면 자동 재연결한다
  Given Vision 세션이 스트리밍 중이다
  When Gemini WebSocket 연결이 끊긴다
  Then 3회 재연결을 시도한다 (2s → 4s → 8s backoff)
  And 재연결 성공 시 스트리밍이 재개된다
  And 3회 모두 실패 시 세션이 종료되고 에러 메시지가 반환된다
```
**Verification**: SPEC AC (Error Handling + Reconnection)

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | Full Screen 캡처 | ✅ |
| 2 | Region 캡처 | ✅ |
| 3 | Window 캡처 | ✅ |
| 4 | 적응형 샘플링 | ✅ |
| 5 | Gemini Live 스트리밍 | ✅ |
| 6 | 모드 실시간 전환 | ✅ |
| 7 | CLI Snapshot | ✅ |
| 8 | 자동 종료 | ✅ |
| 9 | 캡처 실패 에러 | ✅ |
| 10 | WebSocket 재연결 | ✅ |
