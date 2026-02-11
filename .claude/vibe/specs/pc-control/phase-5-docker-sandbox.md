---
status: pending
phase: 5
---

# SPEC: pc-control — Phase 5: Docker Sandbox (멀티테넌시)

## Persona
<role>
Docker 컨테이너 격리 전문가. SaaS 멀티유저 환경에서 사용자별 브라우저/코드 실행을 안전하게 격리하는 샌드박스 시스템을 구축한다.
</role>

## Context
<context>

### Background
- VIBE: Docker 관련 코드 없음 (완전 신규)
- OpenClaw: `Dockerfile.sandbox` + `Dockerfile.sandbox-browser` 참조
- SaaS 배포 시 사용자 A의 명령이 사용자 B 환경을 건드리면 안 됨
- 로컬 모드에서는 선택적 (개발자 본인만 사용)

### Tech Stack
- Dockerode (Node.js Docker API)
- Docker (rootless mode 권장)
- Seccomp / AppArmor profiles
- gVisor (선택적 추가 격리)

### Sandbox Scope
| Scope | 격리 단위 | 사용 시나리오 |
|-------|----------|-------------|
| `session` | 세션마다 독립 컨테이너 | 최고 보안 |
| `user` | 사용자별 컨테이너 재사용 | 성능/보안 균형 |
| `shared` | 전역 공유 | 로컬 모드 |

### Research Insights
- **GPT**: per-task ephemeral containers, rootless + read-only FS + dropped capabilities
- **Gemini**: gVisor/Kata, io_uring 비활성 (CVE-2025-9002)
- **Kimi**: factory pattern for dynamic provisioning, tmpfs for cache, seccomp-bpf profiles
- **Security**: CVE-2019-5736 (runc escape), CVE-2024-21626, no Docker socket exposure
</context>

## Task
<task>

### Phase 5-1: Container Manager
1. [ ] `src/sandbox/ContainerManager.ts` — Docker 컨테이너 관리
   - `create(userId, options)`: 컨테이너 생성
   - `start(containerId)`: 시작
   - `stop(containerId)`: 중지
   - `remove(containerId)`: 삭제
   - `exec(containerId, command)`: 명령 실행
   - 컨테이너 풀: 재사용 가능한 warm 컨테이너 유지
   - Auto-cleanup: 비활성 30분 → 자동 삭제
   - Verify: CRUD 테스트 (mock Dockerode)

2. [ ] `src/sandbox/ContainerConfig.ts` — 보안 설정
   - Rootless 실행 (non-root UID)
   - Read-only root filesystem + tmpfs (/tmp, /workspace)
   - Dropped capabilities (ALL, then add only needed)
   - Seccomp profile (최소 syscall 허용)
   - 리소스 제한: CPU (0.5 core), Memory (512MB), PID (100)
   - 네트워크: egress allowlist (Google API, npm registry 등)
   - 환경변수 필터링 (NODE_OPTIONS, DYLD_* 차단)
   - Verify: 설정 검증 테스트

### Phase 5-2: Sandbox Browser
3. [ ] `Dockerfile.sandbox-browser` — 브라우저 샌드박스 이미지
   - Base: debian:bookworm-slim
   - Chromium + Xvfb + socat (CDP 포트 포워딩)
   - 포트: 9222 (CDP)
   - Entrypoint: Xvfb 시작 → Chromium 시작 → socat 포워딩
   - Verify: 이미지 빌드 + 컨테이너 실행 테스트

4. [ ] `src/sandbox/SandboxBrowser.ts` — 샌드박스 브라우저 관리
   - 컨테이너 생성 → CDP 포트 매핑 → BrowserService 연결
   - 사용자별 독립 브라우저 인스턴스
   - noVNC 옵션 (웹에서 샌드박스 브라우저 화면 확인)
   - Verify: 샌드박스 브라우저 연결 테스트

### Phase 5-3: Tool Policy
5. [ ] `src/sandbox/ToolPolicy.ts` — 도구별 권한 관리
   - 6단계 정책 체인: Profile → Global → User → Channel → Sandbox → SubAgent
   - 도구 그룹: `group:fs`, `group:runtime`, `group:browser`, `group:google`, `group:voice`
   - Allowlist/Denylist: 와일드카드 지원 (`core_browser_*`)
   - 기본 정책: SaaS는 `core_browser_*` + `core_google_*` + `core_voice_*` 허용
   - Verify: 정책 매칭 테스트

6. [ ] `src/sandbox/ExecAllowlist.ts` — 명령 실행 허용 목록
   - Safe bins: `git`, `node`, `npm`, `pnpm`, `grep`, `jq`, `curl`
   - 패턴 매칭: `/usr/bin/*`, `~/scripts/*.sh`
   - 차단: 리다이렉션 (`>`), 서브셸 (`$(...)`), 위험 명령
   - 승인 요청: Telegram/Slack 인라인 버튼으로 허용/거부
   - `allow-always`: 패턴 자동 추가
   - Verify: 패턴 매칭 + 승인 플로우 테스트

### Phase 5-4: MCP Tool 등록
7. [ ] `src/tools/sandbox/index.ts` — MCP 도구
   - `core_sandbox_status`: 샌드박스 상태
   - `core_sandbox_exec`: 샌드박스 내 명령 실행
   - `core_sandbox_browser`: 샌드박스 브라우저 제어
   - Verify: MCP 등록 확인

### Phase 5-5: CLI
8. [ ] `src/cli/commands/sandbox.ts` — CLI 명령어
   - `vibe sandbox status`: 활성 컨테이너 목록
   - `vibe sandbox cleanup`: 비활성 컨테이너 정리
   - Verify: CLI 실행 테스트

### Phase 5-6: 테스트
9. [ ] `src/sandbox/ContainerManager.test.ts`
10. [ ] `src/sandbox/ToolPolicy.test.ts`
11. [ ] `src/sandbox/ExecAllowlist.test.ts`
</task>

## Constraints
<constraints>
- Docker socket 직접 노출 금지 (Dockerode 경유만)
- 컨테이너 내부에서 호스트 파일시스템 접근 금지
- SaaS: 사용자별 컨테이너 필수 (shared 모드 금지)
- 로컬: 샌드박스 선택적 (`config.json`의 `sandbox.enabled`)
- runc 최신 버전 유지 (CVE-2019-5736, CVE-2024-21626 방지)
- io_uring 비활성 seccomp 프로필 (CVE-2025-9002)
- [P1] ExecAllowlist: 쉘 비사용 `execve` 스타일 argv 직접 실행, 절대경로 바이너리만 허용, 인자 스키마 검증
- [P1] Egress 네트워크: iptables/CNI 레벨 제어, DNS rebind 방지, 직접 IP 차단 (allowlist 외)
- [P1] 컨테이너 필수 플래그: `--no-new-privileges`, user namespace remap, device 접근 차단, read-only bind mount
- [P1] Warm pool 재할당: 이전 세션 완전 초기화 (writable layer 리셋, secret zeroization) 후에만 재사용. 초기화 불가 시 컨테이너 파괴 후 신규 생성 (cold start fallback)
- [P2] 컨테이너에 `vibe-session-id` 라벨 → 데몬 시작 시 orphan 컨테이너 정리
- 함수 ≤30줄, 중첩 ≤3레벨
</constraints>

## Output Format
<output_format>

### Files to Create
- `src/sandbox/ContainerManager.ts`
- `src/sandbox/ContainerConfig.ts`
- `src/sandbox/SandboxBrowser.ts`
- `src/sandbox/ToolPolicy.ts`
- `src/sandbox/ExecAllowlist.ts`
- `src/sandbox/types.ts`
- `src/tools/sandbox/index.ts`
- `src/cli/commands/sandbox.ts`
- `Dockerfile.sandbox-browser`
- `src/sandbox/ContainerManager.test.ts`
- `src/sandbox/ToolPolicy.test.ts`
- `src/sandbox/ExecAllowlist.test.ts`

### Files to Modify
- `src/daemon/InterfaceManager.ts` — 샌드박스 초기화
- `src/policy/` — ToolPolicy 통합
- `src/tools/index.ts` — sandbox 도구 export
- `package.json` — dockerode dependency 추가

### Verification Commands
- `pnpm test -- --grep sandbox`
- `pnpm build`
- `docker build -f Dockerfile.sandbox-browser -t vibe-sandbox-browser .`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] 사용자별 Docker 컨테이너 생성/시작/중지/삭제
- [ ] 컨테이너 내 명령 실행 (Exec) 동작
- [ ] 샌드박스 브라우저: 컨테이너 Chromium + CDP 연결
- [ ] 6단계 Tool Policy 체인 동작
- [ ] Exec Allowlist: 패턴 매칭 + 승인 메시지 (Telegram/Slack)
- [ ] 리소스 제한: CPU 0.5, Memory 512MB, PID 100
- [ ] Read-only FS + rootless + seccomp 적용
- [ ] 비활성 30분 → 자동 정리
- [ ] `vibe sandbox status/cleanup` CLI 동작
- [ ] 컨테이너 생성 ≤10초 (warm pool에서 ≤2초)
- [ ] Exec 명령 타임아웃 30초
- [ ] Docker 데몬 미실행 시 명확한 에러 메시지 반환
- [ ] 컨테이너 생성 실패 시 재시도 2회
- [ ] 동시 컨테이너: SaaS 전체 50개, 사용자당 2개
- [ ] Warm pool: 대기 컨테이너 3개 유지
- [ ] 모든 테스트 통과 + 빌드 성공
</acceptance>
