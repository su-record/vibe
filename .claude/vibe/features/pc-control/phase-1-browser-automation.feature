# Feature: pc-control — Phase 1: Browser Automation

**SPEC**: `.claude/vibe/specs/pc-control/phase-1-browser-automation.md`
**Master Feature**: `.claude/vibe/features/pc-control/_index.feature`

## User Story (Phase Scope)
**As a** VIBE 사용자
**I want** Playwright ARIA Snapshot 기반으로 브라우저를 자연어 명령으로 제어하도록
**So that** "Google에서 Node.js 22 릴리스 노트 검색해줘" 같은 명령을 Telegram/Slack에서 실행할 수 있다

## Scenarios

### Scenario 1: ARIA Snapshot 수집
```gherkin
Scenario: 브라우저 페이지의 ARIA 트리를 수집한다
  Given Playwright 브라우저가 "https://google.com"에 연결되어 있다
  When core_browser_snapshot 도구를 호출한다
  Then ARIA role 기반 트리가 반환된다
  And 각 인터랙티브 요소에 ref ID (e1, e2, ...) 가 할당된다
  And role, name, value 정보가 포함된다
```
**Verification**: SPEC AC #1

### Scenario 2: Ref 기반 클릭 액션
```gherkin
Scenario: ref ID로 요소를 클릭한다
  Given ARIA Snapshot에서 "검색" 버튼이 ref "e3"으로 식별되었다
  When core_browser_act 도구를 { action: "click", ref: "e3" } 으로 호출한다
  Then 해당 요소가 클릭된다
  And 페이지 상태가 변경된다
```
**Verification**: SPEC AC #2

### Scenario 3: Ref 기반 텍스트 입력
```gherkin
Scenario: ref ID로 텍스트를 입력한다
  Given ARIA Snapshot에서 검색 입력 필드가 ref "e1"으로 식별되었다
  When core_browser_act 도구를 { action: "type", ref: "e1", text: "Node.js 22" } 으로 호출한다
  Then 입력 필드에 "Node.js 22" 텍스트가 입력된다
```
**Verification**: SPEC AC #2

### Scenario 4: 페이지 네비게이션
```gherkin
Scenario: URL로 페이지를 이동한다
  Given 브라우저가 활성 상태이다
  When core_browser_navigate 도구를 { url: "https://github.com" } 으로 호출한다
  Then 브라우저가 해당 URL로 이동한다
  And 새 페이지의 ARIA Snapshot이 자동 갱신된다
```
**Verification**: SPEC AC #3

### Scenario 5: 스크린샷 캡처
```gherkin
Scenario: 현재 페이지 스크린샷을 캡처한다
  Given 브라우저가 "https://google.com"에 연결되어 있다
  When core_browser_screenshot 도구를 호출한다
  Then PNG 스크린샷이 반환된다
  And 파일 크기는 5MB 이하이다
```
**Verification**: SPEC AC #4

### Scenario 6: Ephemeral 브라우저 컨텍스트 (SaaS)
```gherkin
Scenario: SaaS 모드에서 사용자별 격리된 브라우저 컨텍스트를 생성한다
  Given SaaS 모드가 활성화되어 있다
  And 사용자 A와 사용자 B가 각각 브라우저를 요청한다
  When 각 사용자에게 BrowserContext가 생성된다
  Then 사용자 A의 쿠키/세션은 사용자 B에게 노출되지 않는다
  And 세션 종료 시 컨텍스트가 삭제된다
```
**Verification**: SPEC AC #5

### Scenario 7: CLI 브라우저 상태 확인
```gherkin
Scenario: CLI로 브라우저 상태를 확인한다
  Given VIBE 데몬이 실행 중이다
  When "vibe browser status" 명령을 실행한다
  Then 활성 브라우저 인스턴스 목록이 표시된다
```
**Verification**: SPEC AC #6

### Scenario 8: CDP 연결 실패 시 JSON 에러 반환
```gherkin
Scenario: CDP 연결이 실패하면 JSON 에러를 반환한다
  Given 브라우저가 종료된 상태이다
  When core_browser_snapshot 도구를 호출한다
  Then JSON 에러가 반환된다: { error: "CDP_CONNECTION_FAILED", retries: 3 }
  And 3회 재시도 (1s → 2s → 4s + jitter) 후 실패를 확인한다
  And 크래시 없이 정상적으로 에러를 처리한다
```
**Verification**: SPEC AC (Error Handling + Reconnection)

### Scenario 9: 브라우저 액션 타임아웃
```gherkin
Scenario: 브라우저 액션이 8초 내에 완료되지 않으면 타임아웃한다
  Given 브라우저가 느린 페이지에 연결되어 있다
  When core_browser_act 도구를 { action: "click", ref: "e1" } 으로 호출한다
  And 8초 내에 응답이 없다
  Then 타임아웃 JSON 에러가 반환된다: { error: "ACTION_TIMEOUT", timeout: 8000 }
```
**Verification**: SPEC AC (Performance)

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | ARIA Snapshot 수집 | ⬜ |
| 2 | Ref 기반 클릭 | ⬜ |
| 3 | Ref 기반 입력 | ⬜ |
| 4 | 페이지 네비게이션 | ⬜ |
| 5 | 스크린샷 캡처 | ⬜ |
| 6 | Ephemeral 컨텍스트 | ⬜ |
| 7 | CLI 상태 확인 | ⬜ |
| 8 | CDP 연결 실패 에러 | ⬜ |
| 9 | 액션 타임아웃 | ⬜ |
