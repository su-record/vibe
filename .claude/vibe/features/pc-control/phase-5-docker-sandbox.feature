# Feature: pc-control — Phase 5: Docker Sandbox

**SPEC**: `.claude/vibe/specs/pc-control/phase-5-docker-sandbox.md`
**Master Feature**: `.claude/vibe/features/pc-control/_index.feature`

## User Story (Phase Scope)
**As a** SaaS 운영자
**I want** 사용자별 Docker 컨테이너로 브라우저/코드 실행을 격리하도록
**So that** 사용자 A의 명령이 사용자 B 환경에 영향을 주지 않는 안전한 멀티테넌트 환경을 제공할 수 있다

## Scenarios

### Scenario 1: 사용자별 컨테이너 생성
```gherkin
Scenario: 사용자별 Docker 컨테이너를 생성한다
  Given Docker 데몬이 실행 중이다
  When 사용자 "user-123"에 대해 컨테이너 생성을 요청한다
  Then 전용 컨테이너가 생성된다
  And rootless 모드로 실행된다
  And 리소스 제한이 적용된다 (CPU 0.5, Memory 512MB, PID 100)
```
**Verification**: SPEC AC #1

### Scenario 2: 컨테이너 내 명령 실행
```gherkin
Scenario: 컨테이너 내에서 명령을 실행한다
  Given 사용자의 컨테이너가 실행 중이다
  When core_sandbox_exec 도구를 { command: "node --version" } 으로 호출한다
  Then 컨테이너 내부에서 명령이 실행된다
  And 실행 결과가 반환된다
  And 호스트 파일시스템에 접근되지 않는다
```
**Verification**: SPEC AC #2

### Scenario 3: 샌드박스 브라우저 CDP 연결
```gherkin
Scenario: 컨테이너 내 Chromium에 CDP로 연결한다
  Given 샌드박스 브라우저 컨테이너가 실행 중이다
  And CDP 포트 9222가 매핑되어 있다
  When BrowserService가 CDP로 연결한다
  Then 컨테이너 내 Chromium이 제어된다
  And 브라우저 데이터가 사용자별 격리된다
```
**Verification**: SPEC AC #3

### Scenario 4: 6단계 Tool Policy 체인
```gherkin
Scenario: 도구 실행 시 6단계 정책을 평가한다
  Given Profile 정책에서 `group:browser`가 허용되어 있다
  And Sandbox 정책에서 `core_browser_*`만 허용되어 있다
  When 사용자가 "core_browser_snapshot" 도구를 요청한다
  Then 6단계 체인이 순서대로 평가된다 (Profile → Global → User → Channel → Sandbox → SubAgent)
  And 모든 단계를 통과하면 실행이 허용된다
```
**Verification**: SPEC AC #4

### Scenario 5: Exec Allowlist 패턴 매칭
```gherkin
Scenario: 안전한 명령만 허용한다
  Given Allowlist에 "git", "node", "npm", "pnpm"이 등록되어 있다
  When "git status" 명령을 실행 요청한다
  Then 패턴 매칭으로 허용된다
  When "rm -rf /" 명령을 실행 요청한다
  Then 차단되고 "허용되지 않는 명령" 메시지가 반환된다
```
**Verification**: SPEC AC #5

### Scenario 6: 위험 명령 승인 요청
```gherkin
Scenario: 미등록 명령 실행 시 Telegram/Slack으로 승인을 요청한다
  Given "curl https://example.com" 명령이 Allowlist에 없다
  When 해당 명령 실행을 요청한다
  Then Telegram/Slack으로 인라인 버튼 (허용/거부) 메시지가 전송된다
  And 사용자가 "허용"을 누르면 실행된다
  And "allow-always" 선택 시 패턴이 Allowlist에 추가된다
```
**Verification**: SPEC AC #5 (Approval)

### Scenario 7: Read-only FS + Seccomp 적용
```gherkin
Scenario: 컨테이너에 보안 설정이 적용된다
  Given 새 컨테이너가 생성된다
  When 보안 설정을 검증한다
  Then 루트 파일시스템이 read-only이다
  And /tmp, /workspace만 tmpfs로 쓰기 가능하다
  And Seccomp 프로필이 적용된다 (io_uring 비활성)
  And 모든 capabilities가 dropped되고 필요한 것만 추가된다
```
**Verification**: SPEC AC #7

### Scenario 8: 비활성 30분 자동 정리
```gherkin
Scenario: 30분 비활성 컨테이너가 자동 삭제된다
  Given 사용자의 컨테이너가 30분간 미사용 상태이다
  When Auto-cleanup 주기가 실행된다
  Then 비활성 컨테이너가 자동 중지 및 삭제된다
  And 관련 리소스가 해제된다
```
**Verification**: SPEC AC #8

### Scenario 9: CLI Sandbox 상태/정리
```gherkin
Scenario: CLI로 샌드박스 상태를 확인하고 정리한다
  Given VIBE 데몬이 실행 중이다
  When "vibe sandbox status" 명령을 실행한다
  Then 활성 컨테이너 목록이 표시된다
  When "vibe sandbox cleanup" 명령을 실행한다
  Then 비활성 컨테이너가 정리된다
```
**Verification**: SPEC AC #9

### Scenario 10: Docker 데몬 미실행 시 에러
```gherkin
Scenario: Docker 데몬이 실행되지 않은 경우 명확한 에러를 반환한다
  Given Docker 데몬이 실행되지 않은 상태이다
  When 컨테이너 생성을 요청한다
  Then "Docker 데몬이 실행되지 않습니다. 'docker start' 또는 Docker Desktop을 실행해주세요" 에러가 반환된다
  And 데몬 상태를 확인할 수 있는 안내가 포함된다
```
**Verification**: SPEC AC (Error Handling)

### Scenario 11: Exec 명령 30초 타임아웃
```gherkin
Scenario: 컨테이너 내 명령이 30초 초과 시 타임아웃한다
  Given 사용자의 컨테이너가 실행 중이다
  When core_sandbox_exec 도구를 { command: "sleep 60" } 으로 호출한다
  Then 30초 후 타임아웃이 발생한다
  And "명령 실행 시간이 30초를 초과했습니다" 메시지가 반환된다
```
**Verification**: SPEC AC (Performance)

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | 사용자별 컨테이너 생성 | ✅ |
| 2 | 컨테이너 내 명령 실행 | ✅ |
| 3 | 샌드박스 브라우저 CDP | ✅ |
| 4 | 6단계 Tool Policy | ✅ |
| 5 | Exec Allowlist | ✅ |
| 6 | 위험 명령 승인 | ✅ |
| 7 | 보안 설정 | ✅ |
| 8 | 자동 정리 | ✅ |
| 9 | CLI 상태/정리 | ✅ |
| 10 | Docker 미실행 에러 | ✅ |
| 11 | Exec 타임아웃 | ✅ |
