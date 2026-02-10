# Feature: telegram-model-a - Phase 1: 코어 라우터 + 개발 라우트

**SPEC**: `.claude/vibe/specs/telegram-model-a/phase-1-core-dev.md`
**Master Feature**: `.claude/vibe/features/telegram-model-a/_index.feature`

## User Story (Phase Scope)

**As a** 개인 사용자
**I want** 텔레그램 메시지의 의도를 자동 분류하고, 개발 관련 요청은 Claude Code로 실행하기를
**So that** 텔레그램으로 코딩 작업을 원격 제어할 수 있다

## Scenarios

### Scenario 1: 의도 분류 - 명시적 명령

```gherkin
Scenario: 명시적 명령 접두사로 의도 분류
  Given 사용자가 텔레그램에서 메시지를 전송
  When 메시지가 "/dev vibe에서 테스트 만들어줘"
  Then IntentClassifier가 category를 "development"로 분류
  And confidence가 1.0
  And DevRoute.canHandle이 true를 반환
```
**Verification**: SPEC AC #1

### Scenario 2: 의도 분류 - 키워드 heuristic

```gherkin
Scenario: 키워드 기반 의도 분류 (한국어)
  Given 사용자가 "vibe 프로젝트 버그 수정해줘"를 전송
  When IntentClassifier가 키워드 분석 수행
  Then category가 "development"로 분류
  And confidence가 0.7 이상
```
**Verification**: SPEC AC #1

### Scenario 3: 의도 분류 - LLM fallback

```gherkin
Scenario: 모호한 메시지에 대한 LLM 분류
  Given 사용자가 "프로젝트 상태 확인해볼까"를 전송
  When 키워드 heuristic confidence가 0.7 미만
  Then SmartRouter를 통해 LLM 분류 실행
  And LLM 응답이 등록된 카테고리 목록에 포함되는지 검증
```
**Verification**: SPEC AC #1

### Scenario 4: 복합 의도 분해

```gherkin
Scenario: 2개 이상 카테고리 키워드 포함 시 복합 의도
  Given 사용자가 "검색해서 메일로 보내줘"를 전송
  When IntentClassifier가 분석
  Then category가 "composite"로 분류
  And subIntents에 research와 google이 포함
```
**Verification**: SPEC AC #1

### Scenario 5: 개발 라우트 - Claude Code 실행

```gherkin
Scenario: 텔레그램 → DevRoute → Claude Code 실행 → 완료 알림
  Given 사용자가 "vibe에서 테스트 파일 만들어줘"를 전송
  And IntentClassifier가 "development"로 분류
  When DevRoute가 실행
  Then RepoResolver가 "vibe" 별칭으로 프로젝트 경로 해결
  And DevSessionManager가 Claude Code 세션 생성
  And ClaudeCodeBridge에 프롬프트 전송
  And 완료 시 텔레그램에 결과 요약 전송
```
**Verification**: SPEC AC #2

### Scenario 6: Permission Request - 자동 승인 (읽기 전용)

```gherkin
Scenario: 읽기 전용 도구 permission_request 자동 승인
  Given Claude Code가 Read 도구 permission_request 발생
  When TelegramQABridge가 permission 처리
  Then 자동 승인 (텔레그램 전송 없이)
  And Claude Code에 승인 응답 전송
```
**Verification**: SPEC AC #4

### Scenario 7: Permission Request - 수동 승인

```gherkin
Scenario: 위험 도구 permission_request → 텔레그램 인라인 키보드
  Given Claude Code가 Edit 도구 permission_request 발생
  When TelegramQABridge가 permission 처리
  Then 텔레그램에 인라인 키보드 전송 (승인/거부)
  And 사용자가 "승인" 버튼 클릭
  Then Claude Code에 승인 응답 전송
```
**Verification**: SPEC AC #3

### Scenario 8: Permission Request - 60초 타임아웃

```gherkin
Scenario: 60초 이내 응답 없으면 AI 자동 진행
  Given Claude Code가 Write 도구 permission_request 발생
  And 텔레그램에 인라인 키보드 전송
  When 60초 동안 사용자 응답 없음
  Then LLM으로 최적 응답 생성
  And 자동 진행
  And 텔레그램에 "자동 진행됨" 알림
```
**Verification**: SPEC AC #3

### Scenario 9: 세션 재사용

```gherkin
Scenario: 같은 chatId + projectPath면 기존 세션 재사용
  Given 사용자가 "vibe에서 파일 수정해줘"를 전송하여 세션 A 생성
  When 같은 chatId로 "vibe에서 테스트 추가해줘"를 전송
  Then DevSessionManager가 기존 세션 A 재사용 (새 세션 생성 안함)
  And ClaudeCodeBridge가 resume으로 연결
```
**Verification**: SPEC AC #5

### Scenario 10: 진행 알림 - 10초 간격 제한

```gherkin
Scenario: 진행 알림은 최소 10초 간격
  Given DevRoute가 실행 중이고 진행 알림 전송됨
  When 3초 후 다음 진행 업데이트 발생
  Then 알림이 전송되지 않음 (10초 미도달)
  When 10초 후 다음 진행 업데이트 발생
  Then 알림 전송됨
```
**Verification**: SPEC AC #6

### Scenario 11: 방해금지 시간

```gherkin
Scenario: 23:00~07:00에는 일반 알림 미전송
  Given 현재 시간이 23:30
  When 일반 진행 알림 발생
  Then 텔레그램에 전송되지 않음
```
**Verification**: SPEC AC #6

### Scenario 12: 중복 메시지 방지

```gherkin
Scenario: 동일 update_id 메시지 중복 처리 방지
  Given Telegram update_id 12345 메시지가 처리됨
  When 동일 update_id 12345 메시지가 다시 수신
  Then 무시됨 (처리하지 않음)
```
**Verification**: SPEC AC #8

### Scenario 13: Git 작업 보안

```gherkin
Scenario: Git 작업은 spawn args array 사용
  Given DevRoute에서 git commit 작업 요청
  When GitOpsHandler가 실행
  Then spawn('git', ['commit', '-m', message]) 형태로 실행 (shell 사용 안함)
  And 명령어 인젝션 불가
```
**Verification**: SPEC AC #7

### Scenario 14: 크로스 플랫폼 경로 처리

```gherkin
Scenario: Windows/macOS 경로 모두 정상 동작
  Given RepoResolver 설정에 "C:\\Users\\endba\\WorkSpace\\vibe" 등록
  When Windows에서 경로 해결 요청
  Then path.resolve로 정규화된 경로 반환
  And macOS에서도 동일하게 동작
```
**Verification**: SPEC AC #11

### Scenario 15: Conversation 카테고리 - LLM 직접 응답

```gherkin
Scenario: 일반 대화 → LLM 직접 응답 (라우트 없이)
  Given 사용자가 "안녕, 오늘 날씨 어때?"를 전송
  When IntentClassifier가 "conversation"으로 분류
  Then ModelARouter가 SmartRouter.route({ type: 'general' })로 직접 응답 생성
  And 텔레그램에 응답 전송 (3초 이내)
  And 라우트 실행 없이 완료
```
**Verification**: SPEC AC #1

### Scenario 16: 네트워크 에러 처리

```gherkin
Scenario: 외부 API 호출 실패 시 재시도 후 에러 메시지
  Given DevRoute가 ClaudeCodeBridge를 통해 실행 중
  When 네트워크 에러 발생 (ECONNREFUSED)
  Then BaseRoute가 3회 재시도 (1s, 2s, 4s exponential backoff)
  And 3회 모두 실패 시 텔레그램에 "네트워크 연결 실패. 잠시 후 다시 시도해주세요." 전송
```
**Verification**: SPEC AC #2

### Scenario 17: LLM 분류 실패 fallback

```gherkin
Scenario: LLM 의도 분류 실패 시 conversation fallback
  Given 사용자가 모호한 메시지를 전송
  When 키워드 heuristic confidence < 0.7
  And SmartRouter LLM 분류도 실패 (에러 또는 유효하지 않은 카테고리)
  Then conversation fallback으로 처리
  And SmartRouter로 일반 대화 응답 생성
```
**Verification**: SPEC AC #1

## Coverage

| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 |  |
| 2 | AC-1 |  |
| 3 | AC-1 |  |
| 4 | AC-1 |  |
| 5 | AC-2 |  |
| 6 | AC-4 |  |
| 7 | AC-3 |  |
| 8 | AC-3 |  |
| 9 | AC-5 |  |
| 10 | AC-6 |  |
| 11 | AC-6 |  |
| 12 | AC-8 |  |
| 13 | AC-7 |  |
| 14 | AC-11 |  |
| 15 | AC-1 |  |
| 16 | AC-2 |  |
| 17 | AC-1 |  |
