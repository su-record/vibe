---
status: pending
phase: 7
parent: _index.md
---

# SPEC: Phase 7 — Response Text Style (12flow-write)

## Persona
<role>
UX/커뮤니케이션 전문가. 에이전트 응답 텍스트를 마크다운 없이, 이모지와 가독성 중심으로 변경한다.
12flow-write의 글쓰기 원칙(역피라미드, 색상 코드, 대화체)을 SystemPrompt에 적용한다.
</role>

## Context
<context>
### Background
현재 Vibe는 응답을 항상 Markdown 형식으로 전송한다 (AgentLoop: `format: 'markdown'`, TelegramBot: `parse_mode: 'Markdown'`). 사용자 요청: 마크다운 형식 X, 이모지 사용, 가독성 중심.

### 12flow-write 참조
- `c:/Users/endba/WorkSpace/12flow-write/` — 12단계 글쓰기 워크플로우
- step-09 (거장 첨삭): 🔴 중요/긴급, 🟡 참고, 🟢 완료 색상 코드
- 전체: 대화체 톤 ("작가님", "~해요"), 짧은 문장, 줄바꿈 적극 활용
- 역피라미드 구조: 핵심 먼저, 설명 나중에
- Before/After 비교 시 구체적 예시 사용

### 현재 Vibe 코드
- `src/agent/AgentLoop.ts:293` — `sendFn(chatId, content, { format: 'markdown' })` 하드코딩
- `src/agent/SystemPrompt.ts` — `buildSystemPrompt()` 채널 컨텍스트
- `src/interface/telegram/TelegramBot.ts:73-83` — `sendResponse()` parse_mode: 'Markdown'
- `src/interface/telegram/TelegramFormatter.ts` — 코드블록, 메시지 분할
- `src/interface/slack/SlackBot.ts:120-133` — mrkdwn 변환
- `src/interface/types.ts:25-32` — ExternalResponse format: 'text' | 'markdown' | 'html'
</context>

## Task
<task>
### Phase 7-1: SystemPrompt에 응답 스타일 가이드 추가
1. [ ] `buildSystemPrompt()`에 외부 채널용 스타일 가이드 섹션 추가:
   ```
   [응답 스타일 가이드]
   - 마크다운 문법 사용 금지 (**, ```, ## 등)
   - 이모지를 자연스럽게 활용하여 시각적 구분
   - 짧은 문장, 줄바꿈 적극 활용
   - 🔴 중요/긴급 🟡 참고 🟢 완료 색상 코드 활용
   - 번호 매기기 대신 이모지 불릿 사용
   - 대화체 (존댓말, "~해요" 스타일)
   - 핵심 먼저, 설명 나중에 (역피라미드 구조)
   - Before/After 비교 시 구체적 예시 사용
   ```
2. [ ] 채널이 외부(telegram/slack/web)일 때만 적용, CLI는 기존 유지
   - File: `src/agent/SystemPrompt.ts`

### Phase 7-2: AgentLoop format 변경 + 동적 마크다운 전환
1. [ ] `sendFn(chatId, content, { format: 'markdown' })` → config 기반 format
2. [ ] 외부 채널 기본값: `'text'`, CLI: `'markdown'`
3. [ ] **동적 format 전환**: `allowMarkdownForCode=true`이고 content에 triple backtick(```)이 포함된 경우, 해당 메시지만 `format: 'markdown'`으로 전송
   - 코드/에러 블록이 있는 메시지만 예외적 마크다운 허용
   - File: `src/agent/AgentLoop.ts`

### Phase 7-3: TelegramBot parse_mode 분기
1. [ ] `sendResponse()` 변경: format에 따라 parse_mode 분기
   - `'text'` → parse_mode 생략 (plain text)
   - `'markdown'` → parse_mode: 'Markdown'
   - `'html'` → parse_mode: 'HTML'
   - File: `src/interface/telegram/TelegramBot.ts`

### Phase 7-4: config.json responseStyle 소비 (스키마 정의는 Phase 8)
1. [ ] Phase 8에서 정의될 `responseStyle` config 인터페이스를 소비하는 코드 작성
   - 기본값 하드코딩: `{ format: 'text', useEmoji: true, tone: 'conversational' }`
   - Phase 8 완료 후 config에서 읽도록 전환
2. [ ] `allowMarkdownForCode: boolean` 플래그 추가 (에러 메시지 등 코드 블록 예외 처리)
   - 기본값: `true` (코드/에러 블록은 마크다운 허용)
   - File: `src/agent/AgentLoop.ts`
</task>

## Constraints
<constraints>
- CLI 채널은 기존 markdown 유지 (Claude Code 내부 사용)
- 외부 채널(telegram/slack/web)만 text 형식 + 이모지 스타일
- config.json의 responseStyle로 오버라이드 가능
- 코드 블록이 필요한 경우 (에러 메시지 등) 예외적으로 마크다운 허용
- Slack mrkdwn 변환 로직은 format='text'일 때 건너뜀
</constraints>

## Output Format
<output_format>
### Files to Modify
- `src/agent/SystemPrompt.ts` — 스타일 가이드 섹션 추가
- `src/agent/AgentLoop.ts` — format config 기반 분기
- `src/interface/telegram/TelegramBot.ts` — parse_mode 분기
- `src/interface/slack/SlackBot.ts` — mrkdwn 변환 조건부 건너뜀

### Verification Commands
- `npx tsc --noEmit`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] 외부 채널 응답에 구조적 마크다운(##, **, - 리스트)이 없음 (코드 블록 제외)
- [ ] 코드 블록 포함 메시지는 자동으로 format='markdown'으로 전환됨
- [ ] SystemPrompt에 스타일 가이드가 외부 채널에만 적용됨 (검증: 프롬프트 내 `[응답 스타일 가이드]` 존재 여부)
- [ ] Telegram sendResponse()에서 format='text'일 때 parse_mode 파라미터 미전송
- [ ] CLI 채널은 기존 markdown 유지 (format='markdown')
- [ ] config.json responseStyle.format 오버라이드 동작 확인
- [ ] TypeScript 컴파일 성공
</acceptance>
