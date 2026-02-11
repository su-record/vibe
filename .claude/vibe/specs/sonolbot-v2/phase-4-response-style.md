---
status: pending
phase: 4
parent: _index.md
---

# SPEC: Phase 4 — Response Style (External Channel)

## Persona
<role>
UX 전문가. 외부 채널(Telegram/Slack/Web) 응답을 가독성 + 이모지 중심으로 전환한다.
12flow-write 원칙 적용: 역피라미드, 색상 코드, 대화체.
</role>

## Context
<context>
### Background
AgentLoop에 `resolveFormat()` + `ResponseStyleConfig` + TelegramBot `parseModeMap`이 이미 구현되어 있다.
format 동적 전환(4-2)과 parse_mode 분기(4-3)는 구현 완료 상태.
**미구현**: SystemPrompt 스타일 가이드(4-1)와 Bridge 채널 설정 연결(4-4).

### Already Implemented (건드리지 않음)
- `src/agent/AgentLoop.ts:86-97` — `resolveFormat()` (채널/코드블록 기반 동적 format 전환)
- `src/agent/AgentLoop.ts:72-84` — `ResponseStyleConfig` 인터페이스
- `src/interface/telegram/TelegramBot.ts:83-88` — `parseModeMap` (text/markdown/html 분기)

### Related Code (수정 대상)
- `src/agent/SystemPrompt.ts` — buildSystemPrompt() (스타일 가이드 미적용)
- `src/bridge/telegram-assistant-bridge.ts` — 채널 정보 미전달
- `src/interface/types.ts:50-57` — ExternalResponse format
</context>

## Task
<task>
### Phase 4-1: SystemPrompt 스타일 가이드
1. [ ] buildSystemPrompt()에 외부 채널용 스타일 가이드 추가:
   - 마크다운 문법 최소 사용
   - 이모지로 시각적 구분
   - 짧은 문장 + 줄바꿈
   - 🔴 중요 🟡 참고 🟢 완료 색상 코드
   - 존댓말, 역피라미드
2. [ ] 외부 채널(telegram/slack/web)일 때만 적용
   - SystemPromptConfig에 `channel?: string` 추가
   - File: `src/agent/SystemPrompt.ts`

### ~~Phase 4-2: AgentLoop format 동적 전환~~ (이미 구현됨 — SKIP)
> `resolveFormat()` + `ResponseStyleConfig`가 이미 존재. 추가 작업 불필요.

### ~~Phase 4-3: TelegramBot parse_mode 분기~~ (이미 구현됨 — SKIP)
> `parseModeMap`이 이미 text/markdown/html 분기 처리 중. 추가 작업 불필요.

### Phase 4-2: Bridge 채널 정보 전달 (구 4-4)
1. [ ] `systemPromptConfig.channel = 'telegram'` 설정
2. [ ] 기존 `resolveFormat()` + `ResponseStyleConfig`에 연결 확인
   - File: `src/bridge/telegram-assistant-bridge.ts`
</task>

## Constraints
<constraints>
- CLI 채널은 기존 markdown 유지
- 외부 채널만 text + 이모지
- 코드 블록 포함 응답은 자동 markdown 전환
- GPT 헤드에게 스타일 가이드 "지시"이므로 100% 보장 불가 (best effort)
</constraints>

## Output Format
<output_format>
### Files to Modify
- `src/agent/SystemPrompt.ts`
- `src/bridge/telegram-assistant-bridge.ts`

### Files Unchanged (이미 구현됨)
- `src/agent/AgentLoop.ts` — resolveFormat() 이미 존재
- `src/interface/telegram/TelegramBot.ts` — parseModeMap 이미 존재

### Verification Commands
- `npx tsc --noEmit`
- `npx vitest run --grep "SystemPrompt"`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] 외부 채널 응답에 구조적 마크다운(##, **) 감소 (GPT best effort)
- [ ] 코드 블록 포함 → 자동 markdown 전환
- [ ] SystemPrompt 스타일 가이드가 외부 채널에만 적용
- [ ] Telegram format='text' → parse_mode 미전송
- [ ] CLI 채널은 기존 markdown 유지
- [ ] TypeScript 컴파일 성공
</acceptance>
