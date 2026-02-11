---
status: pending
phase: 2
parent: _index.md
---

# SPEC: Phase 2 — File Attachment Support

## Persona
<role>
멀티채널 인터페이스 전문가. Telegram/Slack의 파일 다운로드를 통합하고, MediaPreprocessor 파이프라인을 확장한다.
소놀봇의 `download_file()` + `fetch_new_messages()` 패턴을 TypeScript로 재설계한다.
</role>

## Context
<context>
### Background
현재 Vibe는 Telegram에서 fileId만 metadata에 저장하고 MediaPreprocessor에서 다시 다운로드한다. Slack은 URL만 저장. 소놀봇은 메시지 수신 시 즉시 로컬(`tasks/msg_{id}/`)에 저장하고, 파일 메타데이터를 message_data에 포함한다. GPS 위치도 location_info로 처리한다.

### 소놀봇 참조 코드
- `telegram_listener.py:96-146` — `download_file()`: 타입별 prefix, task_dir 자동 생성
- `telegram_listener.py:149-326` — `fetch_new_messages()`: photo(가장 큰 것), document(원본명), video, audio, voice, location 처리
- `telegram_bot.py:726-839` — `combine_tasks()`: 📎 첨부파일 + 📍 위치정보 텍스트 생성

### 현재 Vibe 코드
- `src/interface/types.ts:14-23` — ExternalMessage (metadata에 파일 정보 비구조적)
- `src/interface/telegram/TelegramBot.ts:220-234` — document/photo/voice 처리 (fileId만 저장)
- `src/interface/slack/SlackBot.ts:432-459` — files.info API (URL만 저장, MAX_FILE_SIZE=10MB)
- `src/agent/preprocessors/MediaPreprocessor.ts` — voice→STT, image→Vision, 나머지→메타설명
- `src/daemon/InterfaceManager.ts:220-292` — voice 파일 다운로드+STT 파이프라인
</context>

## Task
<task>
### Phase 2-1: 타입 정의 (types.ts)
1. [ ] `FileAttachment` 인터페이스 정의
   - `type`: `'photo' | 'document' | 'video' | 'audio' | 'voice'`
   - `path`: string (로컬 저장 경로)
   - `name`: string (원본 파일명)
   - `mimeType?`: string
   - `size?`: number (바이트)
   - `duration?`: number (오디오/비디오 초)
2. [ ] `LocationInfo` 인터페이스 정의
   - `latitude`: number
   - `longitude`: number
   - `accuracy?`: number (미터)
3. [ ] `ExternalMessage`에 optional 필드 추가
   - `files?: FileAttachment[]`
   - `location?: LocationInfo`
   - File: `src/interface/types.ts`

### Phase 2-2: Telegram 파일 다운로드 강화
1. [ ] 메시지 수신 시 즉시 로컬 저장 (`~/.vibe/files/{channel}/{chatId}/msg_{id}/`)
2. [ ] photo: `msg.photo[-1]` (가장 큰 것) → `image_{id}.jpg`
3. [ ] document: 원본 파일명 유지
4. [ ] video: `video_{id}.{ext}`
5. [ ] audio: 원본 파일명 또는 `audio_{id}.{ext}`
6. [ ] voice: `voice_{id}.ogg`
7. [ ] location: `msg.location` → `LocationInfo` 변환
8. [ ] `ExternalMessage.files[]`와 `ExternalMessage.location`에 결과 저장
   - File: `src/interface/telegram/TelegramBot.ts`

### Phase 2-3: Slack 파일 다운로드 강화
1. [ ] `files.info` → `url_private` → 로컬 다운로드 (`~/.vibe/files/{channel}/{chatId}/msg_{id}/`)
2. [ ] 인증 헤더: `Authorization: Bearer {SLACK_BOT_TOKEN}`
3. [ ] MAX_FILE_SIZE(10MB) 초과 시 메타데이터만 저장 (경고 메시지)
4. [ ] `ExternalMessage.files[]`에 결과 저장
   - File: `src/interface/slack/SlackBot.ts`

### Phase 2-4: MediaPreprocessor 확장
1. [ ] `FileAttachment[]` 기반 전처리 파이프라인
   - voice/audio → Gemini STT (기존 로직 활용)
   - photo → Gemini Vision (기존 로직 활용)
   - video → 첫 프레임 추출 시도 → Gemini Vision (실패 시 메타설명)
   - document → 텍스트 추출 (txt/csv/json 직접 읽기, pdf/docx/xlsx 등 바이너리 포맷은 메타설명: `[파일: {name}, 크기: {size}KB, 형식: {mimeType}]`)
   - location → Google Maps 링크 텍스트 생성
2. [ ] 전처리 결과를 `ExternalMessage.content`에 자연어로 추가
   - File: `src/agent/preprocessors/MediaPreprocessor.ts`

### Phase 2-5: 파일 보관/정리 서비스
1. [ ] `FileRetentionService` 구현 (또는 MediaPreprocessor에 통합)
   - 전처리 완료 후 원본 파일 삭제 (전처리 결과는 메시지에 이미 포함)
   - `setInterval(10분)`: TTL 24시간 초과 파일 정리
   - 전역 500MB 쿼터 초과 시 가장 오래된 디렉토리부터 삭제
   - 데몬 시작 시 1회 정리 실행
   - File: `src/agent/preprocessors/MediaPreprocessor.ts` 또는 새 유틸리티
</task>

## Constraints
<constraints>
- ExternalMessage의 기존 `metadata` 필드는 유지 (하위 호환)
- 새로운 `files`, `location` 필드는 optional (기존 코드 영향 없음)
- 파일 저장 경로: `~/.vibe/files/{channel}/{chatId}/msg_{messageId}/` (채널/채팅별 네임스페이스로 충돌 방지)
- 파일 보관 정책: TTL 24시간, MediaPreprocessor 처리 완료 후 삭제 (디스크 소진 방지)
- 전역 디스크 쿼터: 최대 500MB, 초과 시 가장 오래된 파일부터 삭제
- 최대 파일 크기: Telegram 20MB, Slack 10MB
- 다운로드 실패 시 메타데이터만 저장 (에러로 전체 메시지 처리 중단 금지)
- Path traversal 방지: 파일명 sanitize (특수문자 제거, `..' 차단)
- 파일 다운로드 타임아웃: 30초/파일 (AbortController 사용)
- MIME 타입 검증: 확장자와 magic bytes 일치 확인 (불일치 시 경고 로그 + content extraction/변환 건너뜀 → 메타설명 fallback만 제공)
</constraints>

## Output Format
<output_format>
### Files to Modify
- `src/interface/types.ts` — FileAttachment, LocationInfo 타입 추가
- `src/interface/telegram/TelegramBot.ts` — 파일 다운로드 + 로컬 저장
- `src/interface/slack/SlackBot.ts` — 파일 다운로드 + 로컬 저장
- `src/agent/preprocessors/MediaPreprocessor.ts` — 통합 전처리 파이프라인

### Verification Commands
- `npx tsc --noEmit`
- `pnpm test -- --grep "MediaPreprocessor|TelegramBot|SlackBot"`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] FileAttachment, LocationInfo 타입이 types.ts에 정의됨
- [ ] ExternalMessage에 files?, location? optional 필드 존재
- [ ] Telegram에서 사진 전송 시 `~/.vibe/files/{channel}/{chatId}/msg_{id}/image_{id}.jpg`에 저장
- [ ] Telegram에서 문서 전송 시 원본 파일명으로 로컬 저장
- [ ] Telegram에서 위치 전송 시 LocationInfo로 변환
- [ ] Slack에서 파일 업로드 시 로컬 다운로드 + FileAttachment 생성
- [ ] MediaPreprocessor가 FileAttachment[] 기반으로 전처리
- [ ] 다운로드 실패 시 메시지 처리 중단되지 않음
- [ ] 파일명 sanitize (path traversal 방지)
- [ ] TypeScript 컴파일 성공
</acceptance>
