---
status: pending
phase: 3
---

# SPEC: pc-control — Phase 3: Voice Pipeline (입력 + 출력)

## Persona
<role>
음성 I/O 파이프라인 전문가. PWA 마이크 직접 입력, WebRTC, TTS 출력을 구현하여 "통화하듯 개발"하는 양방향 음성 대화를 가능하게 한다.
</role>

## Context
<context>

### Background
- VIBE: Telegram 음성 메시지 STT (llm-orchestrate.js) 구현됨
- VIBE: `@google-cloud/text-to-speech` 설치됐으나 미사용
- **Gap 1**: Telegram 외 직접 마이크 입력 없음 (PWA, 데스크톱)
- **Gap 2**: TTS 연결 안 됨 (설치만)
- **Goal**: 텔레그램 + PWA + 데스크톱 마이크 → STT → AI → TTS → 음성 응답

### Tech Stack
- Web Speech API / WebRTC (브라우저 마이크)
- Gemini Live Multimodal API (양방향 음성 WebSocket)
- OpenAI Whisper / Deepgram (STT 대안)
- Google Cloud TTS / Edge TTS / OpenAI TTS
- VAD: @ricky0123/vad-web (클라이언트), Silero (서버)

### Research Insights
- **GPT**: Push-to-talk 또는 VAD 기반 캡처, non-blocking TTS pipeline, streaming
- **Gemini**: Client-Side VAD (ONNX Silero in AudioWorklet), speculative TTS buffering (MediaSource API)
- **Kimi**: Audio context singleton + priority queuing, Web Locks API for multi-tab
- **Security**: 명시적 사용자 제스처 필수, 영구 녹음 표시기, 비활성 시 마이크 해제
</context>

## Task
<task>

### Phase 3-1: STT 멀티 프로바이더
1. [ ] `src/voice/STTProvider.ts` — STT 인터페이스 + 프로바이더 체인
   - Interface: `transcribe(audio: Buffer, mime: string): Promise<{ text: string }>`
   - Providers: Gemini → OpenAI Whisper → Deepgram → 로컬 CLI (우선순위)
   - 자동 fallback: 실패 시 다음 프로바이더
   - 설정 기반 프로바이더 선택 (`config.json`)
   - Verify: 각 프로바이더 테스트 (mock)

2. [ ] `src/voice/VADProcessor.ts` — Voice Activity Detection
   - 서버 사이드: Silero ONNX 모델
   - 오디오 스트림에서 음성 구간만 추출
   - 침묵 감지 → 발화 종료 이벤트
   - 설정: 침묵 임계값 (기본 300ms), 최소 발화 길이 (기본 500ms)
   - Verify: VAD 정확도 테스트

### Phase 3-2: TTS 연결
3. [ ] `src/voice/TTSProvider.ts` — TTS 인터페이스 + 프로바이더 체인
   - Interface: `synthesize(text: string, options): Promise<{ audioPath: string, format: string }>`
   - Providers: Edge TTS (무료) → OpenAI TTS → Google Cloud TTS
   - 포맷: Opus (Telegram), MP3 (웹), WAV (로컬)
   - 긴 텍스트 자동 청킹 (문장 단위 분할)
   - Streaming TTS: 문장 생성 즉시 오디오 스트리밍 시작
   - Verify: 각 프로바이더 테스트

4. [ ] `src/voice/TTSProvider.ts` — 기존 설치된 패키지 활성화
   - `@google-cloud/text-to-speech` → Google Cloud TTS 프로바이더로 연결
   - `node-edge-tts` → Edge TTS 프로바이더 (API 키 불필요)
   - Verify: 실제 음성 파일 생성 테스트

### Phase 3-3: PWA 마이크 입력 프로토콜
5. [ ] `src/voice/VoiceWebSocket.ts` — WebSocket 기반 음성 스트리밍
   - 클라이언트 → 서버: 오디오 청크 (binary WebSocket frames)
   - 서버 → 클라이언트: TTS 오디오 청크 + 텍스트 (JSON + binary)
   - 프로토콜:
     - `{ type: "audio_start", sampleRate, channels }` — 녹음 시작
     - Binary frames — 오디오 데이터
     - `{ type: "audio_end" }` — 발화 종료
     - `{ type: "transcript", text }` — STT 결과
     - `{ type: "response_start" }` → Binary TTS frames → `{ type: "response_end" }`
   - Verify: WebSocket 프로토콜 테스트

6. [ ] `src/voice/VoiceSession.ts` — 음성 대화 세션
   - 세션 생명주기: create → active → paused → ended
   - 인터럽트 지원: 사용자가 말하면 TTS 중단 (barge-in)
   - 히스토리 관리: 음성 대화 컨텍스트 유지
   - 타임아웃: 5분 비활성 → 자동 종료
   - Verify: 세션 상태 전이 테스트

### Phase 3-4: Telegram/Slack 음성 확장
7. [ ] 기존 Telegram STT 통합 — VoiceSession과 연결
   - Telegram 음성 메시지 → STTProvider → AI → TTSProvider → 음성 노트 응답
   - `auto` 모드: 사용자가 음성 보내면 음성으로 응답
   - Verify: Telegram 음성 왕복 테스트

### Phase 3-5: MCP Tool 등록
8. [ ] `src/tools/voice/index.ts` — MCP 도구
   - `core_voice_status`: 음성 세션 상태
   - `core_tts_speak`: 텍스트 → 음성 변환 (파일 생성)
   - `core_stt_transcribe`: 오디오 파일 → 텍스트 변환
   - Verify: MCP 등록 확인

### Phase 3-6: CLI
9. [ ] `src/cli/commands/voice.ts` — CLI 명령어
   - `vibe voice status`: 음성 프로바이더 상태
   - `vibe voice test-tts "text"`: TTS 테스트
   - `vibe voice test-stt <file>`: STT 테스트
   - Verify: CLI 실행 테스트

### Phase 3-7: 테스트
10. [ ] `src/voice/STTProvider.test.ts`
11. [ ] `src/voice/TTSProvider.test.ts`
12. [ ] `src/voice/VoiceSession.test.ts`
</task>

## Constraints
<constraints>
- 마이크 접근: 명시적 사용자 동작(버튼 클릭) 필수
- 녹음 중 영구 표시기 (UI 레벨)
- 비활성 탭 30초 → 마이크 자동 해제
- TTS/STT 에러 시 텍스트 폴백 (음성 실패해도 텍스트로 소통)
- 오디오 포맷: Opus (Telegram/Web), MP3 (범용), WAV (로컬)
- WebSocket 프레임: binary (오디오) + JSON (제어 메시지) 혼합
- [P1] WebSocket 프로토콜: `sessionId` + `seq` (단조 증가) + `timestamp` 헤더, ack/window size 흐름제어, out-of-order 재정렬
- [P1] 오디오/텍스트 산출물: 기본 미보존 (no-retention), 보존 시 at-rest 암호화 + TTL 24h, 사용자 즉시 삭제 API
- [P1] STT/TTS 프로바이더별 개별 타임아웃 (STT: 10초, TTS: 8초) + 전체 요청 버짓 (15초), circuit breaker 패턴
- [P2] PWA 오디오 캡처 시 `echoCancellation: true`, `noiseSuppression: true` 필수 (AEC)
- 함수 ≤30줄, 중첩 ≤3레벨
</constraints>

## Output Format
<output_format>

### Files to Create
- `src/voice/STTProvider.ts`
- `src/voice/TTSProvider.ts`
- `src/voice/VADProcessor.ts`
- `src/voice/VoiceWebSocket.ts`
- `src/voice/VoiceSession.ts`
- `src/voice/types.ts`
- `src/tools/voice/index.ts`
- `src/cli/commands/voice.ts`
- `src/voice/STTProvider.test.ts`
- `src/voice/TTSProvider.test.ts`
- `src/voice/VoiceSession.test.ts`

### Files to Modify
- `src/tools/index.ts` — voice 도구 export
- `src/bridge/telegram-bridge.ts` — TTS 응답 연결

### Verification Commands
- `pnpm test -- --grep voice`
- `pnpm build`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] STT: 오디오 파일 → 텍스트 변환 (3개+ 프로바이더 fallback)
- [ ] TTS: 텍스트 → 음성 파일 생성 (Edge TTS 무료 동작)
- [ ] WebSocket: PWA에서 실시간 오디오 스트리밍 수신
- [ ] VAD: 음성 구간 감지 + 침묵 시 발화 종료
- [ ] Barge-in: TTS 재생 중 사용자 발화 시 즉시 중단
- [ ] Telegram: 음성 메시지 → AI → 음성 노트 자동 응답
- [ ] `vibe voice test-tts/test-stt` CLI 동작
- [ ] STT 응답 ≤3초 (30초 이하 오디오), ≤10초 (5분 이하)
- [ ] TTS 첫 오디오 청크 ≤1초 (스트리밍 모드)
- [ ] WebSocket 오디오 프레임 크기 ≤16KB (binary)
- [ ] 최대 녹음 시간 5분 (자동 종료 + 알림)
- [ ] 동시 음성 세션: 로컬 1개, SaaS 사용자당 1개
- [ ] 모든 STT/TTS 프로바이더 실패 시 텍스트 폴백 (에러 메시지 포함)
- [ ] 모든 테스트 통과 + 빌드 성공
</acceptance>
