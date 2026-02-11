---
status: pending
phase: 1
createdAt: 2026-02-06T17:31:00+09:00
---

# SPEC: Phase 1 - Claude CLI JSON 모드 핸들러 + 시스템 프롬프트

## Persona

<role>
Senior Node.js backend engineer specializing in:
- child_process 기반 프로세스 관리
- JSON 스트리밍 파싱
- TypeScript strict mode
- 보안(명령어 주입 방지, 입력 검증)
- 기존 Vibe 코드 패턴 준수
</role>

## Context

<context>

### Background
현재 `telegram-bridge.ts`는 `execFile`로 `claude -p <prompt> --model sonnet --max-turns 1`을 호출한다.
이 방식은 텍스트 1턴만 가능하고 도구 사용 정보가 없다.

`claude --output-format json` 모드를 사용하면 JSON 라인으로 스트리밍 응답을 받아
assistant 텍스트, 사용된 도구, 실행 시간 등 구조화된 정보를 추출할 수 있다.

### Why
- 개발 작업 시 멀티 턴(max-turns 5+) 필요
- 도구 사용 결과 추적 (파일 생성, Git 커밋 등)
- 작업 디렉토리(-w) 지정으로 특정 프로젝트에서 실행
- 시스템 프롬프트로 봇 역할 정의

### Tech Stack
- `child_process.spawn` (shell: false)
- `--output-format json` (줄 단위 JSON 파싱)
- `--max-turns` (기본 5, 개발 작업 시 10)
- `--system-prompt` (8가지 역할 정의)
- `-w` (workspace 디렉토리)

### Related Code
- `src/bridge/telegram-bridge.ts`: 현재 `askClaude()` (execFile 방식)
- `src/interface/ClaudeCodeBridge.ts`: stream-json 프로토콜 참고
- `src/orchestrator/AgentExecutor.ts`: 에이전트 실행 패턴 참고

### Claude CLI JSON Output Format
```json
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"응답 내용"}]}}
{"type":"result","result":"최종 결과","tool_uses":[...]}
```

</context>

## Task

<task>

### 1. Claude CLI JSON 핸들러 (`src/bridge/claude-agent.ts`)

1. [ ] `ClaudeAgentOptions` 인터페이스 정의
   - `prompt: string` - 사용자 프롬프트
   - `workspace?: string` - 작업 디렉토리 (-w 플래그)
   - `maxTurns?: number` - 최대 턴 수 (기본 5)
   - `systemPrompt?: string` - 시스템 프롬프트 (--system-prompt)
   - `timeout?: number` - 타임아웃 ms (기본 300000)
   - `allowedTools?: string[]` - 허용 도구 목록

2. [ ] `ClaudeAgentResult` 인터페이스 정의
   - `text: string` - 최종 응답 텍스트
   - `toolsUsed: string[]` - 사용된 도구 목록
   - `duration: number` - 실행 시간 ms
   - `success: boolean` - 성공 여부

3. [ ] `findClaudePath(): string` 구현
   - 크로스플랫폼 Claude CLI 경로 탐색
   - 기존 `telegram-bridge.ts`의 `findClaude()` 로직 재사용
   - 캐싱하여 매번 탐색 방지

4. [ ] `spawnClaudeAgent(options: ClaudeAgentOptions): Promise<ClaudeAgentResult>` 구현
   - `child_process.spawn` 사용 (shell: false 필수)
   - 인자 구성: `['-p', prompt, '--output-format', 'json', '--max-turns', String(maxTurns)]`
   - workspace 지정 시 `-w` 플래그 추가
   - systemPrompt 지정 시 `--system-prompt` 플래그 추가
   - allowedTools 지정 시 `--allowedTools` 플래그 추가
   - stdout를 줄 단위로 JSON 파싱
   - `type: 'assistant'`에서 텍스트 누적
   - `type: 'result'`에서 최종 결과 + tool_uses 추출
   - 타임아웃 시 SIGTERM → 3초 후 SIGKILL
   - 비정상 종료 코드 시 에러 포함 결과 반환

5. [ ] 에러 처리
   - 타임아웃: `"Claude 응답 시간 초과 ({timeout/1000}초)"`
   - 프로세스 에러: `"Claude CLI 실행 실패: {message}"`
   - JSON 파싱 실패: 해당 줄 스킵 (warn 로그)
   - 빈 응답: `"Claude가 응답을 생성하지 못했습니다"`

### 2. 시스템 프롬프트 (`src/bridge/system-prompt.ts`)

1. [ ] `buildSystemPrompt(config: SystemPromptConfig): string` 구현
   - `SystemPromptConfig`: `{ workspace?: string, enabledRoles?: number[] }`
   - 8가지 역할 정의를 포함한 시스템 프롬프트 생성
   - 텔레그램 4096자 제한을 고려한 응답 규칙 포함

2. [ ] 시스템 프롬프트 내용 정의
   - 봇 페르소나: "Personal AI Agent"
   - 8가지 역할과 각 역할의 행동 지침
   - 응답 규칙: 한국어 기본, 간결하게, 4000자 이내
   - 코드 블록은 축약, 파일 목록은 요약
   - 진행 상황 보고 형식 정의

3. [ ] 역할별 도구 허용 목록 정의
   - 개발 작업: Edit, Write, Bash, Read
   - 웹 리서치: WebSearch, WebFetch
   - 시스템 모니터링: Bash(read-only)
   - 파일 관리: Read, Glob, Grep, Write
   - 메모/지식: Read, Write

</task>

## Constraints

<constraints>
- `spawn` 호출 시 반드시 `shell: false` (명령어 주입 방지)
- 사용자 입력은 `-p` 플래그 값으로만 전달 (CLI 인자에 포함 금지)
- JSON 파싱 실패 시 전체 실행 실패로 처리하지 않음 (부분 결과 반환)
- Claude CLI 경로 탐색은 최초 1회만 수행 (모듈 레벨 캐싱)
- 타임아웃은 기본 300초, 최대 600초
- 시스템 프롬프트는 2000토큰 이내로 유지
- 기존 `telegram-bridge.ts`의 `findClaude()`와 중복 코드 제거
</constraints>

## Output Format

<output_format>

### Files to Create
- `src/bridge/claude-agent.ts` - Claude CLI JSON 모드 핸들러
- `src/bridge/system-prompt.ts` - 시스템 프롬프트 빌더

### Files to Modify
- `src/bridge/telegram-bridge.ts` - `findClaude()` 제거 (claude-agent.ts로 이동)

### Verification Commands
- `npm run build`
- `npx vitest run src/bridge/claude-agent.test.ts`

</output_format>

## Acceptance Criteria

<acceptance>
- [ ] `spawnClaudeAgent()` 호출 시 Claude CLI가 JSON 모드로 실행됨
- [ ] stdout의 JSON 라인을 파싱하여 assistant 텍스트와 tool_uses를 추출
- [ ] workspace 옵션 지정 시 해당 디렉토리에서 Claude CLI 실행
- [ ] 타임아웃 발생 시 프로세스 정리(SIGTERM→SIGKILL) 후 에러 결과 반환
- [ ] systemPrompt 옵션으로 봇 역할을 주입 가능
- [ ] shell:false로 실행되어 명령어 주입 불가
- [ ] `buildSystemPrompt()`가 8가지 역할을 포함한 프롬프트 반환
- [ ] 시스템 프롬프트에 텔레그램 4096자 제한 응답 규칙 포함
- [ ] `npm run build` 성공
- [ ] 기존 `findClaude()` 로직이 `claude-agent.ts`로 통합됨
</acceptance>
