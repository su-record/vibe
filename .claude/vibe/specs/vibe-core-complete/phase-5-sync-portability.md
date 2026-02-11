---
status: pending
phase: 5
createdAt: 2026-02-06T10:49:09+09:00
---

# SPEC: Phase 5 - Sync & Portability

## Persona

<role>
Senior backend engineer specializing in:
- Cloud sync systems
- OAuth 2.0 authentication
- Data migration
- TypeScript strict mode
</role>

## Context

<context>

### Background
Vibe Core의 설정, 기억, 정책을 **여러 기기에서 동기화**할 수 있어야 한다.
로컬 우선(Local-first)이지만, 클라우드 백업 및 동기화를 지원한다.

### Why
- 여러 컴퓨터에서 동일한 환경
- 데이터 백업 및 복구
- 팀 간 정책 공유 (선택)

### Tech Stack
- Cloud: Google Drive API (OAuth 2.0)
- Local: SQLite + JSON 파일
- Sync: 증분 동기화 (last_modified 기반)

### Related Code
- `src/lib/memory/SessionRAGStore.ts`: SQLite 데이터 관리
- `src/lib/llm/auth/ApiKeyManager.ts`: 인증 관리 패턴
- `src/cli/setup.ts`: 설정 관리

### Design Reference
- Obsidian Sync: 로컬 우선 + 클라우드 동기화
- VSCode Settings Sync: 설정 동기화

</context>

## Task

<task>

### Phase 5.1: Sync Model
1. [ ] `src/sync/types.ts` 생성
   - SyncTarget enum (memory, policy, settings, all)
   - SyncStatus 인터페이스
   - SyncConflict 인터페이스
   - Verify: 타입 체크 통과

2. [ ] `src/sync/SyncStore.ts` 생성
   - 동기화 메타데이터 관리
   - last_synced 타임스탬프
   - 변경 추적 (dirty flag)
   - Verify: 유닛 테스트

### Phase 5.2: Google Drive Integration
3. [ ] `src/sync/GoogleDriveSync.ts` 생성
   - OAuth 2.0 인증 플로우
   - 토큰 저장: keytar(OS keychain) 우선, 불가 시 vault (`~/.vibe/vault.enc`)
   - Drive API 래퍼
   - Verify: 인증 플로우 테스트

4. [ ] Sync 디렉토리 구조
   - Google Drive: `Vibe/` 폴더
   - 하위: `memory/`, `policy/`, `settings/`
   - 파일명: `<device-id>-<type>.enc` (암호화된 바이너리, 복호화 후 JSON)
   - Verify: 폴더 생성 테스트

### Phase 5.3: Data Serialization
5. [ ] Memory Export/Import
   - SessionRAG → JSON 변환
   - KnowledgeGraph → JSON 변환
   - 증분 내보내기 (last_synced 이후)
   - Verify: 직렬화 테스트

6. [ ] Policy Export/Import
   - 사용자 정책 → JSON
   - 정책 병합 로직
   - Verify: 정책 동기화 테스트

7. [ ] Settings Export/Import
   - `~/.vibe/config.json` 동기화
   - 자격 증명 제외 (토큰, API 키)
   - Verify: 설정 동기화 테스트

### Phase 5.4: Sync Engine
8. [ ] `src/sync/SyncEngine.ts` 생성
   - Push: 로컬 → 클라우드
   - Pull: 클라우드 → 로컬
   - 충돌 감지 및 해결
   - Verify: 동기화 테스트

9. [ ] 충돌 해결 전략
   - last-write-wins (기본)
   - manual (사용자 선택)
   - merge (정책은 병합)
   - Verify: 충돌 해결 테스트

10. [ ] 자동 동기화
    - 데몬 시작 시 pull
    - 주기적 push (5분마다)
    - 종료 시 push
    - Verify: 자동 동기화 테스트

### Phase 5.4b: Error Handling & Performance
10b. [ ] Google Drive API 실패 처리
   - 인증 토큰 만료 시 자동 refresh (refresh_token 사용)
   - API 할당량 초과 시 백오프 (429 응답 → 60초 대기 후 재시도)
   - 네트워크 오류 시 재시도 (최대 3회, 지수 백오프: 2s/4s/8s)
   - 실패 시 로컬 데이터 보존 + 다음 주기에 재시도
   - Verify: API 실패 시뮬레이션 테스트

10c. [ ] Sync 성능 목표
   - Push 응답 시간: < 10초 (100개 미만 변경 항목)
   - Pull 응답 시간: < 15초 (100개 미만 변경 항목)
   - 증분 동기화 비교: < 2초 (메타데이터 비교)
   - 최대 동기화 데이터: 50MB per sync (초과 시 분할)
   - Verify: 성능 벤치마크 테스트

### Phase 5.5: Device Management
11. [ ] Device Registry
    - 기기 ID 생성 (UUID)
    - 기기 이름 설정
    - 기기 목록 조회 (동기화된)
    - Verify: 기기 관리 테스트

12. [ ] 선택적 동기화
    - 기기별 동기화 대상 설정
    - 특정 정책만 동기화
    - Verify: 선택적 동기화 테스트

### Phase 5.6: CLI Commands
13. [ ] Sync CLI
    - `vibe sync login` - Google OAuth 인증
    - `vibe sync logout` - 인증 해제
    - `vibe sync push` - 수동 푸시
    - `vibe sync pull` - 수동 풀
    - `vibe sync status` - 동기화 상태
    - `vibe sync conflicts` - 충돌 목록
    - Verify: CLI 동작 테스트

14. [ ] Device CLI
    - `vibe device list` - 기기 목록
    - `vibe device rename <name>` - 기기 이름 변경
    - `vibe device remove <id>` - 기기 제거
    - Verify: CLI 동작 테스트

</task>

## Constraints

<constraints>
- **Local-first 원칙:** 로컬이 기본 마스터, 충돌 시 LWW(HLC 기반)로 해결하되 동일 HLC면 로컬 우선 (클라우드는 백업 역할)
- 자격 증명(토큰, API 키)은 동기화 안 함
- 동기화 실패해도 로컬 동작에 영향 없음
- 네트워크 없으면 오프라인 모드
- 동기화 데이터는 암호화 (AES-256-GCM)
- **암호화 파라미터:**
  - KDF: Argon2id (memory=64MB, iterations=3, parallelism=1) 또는 PBKDF2-SHA256 (iterations=600000, fallback)
  - Salt: crypto.randomBytes(16), 파일별 고유
  - Nonce/IV: crypto.randomBytes(12), 메시지별 고유
  - **암호화 파일 포맷:** `[version:1B][salt:16B][nonce:12B][ciphertext][authTag:16B]`
  - 잘못된 passphrase 감지: 복호화 시 authTag 검증 실패 → 명확한 에러 메시지
- **암호화 키 관리:** 사용자가 설정한 'Sync Passphrase'로부터 키 파생 (각 기기에서 동일 passphrase 입력 필요, 키는 클라우드에 저장 안 함)
- **Passphrase lifecycle:**
  - `vibe sync set-passphrase` → passphrase 설정/변경 (기존 데이터 재암호화)
  - `vibe sync unlock` → 데몬에 passphrase 전달 (keytar에 파생 키 캐싱, 세션 동안 유지)
  - 데몬 재시작 시 keytar에서 파생 키 복원 → 자동 동기화 가능
  - passphrase 미설정 시 auto-sync 비활성화 (경고 로그)
- **SQLite 동기화 일관성:** 내보내기 시 `BEGIN IMMEDIATE` 트랜잭션 + SQLite backup API 사용
- **HLC 저장:** 각 레코드에 `hlc TEXT` 필드 추가 (직렬화 데이터에 포함)
- **충돌 해결 전략:**
  - 기본: last-write-wins (LWW) with Hybrid Logical Clock (HLC) - 시스템 클럭 + 카운터로 clock skew 방지
  - 동일 HLC인 경우: 로컬 마스터 (로컬 변경 우선)
  - 충돌 감지: HLC 차이가 5분 이내면 충돌로 간주, 사용자 확인 요청
  - 강제 push: `--force` 플래그로 로컬 우선 강제 (이전 버전 백업 후)
- Google Drive 용량 제한 고려 (15GB)
</constraints>

## Output Format

<output_format>

### Files to Create
- `src/sync/types.ts` - 타입 정의
- `src/sync/SyncStore.ts` - 메타데이터 저장
- `src/sync/GoogleDriveSync.ts` - Google Drive 연동
- `src/sync/SyncEngine.ts` - 동기화 엔진
- `src/sync/DataSerializer.ts` - 데이터 직렬화
- `src/sync/ConflictResolver.ts` - 충돌 해결
- `src/sync/DeviceManager.ts` - 기기 관리
- `src/sync/index.ts` - 모듈 export
- `src/cli/commands/sync.ts` - Sync CLI
- `src/cli/commands/device.ts` - Device CLI

### Files to Modify
- `src/daemon/VibeDaemon.ts` - 자동 동기화 통합
- `src/cli/index.ts` - 명령어 등록
- `package.json` - 의존성 추가 (googleapis)

### Verification Commands
- `npm run build`
- `npm test`
- `vibe sync login && vibe sync push && vibe sync pull`

</output_format>

## Acceptance Criteria

<acceptance>
- [ ] Google OAuth 인증 동작
- [ ] Memory 동기화 동작
- [ ] Policy 동기화 동작
- [ ] Settings 동기화 동작 (자격 증명 제외)
- [ ] 충돌 감지 및 해결 동작
- [ ] 기기 관리 동작
- [ ] `vibe sync login/logout/push/pull/status` CLI 동작
- [ ] 자동 동기화 동작 (데몬 모드)
- [ ] 오프라인 모드 동작
- [ ] 빌드 성공
- [ ] 테스트 통과
</acceptance>
