---
status: pending
phase: 3
title: Function Calling Tool Definitions
---

# SPEC: vibe-agent - Phase 3: Function Calling Tool Definitions

## Persona
<role>
Senior TypeScript developer specializing in tool/function design for LLM agents.
- JSON Schema 및 Zod 스키마 설계 전문
- 기존 VIBE의 LLM 통합 코드에 정통
</role>

## Context
<context>
### Background
Phase 1-2에서 Agent Loop와 ToolRegistry가 준비되었다. 이제 헤드 모델이 호출할 수 있는 구체적인 tool들을 정의하고 구현한다.

### Tool Categories
| Category | Tools | Backend |
|----------|-------|---------|
| Development | `claude_code` | Claude Code CLI |
| Voice/Search | `gemini_stt`, `google_search` | Gemini API |
| Analysis | `kimi_analyze` | AZ Kimi K2.5 API |
| Web | `web_browse` | Gemini capabilities |
| Utility | `send_telegram`, `get_time`, `manage_jobs` | Internal |
| Memory | `save_memory`, `recall_memory` | SQLite |

### Related Code
- `src/lib/gpt/orchestration.ts`: GPT orchestration 함수들
- `src/lib/gemini/capabilities.ts`: Gemini webSearch, analyzeUI, transcribeAudio
- `src/lib/az/orchestration.ts`: Kimi orchestration
- `src/tools/`: 기존 MCP tools (memory, semantic, etc.)
</context>

## Task
<task>
### Phase 3-1: Development Tool
1. [ ] `src/agent/tools/claude-code.ts` 생성
   - `claude_code` tool: Claude Code CLI 호출로 개발 작업 수행
   - Parameters: `{ task: string, workingDirectory?: string }`
   - 실행: child_process.spawn으로 Claude Code CLI 호출 (shell: false, 명령 인젝션 방지)
   - **보안 제약**:
     - workingDirectory는 프로젝트 루트 하위로 정규화 (path traversal 차단: `../` 금지)
     - 환경변수: 최소 필요 변수만 전달 (PATH, HOME, ANTHROPIC_API_KEY)
     - 실행 timeout: 동기 30초, Job 모드 10분
   - 결과: 실행 결과 텍스트 반환
   - **장시간 작업 판별 기준** (하나라도 해당 시 Job 전환):
     - task 문자열에 "구현", "만들어", "리팩토링", "테스트 작성" 등 생성 키워드 포함
     - 파일 생성/수정 3개 이상 예상
     - 예상 소요 30초 이상 (이전 유사 작업 실행 시간 기반 추정)
   - 단시간 작업 (단순 조회, 1-2개 파일 수정)은 동기 실행 후 결과 반환
   - File: `src/agent/tools/claude-code.ts`

### Phase 3-2: Voice & Search Tools
1. [ ] `src/agent/tools/gemini-stt.ts` 생성
   - `gemini_stt` tool: 음성 파일 → 텍스트 변환
   - Parameters: `{ audioFileId: string }`
   - 기존 `src/lib/gemini/capabilities.ts`의 `transcribeAudio()` 활용
   - File: `src/agent/tools/gemini-stt.ts`

2. [ ] `src/agent/tools/google-search.ts` 생성
   - `google_search` tool: 웹 검색
   - Parameters: `{ query: string, maxResults?: number }`
   - 기존 `src/lib/gemini/capabilities.ts`의 `webSearch()` 활용
   - maxResults 기본값: 5, 최대: 10
   - File: `src/agent/tools/google-search.ts`

### Phase 3-3: Analysis Tool
1. [ ] `src/agent/tools/kimi-analyze.ts` 생성
   - `kimi_analyze` tool: 코드/문서 분석
   - Parameters: `{ content: string, analysisType: 'code-review' | 'architecture' | 'security' | 'general' }`
   - 기존 `src/lib/az/orchestration.ts`의 `coreAzOrchestrate()` 활용
   - File: `src/agent/tools/kimi-analyze.ts`

### Phase 3-4: Web Tool
1. [ ] `src/agent/tools/web-browse.ts` 생성
   - `web_browse` tool: URL 내용 읽기
   - Parameters: `{ url: string, extractMode?: 'text' | 'summary' }`
   - **SSRF 방지** (DNS Rebinding 대응):
     - **Scheme/Port 제한**: http/https만 허용, 포트 80/443만 허용 (그 외 scheme/port 즉시 거부)
     - DNS 해석 먼저 수행 → 해석된 IP 검증 → 검증된 IP로 HTTP 요청
     - Private IP 차단: 10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x, ::1, fc00::/7, fe80::/10
     - 메타데이터 IP 차단: 169.254.169.254 (AWS/GCP)
     - Redirect: 자동 리디렉트 비활성화, 수동 루프로 각 hop마다 DNS+IP 재검증 (최대 3회)
     - **IPv6 차단**: ::1 (loopback), fc00::/7 (unique local), fe80::/10 (link-local)
     - domain allowlist 옵션 (config로 설정 가능, 기본값: 모든 public 도메인 허용)
   - Timeout: 10초
   - File: `src/agent/tools/web-browse.ts`

### Phase 3-5: Utility Tools
1. [ ] `src/agent/tools/send-telegram.ts` 생성
   - `send_telegram` tool: Telegram 메시지 전송
   - Parameters: `{ text: string, parseMode?: 'HTML' | 'Markdown' }`
   - **보안**: chatId는 파라미터로 받지 않고 현재 요청의 chatId에 바인딩 (cross-chat 전송 방지)
   - File: `src/agent/tools/send-telegram.ts`

2. [ ] `src/agent/tools/manage-memory.ts` 생성
   - `save_memory` tool: 중요 결정/정보 저장
   - `recall_memory` tool: 저장된 메모리 검색
   - 기존 `src/tools/memory/` 활용
   - File: `src/agent/tools/manage-memory.ts`

### Phase 3-6: Tool Index
1. [ ] `src/agent/tools/index.ts` 생성
   - 모든 tool 내보내기
   - `registerAllTools(registry: ToolRegistry)` 함수
   - File: `src/agent/tools/index.ts`
</task>

## Constraints
<constraints>
- 기존 LLM 통합 코드 (`src/lib/`) 최대한 재사용
- Tool function은 순수 함수 스타일 (side effect 최소화)
- SSRF 방지: web_browse에서 private IP (10.x, 172.16-31.x, 192.168.x, 127.x, 169.254.x) 차단
- Tool argument는 Zod strict 모드로 검증
- 각 tool의 결과는 10KB 이내로 제한 (초과 시 HeadModel에 요약 요청)
- **Tool 감사 로그 형식**: `{ timestamp, toolName, arguments (민감 데이터 마스킹), latencyMs, success, errorType? }`
- **Per-tool 권한 scope**: 각 tool은 `scope: 'read' | 'write' | 'execute'` 속성을 가짐
  - read: google_search, recall_memory, kimi_analyze, web_browse
  - write: save_memory, send_telegram
  - execute: claude_code, gemini_stt
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/agent/tools/claude-code.ts`
- `src/agent/tools/gemini-stt.ts`
- `src/agent/tools/google-search.ts`
- `src/agent/tools/kimi-analyze.ts`
- `src/agent/tools/web-browse.ts`
- `src/agent/tools/send-telegram.ts`
- `src/agent/tools/manage-memory.ts`
- `src/agent/tools/index.ts`

### Verification Commands
- `npm run build`
- `npm test`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: claude_code tool이 Claude Code CLI를 호출하고 결과를 반환한다
- [ ] AC-2: gemini_stt tool이 음성을 텍스트로 변환한다
- [ ] AC-3: google_search tool이 검색 결과를 반환한다 (최대 10개)
- [ ] AC-4: kimi_analyze tool이 4가지 분석 유형을 지원한다
- [ ] AC-5: web_browse tool이 URL 내용을 반환하며, private IP를 차단한다
- [ ] AC-6: send_telegram tool이 메시지를 전송한다
- [ ] AC-7: save_memory/recall_memory tool이 정상 동작한다
- [ ] AC-8: 모든 tool argument가 Zod strict으로 검증된다
- [ ] AC-9: Tool 결과가 10KB 초과 시 자동 요약된다
- [ ] AC-10: registerAllTools()로 전체 tool 일괄 등록이 동작한다
- [ ] AC-11: 빌드 성공 (`npm run build`)
</acceptance>
