# Feature: pc-control — Phase 3: Voice Pipeline

**SPEC**: `.claude/vibe/specs/pc-control/phase-3-voice-pipeline.md`
**Master Feature**: `.claude/vibe/features/pc-control/_index.feature`

## User Story (Phase Scope)
**As a** VIBE 사용자
**I want** PWA/데스크톱 마이크 또는 Telegram 음성으로 AI와 양방향 음성 대화를 하도록
**So that** "통화하듯" 코드 리뷰, 디버깅, 작업 지시를 음성으로 수행할 수 있다

## Scenarios

### Scenario 1: STT 멀티 프로바이더 Fallback
```gherkin
Scenario: STT 프로바이더가 순차적으로 fallback된다
  Given Gemini STT가 비활성화 상태이다
  And OpenAI Whisper API 키가 설정되어 있다
  When 오디오 파일로 STT를 요청한다
  Then Gemini 실패 → OpenAI Whisper로 자동 전환된다
  And 텍스트 변환 결과가 반환된다
```
**Verification**: SPEC AC #1

### Scenario 2: TTS 음성 파일 생성
```gherkin
Scenario: 텍스트를 음성 파일로 변환한다
  Given Edge TTS가 활성화되어 있다 (API 키 불필요)
  When core_tts_speak 도구를 { text: "빌드 성공했습니다" } 으로 호출한다
  Then 음성 파일이 생성된다
  And 포맷은 요청 채널에 맞게 변환된다 (Telegram→Opus, Web→MP3)
```
**Verification**: SPEC AC #2

### Scenario 3: WebSocket 실시간 오디오 스트리밍
```gherkin
Scenario: PWA에서 실시간 오디오를 WebSocket으로 전송한다
  Given PWA 클라이언트가 WebSocket에 연결되어 있다
  When 사용자가 마이크 버튼을 누르고 말한다
  Then { type: "audio_start", sampleRate: 16000, channels: 1 } 메시지가 전송된다
  And Binary 프레임으로 오디오 데이터가 스트리밍된다
  And 발화 종료 시 { type: "audio_end" } 메시지가 전송된다
```
**Verification**: SPEC AC #3

### Scenario 4: VAD 음성 구간 감지
```gherkin
Scenario: 오디오 스트림에서 음성 구간을 감지한다
  Given VAD 프로세서가 활성화되어 있다
  When 오디오 스트림에 3초 음성 + 500ms 침묵이 포함된다
  Then 음성 구간(3초)만 추출된다
  And 침묵 300ms 이상 시 발화 종료 이벤트가 발생한다
```
**Verification**: SPEC AC #4

### Scenario 5: Barge-in (TTS 중단)
```gherkin
Scenario: TTS 재생 중 사용자가 말하면 즉시 중단된다
  Given AI가 TTS로 응답을 재생하고 있다
  When 사용자가 새로운 발화를 시작한다
  Then TTS 재생이 즉시 중단된다
  And 새 발화가 STT로 처리된다
```
**Verification**: SPEC AC #5

### Scenario 6: Telegram 음성 왕복
```gherkin
Scenario: Telegram 음성 메시지 → AI → 음성 노트 응답
  Given Telegram 봇이 활성화되어 있다
  When 사용자가 음성 메시지를 보낸다
  Then 음성이 STT로 변환된다
  And AI가 응답을 생성한다
  And TTS로 변환된 음성 노트가 자동 응답된다
```
**Verification**: SPEC AC #6

### Scenario 7: CLI TTS 테스트
```gherkin
Scenario: CLI로 TTS를 테스트한다
  Given VIBE가 설치되어 있다
  When "vibe voice test-tts '빌드 완료'" 명령을 실행한다
  Then 음성 파일이 생성되고 경로가 출력된다
```
**Verification**: SPEC AC #7

### Scenario 8: TTS 실패 시 텍스트 폴백
```gherkin
Scenario: TTS 실패 시 텍스트로 응답한다
  Given 모든 TTS 프로바이더가 비활성화 상태이다
  When AI 응답을 음성으로 변환하려 한다
  Then TTS 실패 에러가 발생한다
  And 텍스트 형태로 응답이 전달된다 (음성 실패해도 소통 유지)
```
**Verification**: SPEC AC (Error Handling)

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | STT Fallback | ✅ |
| 2 | TTS 생성 | ✅ |
| 3 | WebSocket 스트리밍 | ✅ |
| 4 | VAD 음성 감지 | ✅ |
| 5 | Barge-in | ✅ |
| 6 | Telegram 음성 왕복 | ✅ |
| 7 | CLI TTS 테스트 | ✅ |
| 8 | TTS 폴백 | ✅ |
