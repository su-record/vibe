---
status: pending
phase: 1
---

# SPEC: pc-control — Phase 1: Browser Automation

## Persona
<role>
Playwright ARIA Snapshot 기반 브라우저 자동화 전문가. OpenClaw의 `src/browser/` 아키텍처를 참조하되, VIBE의 MCP 도구 체계에 맞게 재구현한다.
</role>

## Context
<context>

### Background
- VIBE에 Playwright 1.58.2 설치 완료, BrowserManager/BrowserAgent 부분 구현 상태
- OpenClaw은 Playwright ARIA Snapshot API (`page._snapshotForAI()`)를 사용하여 role 기반 ref 시스템 구현
- 좌표(x,y) 대신 접근성 역할(role+name)로 요소를 식별하는 것이 핵심 차별점
- 개발 에이전트로서 웹 리서치, 에러 페이지 분석, UI 테스트에 활용

### Tech Stack
- Playwright 1.58+ (ARIA Snapshot API, CDP 연결)
- Chrome DevTools Protocol (CDP WebSocket)
- better-sqlite3 (ref 캐싱, 세션 관리)

### Related Code (VIBE 기존)
- `src/tools/` — MCP 도구 등록 패턴
- `src/interface/` — 인터페이스 관리
- `src/daemon/InterfaceManager.ts` — 데몬 인터페이스 시작/중지

### Reference (OpenClaw)
- `C:\Users\endba\WorkSpace\openclaw\src\browser\pw-role-snapshot.ts` — ARIA → role ref 변환
- `C:\Users\endba\WorkSpace\openclaw\src\browser\pw-session.ts` — CDP 연결 + refLocator
- `C:\Users\endba\WorkSpace\openclaw\src\browser\pw-tools-core.interactions.ts` — click/type/scroll

### Research Insights
- **GPT**: ARIA-first 전략, deterministic browser sessions, tool contract schemas (Zod)
- **Gemini**: Semantic State Compression (ARIA snapshot → 토큰 90% 절감), Polling 대신 MutationObserver
- **Kimi**: ARIA snapshot versioning + content-checksum, DOM mutation 감지, exponential backoff
- **Security**: ephemeral context 필수 (CVE-2025-8821), CDP 포트 인증 필수
</context>

## Task
<task>

### Phase 1-1: Browser Service Core
1. [ ] `src/browser/BrowserService.ts` — Playwright CDP 연결 관리 (팩토리 패턴)
   - `IBrowserProvider` 인터페이스: `getCDPUrl()`, `isSandboxed()`, `terminate()`
   - `LocalBrowserProvider` 구현 (Phase 1), `SandboxBrowserProvider` (Phase 5에서 구현)
   - `connect(provider)`: CDP WebSocket 연결 (provider별 분기)
   - `disconnect()`: 정리
   - `getPage(tenantId, targetId)`: 테넌트별 격리된 Page 객체
   - 연결 캐싱 + 자동 재연결 (exponential backoff + jitter)
   - Verify: 단위 테스트 (로컬 + mock 샌드박스 프로바이더)

2. [ ] `src/browser/RoleSnapshotManager.ts` — ARIA Snapshot → Role Ref 변환
   - `snapshot(page, options)`: `page._snapshotForAI()` 호출
   - Role ref 생성 (e1, e2, ...) + RoleRefMap 캐싱
   - `interactive` 옵션: 인터랙티브 요소만 필터링
   - `compact` 옵션: 구조 요소 제거
   - Content-checksum 기반 변경 감지
   - 최대 50개 targetId 캐싱 (LRU)
   - Verify: snapshot 결과 파싱 테스트

3. [ ] `src/browser/RefLocator.ts` — Ref → Playwright Locator 변환
   - `resolve(page, ref)`: "e1" → `page.getByRole(role, { name, exact: true })`
   - nth 처리 (동일 role+name 중복 시)
   - aria-ref 폴백 지원
   - Verify: ref 해석 테스트 (단일 ref, nth 중복 ref, aria-ref 폴백)

### Phase 1-2: Browser Actions
4. [ ] `src/browser/BrowserActions.ts` — 상호작용 액션
   - `click(page, ref, options)`: 클릭 (single/double, left/right, modifiers)
   - `type(page, ref, text, options)`: 텍스트 입력 (submit, slowly)
   - `fillForm(page, fields[])`: 다중 필드 일괄 입력
   - `scroll(page, direction, amount)`: 스크롤
   - `pressKey(page, key, modifiers)`: 키보드 입력
   - `navigate(page, url)`: URL 이동
   - `screenshot(page, options)`: 스크린샷 (full page / element)
   - 모든 액션에 타임아웃 (기본 8초) + 에러 → JSON 결과
   - Verify: 각 액션 테스트

### Phase 1-3: MCP Tool 등록
5. [ ] `src/tools/browser/index.ts` — MCP 도구 인터페이스
   - `core_browser_snapshot`: 페이지 ARIA 스냅샷 (AI-friendly 텍스트 + ref)
   - `core_browser_act`: 상호작용 (click/type/scroll/pressKey/fillForm)
   - `core_browser_navigate`: URL 이동 + 새 탭 열기/닫기
   - `core_browser_screenshot`: 스크린샷 캡처 (파일 경로 반환)
   - `core_browser_status`: 브라우저 연결 상태 확인
   - Zod 스키마 정의 + JSON 에러 반환
   - Verify: MCP 서버 등록 확인

### Phase 1-4: 데몬 통합
6. [ ] `src/daemon/InterfaceManager.ts` 수정 — 브라우저 서비스 시작/중지
   - `vibe start` 시 BrowserService 옵션 초기화
   - `vibe stop` 시 브라우저 컨텍스트 정리
   - Verify: 데몬 시작/중지 테스트

### Phase 1-5: CLI
7. [ ] `src/cli/commands/browser.ts` — CLI 명령어
   - `vibe browser status`: 브라우저 연결 상태
   - `vibe browser open <url>`: URL 열기
   - `vibe browser snapshot`: 현재 페이지 스냅샷
   - Verify: CLI 실행 테스트

### Phase 1-6: 테스트
8. [ ] `src/browser/BrowserService.test.ts` — 단위 테스트 (IBrowserProvider 팩토리, 테넌트 격리)
9. [ ] `src/browser/RoleSnapshotManager.test.ts` — 스냅샷 테스트 (REF_STALE 감지, snapshotVersion 불일치)
10. [ ] `src/browser/BrowserActions.test.ts` — 액션 테스트
11. [ ] `src/browser/SecurityTests.ts` — 보안 테스트 (SSRF URL 차단, 경로 순회 차단, CDP 토큰 검증)
</task>

## Constraints
<constraints>
- OpenClaw 코드 직접 복사 금지 → 패턴만 참조하여 재구현
- `page._snapshotForAI()`는 Playwright 1.58+ 필수 (이미 설치됨)
- CDP 포트는 localhost 바인딩 필수 (외부 노출 금지)
- [P1] CDP 연결 시 1회성 세션 토큰 핸드셰이크 필수, 허용 origin/peer 검증
- [P1] `navigate` URL 검증: `https`/`http` 스킴만 허용, `file:`/`javascript:` 차단, 사설망/메타데이터 IP(169.254.x.x) 차단
- [P1] Ref에 snapshotVersion 바인딩: DOM 변경 후 stale ref 사용 시 `REF_STALE` 에러 반환 + 재스냅샷 유도
- [P1] Playwright 1.58.x 버전 고정 + `_snapshotForAI()` 기능 탐지 가드 (미지원 시 degrade)
- [P2] Native dialog (alert/confirm/prompt) 기본 auto-dismiss 처리
- [P2] 스크린샷 파일: per-tenant 격리 디렉토리, 경로 순회 차단, 랜덤 파일명
- [P1] CDP 네트워크: 로컬 모드 = `localhost` 바인딩, SaaS/Docker 모드 = `IBrowserProvider.getCDPUrl()`이 컨테이너 내부 IP 반환 (Docker bridge network), Phase 5 `SandboxBrowserProvider`가 CDP 포트 포워딩 담당
- 멀티테넌트 환경 고려: ephemeral context per-task (Phase 5에서 Docker 격리)
- 브라우저 프로파일 데이터 테넌트 간 공유 금지
- 에러는 JSON 형태로 AI에 반환 (크래시 방지)
- 함수 ≤30줄, 중첩 ≤3레벨
</constraints>

## Output Format
<output_format>

### Files to Create
- `src/browser/BrowserService.ts`
- `src/browser/RoleSnapshotManager.ts`
- `src/browser/RefLocator.ts`
- `src/browser/BrowserActions.ts`
- `src/browser/types.ts`
- `src/tools/browser/index.ts`
- `src/cli/commands/browser.ts`
- `src/browser/BrowserService.test.ts`
- `src/browser/RoleSnapshotManager.test.ts`
- `src/browser/BrowserActions.test.ts`
- `src/browser/SecurityTests.ts`

### Files to Modify
- `src/daemon/InterfaceManager.ts` — 브라우저 서비스 초기화 추가
- `src/tools/index.ts` — 브라우저 도구 export 추가

### Verification Commands
- `pnpm test -- --grep browser`
- `pnpm build`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] `core_browser_snapshot` 호출 시 ARIA role 기반 텍스트 트리 + ref 맵 반환
- [ ] `core_browser_act` 로 ref 기반 click/type/scroll 동작
- [ ] `core_browser_navigate` 로 URL 이동 및 탭 관리
- [ ] `core_browser_screenshot` 로 페이지/요소 스크린샷 파일 생성
- [ ] 에러 발생 시 JSON 형태로 AI에 반환 (크래시 없음)
- [ ] CDP 연결 자동 재연결 (3회 재시도, exponential backoff: 1s → 2s → 4s + ±500ms jitter)
- [ ] CDP 연결 실패 시 JSON 에러 반환 (`{ error: "CDP_CONNECTION_FAILED", retries: 3 }`)
- [ ] `core_browser_snapshot` 응답 시간 ≤3초 (일반 페이지 기준)
- [ ] `core_browser_act` 액션 타임아웃 8초, 에러 시 JSON 반환
- [ ] `core_browser_screenshot` 파일 크기 ≤5MB (PNG)
- [ ] 동시 브라우저 세션: 로컬 3개, SaaS 사용자당 1개
- [ ] `vibe browser status/open/snapshot` CLI 동작
- [ ] 모든 테스트 통과
- [ ] 빌드 성공
</acceptance>
