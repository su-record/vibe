# Feature: hook-dispatcher-inprocess

**SPEC**: `.vibe/specs/hook-dispatcher-inprocess.md`

## User Story
**As a** Claude Code 사용자
**I want** 훅 디스패처가 자식 프로세스 spawn 없이 in-process로 가드/후처리를 실행하기를
**So that** 모든 도구 호출의 훅 오버헤드(프로세스 10개 → 3개)가 줄면서도 deny 보호는 그대로 유지된다

## Scenarios

### Scenario 1: 위험 명령 deny 보존 (Happy Path — 보호 동작)
```gherkin
Scenario: dangerous Bash command is denied with exit 2
  Given pre-tool-dispatcher가 in-process 모드로 동작한다
  When stdin으로 {"tool_name":"Bash","tool_input":{"command":"rm -rf /"}} 페이로드와 함께 실행하면
  Then 디스패처의 exit code는 2이다
```
**Verification**: SPEC AC-1

### Scenario 2: sentinel 경로 보호 + block JSON 주입
```gherkin
Scenario: editing a sentinel file is blocked with context injection
  Given sentinel 경로는 src/infra/lib/autonomy/ 이다
  When stdin으로 {"tool_name":"Edit","tool_input":{"file_path":"src/infra/lib/autonomy/core.ts",...}} 와 함께 pre-tool-dispatcher를 실행하면
  Then exit code는 2이고
  And stdout에 {"decision":"block"} JSON이 포함된다
```
**Verification**: SPEC AC-2

### Scenario 3: 안전 입력 통과
```gherkin
Scenario: safe command passes through
  When stdin으로 {"tool_name":"Bash","tool_input":{"command":"ls -la"}} 와 함께 실행하면
  Then exit code는 0이다
```
**Verification**: SPEC AC-3

### Scenario 4: 크래시 격리 (Edge Case)
```gherkin
Scenario: a crashing step fails open without blocking the chain
  Given post-edit-dispatcher가 in-process 모드로 동작한다
  When stdin으로 JSON이 아닌 손상 페이로드("not-json")와 함께 실행하면
  Then exit code는 0이고 (fail-open)
  And 디스패처는 비정상 종료하지 않는다
```
**Verification**: SPEC AC-4

### Scenario 5: 독립 CLI 모드 보존 (Edge Case — Antigravity 경로)
```gherkin
Scenario: individual scripts still work as standalone CLIs
  Given antigravity-hooks.json은 sentinel-guard.js 를 직접 호출한다
  When node hooks/scripts/sentinel-guard.js Edit '{"file_path":"src/infra/lib/autonomy/x.ts"}' 로 직접 실행하면
  Then exit code는 2이다 (현행과 동일)
```
**Verification**: SPEC AC-6 (기존 CLI 테스트가 회귀 가드)

### Scenario 6: scope 미선언 시 no-op
```gherkin
Scenario: scope-guard is a no-op without scope.json
  Given 프로젝트에 scope.json이 없다
  When Edit 페이로드로 pre-tool-dispatcher를 실행하면
  Then scope-guard는 차단하지 않고 exit 0이다
```
**Verification**: SPEC AC-3

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 | ✅ |
| 2 | AC-2 | ✅ |
| 3 | AC-3 | ✅ |
| 4 | AC-4 | ✅ |
| 5 | AC-6 | ✅ |
| 6 | AC-3 | ✅ |
