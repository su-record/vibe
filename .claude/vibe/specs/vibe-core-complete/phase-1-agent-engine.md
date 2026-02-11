---
status: pending
phase: 1
createdAt: 2026-02-06T10:49:09+09:00
---

# SPEC: Phase 1 - Agent Engine (상주 데몬)

## Persona

<role>
Senior backend engineer specializing in:
- Node.js daemon/service development
- IPC (Inter-Process Communication)
- Process management
- TypeScript strict mode
</role>

## Context

<context>

### Background
Vibe Core가 OS처럼 동작하려면 **항상 상주하는 Agent Engine**이 필요하다.
현재는 CLI 호출 시에만 동작하지만, 외부 인터페이스(Telegram, Web)에서
요청을 받으려면 데몬이 백그라운드에서 대기해야 한다.

### Why
- 외부 인터페이스에서 오는 요청을 수신
- Claude Code 세션을 관리 (OAuth 인증 상태 유지)
- 여러 프로젝트/Job을 동시에 처리

### Tech Stack
- Runtime: Node.js 18+
- IPC: Unix socket (`~/.vibe/daemon.sock`) + JSON-RPC
- Process: child_process.fork()
- PID file: `~/.vibe/daemon.pid`

### Related Code
- `src/cli/index.ts`: 기존 CLI 진입점
- `src/orchestrator/backgroundAgent.ts`: 백그라운드 에이전트 참고
- `src/orchestrator/BackgroundManager.ts`: 작업 큐 관리 참고

### Design Reference
- PM2: 프로세스 관리 패턴
- VSCode Language Server: IPC 통신 패턴

</context>

## Task

<task>

### Phase 1.1: Daemon Core
1. [ ] `src/daemon/VibeDaemon.ts` 생성
   - 싱글톤 데몬 클래스
   - Unix socket 서버 (`~/.vibe/daemon.sock`)
   - JSON-RPC 프로토콜 핸들러
   - Verify: `vibe daemon status` 응답

2. [ ] `src/daemon/DaemonIPC.ts` 생성
   - JSON-RPC 2.0 메시지 형식
   - 요청/응답 매칭 (id 기반)
   - 타임아웃 처리 (30초)
   - **메시지 프레이밍:** NDJSON (newline-delimited JSON), 최대 페이로드 1MB
   - **RPC 메서드 정의:**
     - `daemon.health` → `{ status, uptime, memory, activeSessions }`
     - `daemon.stop` → `{ success: boolean }`
     - `job.*` → Phase 2에서 정의
     - `policy.*` → Phase 3에서 정의
   - **IPC 인증:** 데몬 시작 시 `~/.vibe/daemon.token` 생성 (crypto.randomBytes(32), 권한 0600), 모든 RPC 요청에 `auth` 필드 필수
   - **에러 코드:** -32700 (parse), -32600 (invalid), -32601 (not found), -32602 (params), -32603 (internal), -1001 (timeout), -1002 (auth)
   - Verify: 유닛 테스트, 스키마 검증, 인증 실패 테스트, 오버사이즈 페이로드 거부 테스트

3. [ ] PID 파일 관리
   - `~/.vibe/daemon.pid` 생성/삭제
   - 좀비 프로세스 감지
   - Verify: `ps aux | grep vibe-daemon`

### Phase 1.2: CLI Integration
4. [ ] `vibe daemon start` 명령 추가
   - 데몬 프로세스 포크
   - 이미 실행 중이면 경고
   - Verify: 프로세스 확인

5. [ ] `vibe daemon stop` 명령 추가
   - SIGTERM 전송
   - graceful shutdown (10초 대기)
   - Verify: 프로세스 종료 확인

6. [ ] `vibe daemon status` 명령 추가
   - 실행 상태, PID, 가동 시간
   - 활성 Job 수
   - Verify: JSON 출력

7. [ ] `vibe daemon restart` 명령 추가
   - stop + start 조합
   - Verify: PID 변경 확인

### Phase 1.3: Session Management
8. [ ] Claude Code 세션 관리
   - 프로젝트별 세션 풀 (최대 5 글로벌 세션, 프로젝트당 1 세션)
   - `claude -p --stream-json` 프로세스 관리
   - 세션 재사용 (OAuth 인증 유지)
   - **세션 동시성 모델:** 프로젝트당 1 세션, 동일 세션 내 요청 직렬화 (큐)
   - **환경 격리:** 세션 시작 시 프로젝트의 env 스냅샷 저장, 환경 불일치 시 세션 재시작
   - Verify: 동일 프로젝트 요청 시 세션 재사용, 동시 요청 직렬화 테스트

9. [ ] 세션 정리
   - 유휴 세션 타임아웃 (30분)
   - 비정상 종료 감지
   - 네트워크 오류 시 재연결 (최대 3회, 지수 백오프)
   - 세션 실패 시 에러 로깅 및 클라이언트 알림
   - Verify: 메모리 누수 없음, 에러 복구 테스트

### Phase 1.4: Health & Logging
10. [ ] Health check endpoint
    - `daemon.health` RPC 메서드 (통일된 네이밍)
    - 메모리 사용량, 활성 세션 수, 데몬 버전
    - **버전 핸드셰이크:** CLI 버전 > 데몬 버전이면 경고 + 재시작 제안
    - Verify: `vibe daemon status --json`

11. [ ] 로깅 시스템
    - `~/.vibe/logs/daemon.log`
    - 로그 로테이션 (7일)
    - Verify: 로그 파일 생성

</task>

## Constraints

<constraints>
- 기존 CLI 동작에 영향 없음 (데몬 없이도 동작)
- 메모리 사용량 < 100MB (유휴 시)
- Unix socket 권한 0600 (보안), `~/.vibe/` 디렉토리 권한 0700
- 소켓 파일 생성 전 lstat으로 심링크 공격 방지, 기존 소켓은 소유자 확인 후 삭제
- graceful shutdown 지원
- 크래시 시 자동 재시작 없음 (사용자 명시적 시작)
- IPC 응답 시간: p95 < 50ms (로컬 명령), p95 < 5000ms (Claude 호출 포함)
- 데몬 시작 시간: < 3초
- SQLite: WAL 모드 사용, Daemon이 유일한 writer (CLI는 IPC 통해 요청)
- 메모리 사용량 < 100MB (유휴 시), < 256MB (활성 시)
- Secret 저장: keytar (OS keychain) 또는 암호화된 vault 파일 사용
</constraints>

## Output Format

<output_format>

### Files to Create
- `src/daemon/VibeDaemon.ts` - 메인 데몬 클래스
- `src/daemon/DaemonIPC.ts` - IPC 통신
- `src/daemon/SessionPool.ts` - Claude 세션 관리
- `src/daemon/types.ts` - 타입 정의
- `src/daemon/index.ts` - 모듈 export
- `src/cli/commands/daemon.ts` - CLI 명령어

### Files to Modify
- `src/cli/index.ts` - daemon 명령어 등록
- `package.json` - bin에 vibe-daemon 추가

### Verification Commands
- `npm run build`
- `npm test`
- `vibe daemon start && vibe daemon status && vibe daemon stop`

</output_format>

## Acceptance Criteria

<acceptance>
- [ ] `vibe daemon start`로 백그라운드 데몬 시작
- [ ] `vibe daemon stop`으로 graceful 종료
- [ ] `vibe daemon status`로 상태 확인
- [ ] Unix socket으로 IPC 통신 가능
- [ ] Claude Code 세션 풀링 동작
- [ ] 로그 파일 생성 및 로테이션
- [ ] 빌드 성공
- [ ] 테스트 통과
</acceptance>
