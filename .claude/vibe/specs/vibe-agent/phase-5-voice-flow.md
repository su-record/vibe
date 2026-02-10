---
status: pending
phase: 5
title: Voice Flow Integration
---

# SPEC: vibe-agent - Phase 5: Voice Flow Integration

## Persona
<role>
Senior TypeScript developer specializing in voice interface integration.
- Telegram Bot voice message 처리 경험
- Gemini STT API 활용 경험
- 기존 voice transcription 파이프라인에 정통
</role>

## Context
<context>
### Background
현재 ModelARouter에 voice transcription 로직이 있다. 이를 Agent 아키텍처와 통합하여 음성 → 텍스트 → 에이전트 처리 → 응답 플로우를 구현한다.

### Target Flow
```
Telegram 음성 메시지
  ↓
AgentLoop: voice 감지 → gemini_stt tool 자동 호출
  ↓
Gemini STT: 음성 → 텍스트
  ↓
AgentLoop: 변환된 텍스트로 HeadModel 재호출
  ↓
HeadModel: function calling으로 적절한 tool 선택
  ↓
Response → Telegram
```

### Related Code
- `src/router/ModelARouter.ts`: 기존 voice transcription 전처리
- `src/lib/gemini/capabilities.ts`: `transcribeAudio()` 함수
- `src/agent/tools/gemini-stt.ts`: Phase 3에서 정의한 STT tool
</context>

## Task
<task>
### Phase 5-1: Voice 전처리 통합
1. [ ] `src/agent/AgentLoop.ts` 수정
   - ExternalMessage.type === 'voice' 감지
   - 자동으로 gemini_stt tool 호출 (HeadModel 거치지 않고 직접)
   - 변환된 텍스트를 원본 메시지에 첨부
   - 텍스트 변환 후 정상 AgentLoop 흐름 진입
   - File: `src/agent/AgentLoop.ts`

### Phase 5-2: Voice Confirmation
1. [ ] Voice 변환 결과 확인 메시지
   - "음성 인식 결과: {transcribed text}" 전송 (사용자 확인용)
   - 인식 실패 시: "음성을 인식하지 못했습니다. 다시 시도해주세요."
   - File: `src/agent/AgentLoop.ts`

### Phase 5-3: File/Image 전처리
1. [ ] `src/agent/preprocessors/MediaPreprocessor.ts` 생성
   - voice → gemini_stt 자동 호출
   - image → 이미지 설명 텍스트로 변환 (Gemini analyzeUI 활용)
   - file → 파일 메타데이터 추출
   - File: `src/agent/preprocessors/MediaPreprocessor.ts`
</task>

## Constraints
<constraints>
- Voice 변환은 HeadModel 호출 전에 처리 (latency 절약)
- 음성 파일 최대 크기: 20MB (Telegram 제한)
- STT 실패 시 사용자에게 재시도 안내
- 변환된 텍스트 확인 메시지는 선택적 (config로 비활성화 가능)
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/agent/preprocessors/MediaPreprocessor.ts`

### Files to Modify
- `src/agent/AgentLoop.ts` (voice/media 전처리 통합)

### Verification Commands
- `npm run build`
- `npm test`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: 음성 메시지가 자동으로 텍스트로 변환된다
- [ ] AC-2: 변환된 텍스트로 AgentLoop이 정상 처리한다
- [ ] AC-3: 음성 인식 결과 확인 메시지가 전송된다
- [ ] AC-4: STT 실패 시 사용자에게 재시도 안내가 전송된다
- [ ] AC-5: 이미지 메시지가 설명 텍스트로 변환된다
- [ ] AC-6: 음성 파일 20MB 초과 시 에러 처리된다
- [ ] AC-7: 빌드 성공 (`npm run build`)
</acceptance>
