# Feature: core-infra - Phase 2: Vision (Gemini Live)

**SPEC**: `.claude/vibe/specs/core-infra/phase-2-vision.md`
**Master Feature**: `.claude/vibe/features/core-infra/_index.feature`

## User Story (Phase Scope)
**As a** VIBE 사용자
**I want** 화면을 캡처하고 AI로 분석
**So that** 코드 리뷰, UI 분석, 에러 화면 해석 등을 에이전트에게 맡길 수 있다

## Scenarios

### Scenario 1: 전체 화면 캡처 및 분석
```gherkin
Scenario: 전체 화면 캡처 → Gemini 분석
  Given macOS/Windows/Linux 환경
  When vision_capture tool 호출 { area: "full", prompt: "이 화면에서 에러를 찾아줘" }
  Then 화면이 PNG로 캡처된다
  And Gemini API로 이미지가 전송된다
  And 분석 결과 텍스트가 반환된다
```
**Verification**: SPEC AC #1, #4

### Scenario 2: 영역 캡처
```gherkin
Scenario: 특정 영역만 캡처
  Given 캡처 가능한 환경
  When vision_capture { area: "region", region: {x: 0, y: 0, w: 800, h: 600}, prompt: "이 부분 분석" }
  Then 지정 영역만 캡처된다
  And 분석 결과가 반환된다
```
**Verification**: SPEC AC #2

### Scenario 3: 고해상도 자동 리사이즈
```gherkin
Scenario: 4K 화면 캡처 시 리사이즈
  Given 3840x2160 해상도 화면
  When 전체 화면 캡처
  Then 1920x1080 이하로 리사이즈된다
  And 이미지 크기가 4MB 이하
```
**Verification**: SPEC AC #3, #12

### Scenario 4: 파일 이미지 분석
```gherkin
Scenario: 로컬 이미지 파일 분석
  Given 로컬에 screenshot.png 파일 존재
  When vision_analyze { imagePath: "screenshot.png", prompt: "UI 레이아웃 분석" }
  Then Gemini로 이미지가 전송된다
  And 분석 결과가 반환된다
```
**Verification**: SPEC AC #9

### Scenario 5: Live 세션 재연결
```gherkin
Scenario: Gemini Live 연결 끊김 시 재연결
  Given Gemini Live 세션이 활성화 상태
  When 네트워크 연결이 끊김
  Then 지수 백오프로 재연결 시도 (1s, 2s, 4s)
  And 최대 3회 시도
  And 3회 실패 시 에러 보고
```
**Verification**: SPEC AC #7

### Scenario 6: API rate limit 준수
```gherkin
Scenario: 빠른 연속 캡처 시 rate limit
  Given 캡처 간격 1초 미만 요청
  When vision_capture 0.5초 간격으로 3회 호출
  Then 첫 번째만 즉시 실행
  And 나머지는 1초 간격으로 큐잉되어 실행
```
**Verification**: SPEC AC #11

### Scenario 7: Gemini API 실패 처리
```gherkin
Scenario: Gemini API 호출 실패 시 에러 반환
  Given Gemini API가 500 Internal Server Error 응답
  When vision_capture tool 호출
  Then 3회 재시도 (1s, 2s, 4s 지수 백오프)
  And 3회 모두 실패 시 "Gemini API 호출에 실패했습니다" 에러 메시지 반환
```
**Verification**: SPEC Constraints (Gemini API 실패 처리)

### Scenario 8: VisionInterface 이미지 push
```gherkin
Scenario: 외부 이미지 push → 분석 결과 전달
  Given VisionInterface가 활성화 상태
  When 외부 클라이언트가 PNG 이미지를 push
  Then Gemini로 분석 실행
  And 분석 결과가 ExternalMessage로 변환되어 AgentLoop에 전달
```
**Verification**: SPEC AC #10

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1, AC-4: 캡처 + 분석 | ⬜ |
| 2 | AC-2: 영역 캡처 | ⬜ |
| 3 | AC-3, AC-12: 리사이즈 | ⬜ |
| 4 | AC-9: 파일 이미지 분석 | ⬜ |
| 5 | AC-7: 재연결 | ⬜ |
| 6 | AC-11: rate limit | ⬜ |
| 7 | Constraints: Gemini API 실패 | ⬜ |
| 8 | AC-10: VisionInterface push | ⬜ |
