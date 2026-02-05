# vibe sync — Google Drive AppData 인증 동기화

## 개요

작업 환경이 바뀔 때마다 GPT, Gemini, NVIDIA, Kimi 인증을 반복하는 문제를 해결.
Google Drive AppData에 암호화된 인증 정보를 저장하고, 새 환경에서 pull로 복원.

## 사용법

```bash
# 1. Google 계정 연결 (1회)
vibe sync login

# 2. 현재 인증 정보를 클라우드에 업로드
vibe sync push

# 3. 새 환경에서 복원
vibe sync pull

# 4. 선택적 동기화
vibe sync push --only auth       # 인증만
vibe sync push --only memory     # 메모리만
vibe sync pull --only auth       # 인증만 복원

# 5. 상태 확인
vibe sync status

# 6. 연결 해제
vibe sync logout
```

새 환경 셋업:
```bash
npm i -g @su-record/core && vibe sync login && vibe sync pull
```

## 핵심 설계

### Gemini 인증과 별도 Google 계정

- Sync용 Google OAuth는 Gemini OAuth와 **독립적**
- Gemini 인증이 없어도 sync 사용 가능
- 동일한 Google 계정을 쓸 수도, 다른 계정을 쓸 수도 있음

### Google Drive AppData

- `drive.appdata` 스코프 사용 — 사용자 Drive UI에 보이지 않는 앱 전용 공간
- 파일 크기 제한 없음 (인증 JSON은 수 KB 수준)
- Google 계정으로 자동 동기화 (별도 서버 불필요)

## 아키텍처

```
┌─────────────┐     OAuth      ┌──────────────┐
│  vibe CLI   │ ←──────────→   │ Google OAuth  │
│             │                │ (브라우저)     │
└──────┬──────┘                └──────────────┘
       │
       │ push: 로컬 키 수집 → 암호화 → Drive 업로드
       │ pull: Drive 다운로드 → 복호화 → 로컬 키 복원
       │
┌──────▼──────┐
│ Google Drive │
│  AppData/   │
│  vibe-sync/ │
│   auth.enc  │  ← 인증 키 (암호화)
│  memory.enc │  ← 전역 메모리 (암호화)
└─────────────┘
```

## 동기화 대상

| 파일 | 내용 | 경로 |
|------|------|------|
| `gemini-auth.json` | Gemini OAuth 토큰 | `~/.config/vibe/` |
| `gemini-apikey.json` | Gemini API 키 | `~/.config/vibe/` |
| `gpt-auth.json` | GPT OAuth 토큰 | `~/.config/vibe/` |
| `gpt-apikey.json` | GPT API 키 | `~/.config/vibe/` |
| `nvidia-apikey.json` | NVIDIA API 키 | `~/.config/vibe/` |
| `kimi-apikey.json` | Kimi API 키 | `~/.config/vibe/` |

### 전역 메모리 (Session RAG)

| 파일 | 내용 | 경로 |
|------|------|------|
| `session-rag.db` | 전역 결정/제약/목표/증거 | `~/.claude/vibe/` |
| `memories.json` | 저장된 메모리 | `~/.claude/vibe/` |

다른 노트북에서 동일 작업을 이어갈 때, 이전 환경에서의 결정사항과 컨텍스트를 그대로 사용 가능.

> 프로젝트별 설정(`.claude/vibe/config.json`)은 git으로 관리하므로 동기화 대상이 아님

## OAuth 플로우

기존 Gemini OAuth 패턴을 그대로 재사용:

1. **브라우저 오픈** — `http://localhost:{PORT}/oauth-callback` 리다이렉트
2. **PKCE** — S256 code_challenge (보안)
3. **콜백 서버** — localhost 에서 authorization code 수신
4. **토큰 교환** — code → access_token + refresh_token
5. **토큰 저장** — `~/.config/vibe/sync-auth.json`

### OAuth 설정

| 항목 | 값 |
|------|-----|
| 콜백 포트 | 51122 (Gemini 51121과 충돌 방지) |
| 콜백 경로 | `/oauth-callback` |
| 리다이렉트 URI | `http://localhost:51122/oauth-callback` |
| 타임아웃 | 5분 |

### 필요 스코프

```
https://www.googleapis.com/auth/drive.appdata    # AppData 폴더 접근
https://www.googleapis.com/auth/userinfo.email    # 계정 식별
https://www.googleapis.com/auth/userinfo.profile  # 프로필 표시
```

> `drive.appdata`는 사용자의 다른 Drive 파일에 접근 불가 — 최소 권한 원칙

### Google Cloud Console 설정 (필요)

- Google Cloud 프로젝트에서 OAuth 2.0 Client ID 생성
- 타입: Desktop application
- 리다이렉트 URI: `http://localhost:51122/oauth-callback`
- Drive API 활성화

## 암호화

### 방식

```
암호화: AES-256-GCM
키 유도: 머신 고유 ID + 사용자 패스프레이즈 (선택)
```

### push 흐름

```
1. ~/.config/vibe/ 에서 인증 파일 수집
2. ~/.claude/vibe/ 에서 전역 메모리 수집 (session-rag.db, memories.json)
3. 인증 → JSON 통합 → 암호화 → "vibe-auth.enc" 업로드
4. 메모리 → 바이너리 통합 → 암호화 → "vibe-memory.enc" 업로드
```

### pull 흐름

```
1. Google Drive AppData에서 "vibe-auth.enc" + "vibe-memory.enc" 다운로드
2. 각각 AES-256-GCM 복호화
3. 인증 파일 → ~/.config/vibe/ 에 복원
4. 메모리 파일 → ~/.claude/vibe/ 에 복원
5. 파일 권한 0o600 설정 (소유자만 읽기/쓰기)
```

> 인증과 메모리를 별도 파일로 분리 — 선택적 동기화 가능 (`vibe sync push --only auth`)

### 암호화 키 전략

```
기본: randomBytes(32) → sync-auth.json에 encryptionKey로 저장
      (sync 계정 자체에 암호화 키가 포함되므로 자동)

옵션: --passphrase 플래그로 사용자 패스프레이즈 추가
      PBKDF2(passphrase + salt, 100000 iterations) → 키 유도
      (패스프레이즈를 기억해야 하지만 보안 강화)
```

## 구현 파일

### 신규 생성

| 파일 | 역할 |
|------|------|
| `src/lib/sync/constants.ts` | OAuth 클라이언트 ID, 스코프, 엔드포인트 |
| `src/lib/sync/oauth.ts` | OAuth 플로우 (브라우저→콜백→토큰) |
| `src/lib/sync/storage.ts` | sync 토큰 저장/로드 (`sync-auth.json`) |
| `src/lib/sync/drive.ts` | Google Drive AppData API 래퍼 (upload/download/list) |
| `src/lib/sync/crypto.ts` | AES-256-GCM 암호화/복호화 |
| `src/lib/sync/index.ts` | public API export |
| `src/cli/commands/sync.ts` | CLI 서브커맨드 (login/push/pull/status/logout) |

### 수정

| 파일 | 변경 |
|------|------|
| `src/cli/index.ts` | `vibe sync` 라우팅 추가 |
| `src/cli/commands/info.ts` | help에 sync 명령어 추가, status에 sync 상태 추가 |
| `CLAUDE.md` | CLI Commands 테이블에 sync 추가 |

## Google Drive AppData API

### 파일 업로드

```typescript
// POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart
// Headers: Authorization: Bearer {accessToken}

const metadata = {
  name: 'vibe-auth.enc',
  parents: ['appDataFolder']  // AppData 폴더
};

// multipart/related 형식으로 메타데이터 + 파일 내용 전송
```

### 파일 다운로드

```typescript
// 1. 파일 ID 조회
// GET https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='vibe-auth.enc'

// 2. 파일 다운로드
// GET https://www.googleapis.com/drive/v3/files/{fileId}?alt=media
```

### 파일 업데이트 (기존 파일 덮어쓰기)

```typescript
// PATCH https://www.googleapis.com/upload/drive/v3/files/{fileId}?uploadType=multipart
```

## 충돌 처리

| 시나리오 | 동작 |
|----------|------|
| push 시 클라우드에 이미 파일 있음 | 덮어쓰기 (최신 wins) |
| pull 시 로컬에 이미 인증 있음 | 클라우드 버전으로 교체 (로컬 백업 생성) |
| push/pull 동시 발생 | Drive API의 파일 잠금으로 자연스럽게 처리 |

## 보안 고려사항

| 항목 | 대응 |
|------|------|
| 전송 중 암호화 | HTTPS (Google API 기본) |
| 저장 시 암호화 | AES-256-GCM (Drive에 암호문만 저장) |
| 토큰 노출 | 파일 권한 0o600, .gitignore 포함 |
| 스코프 최소화 | `drive.appdata`만 사용 (다른 파일 접근 불가) |
| refresh_token | 동기화 대상에서 제외 가능 (옵션) |

## 기존 코드 재사용

| 패턴 | 원본 | 재사용 |
|------|------|--------|
| OAuth 브라우저 플로우 | `gemini-oauth.ts` | `sync/oauth.ts` |
| PKCE 생성 | `gemini-oauth.ts` | `sync/oauth.ts` |
| 토큰 저장 구조 | `gemini-storage.ts` | `sync/storage.ts` |
| 토큰 리프레시 | `TokenRefresher.ts` | `sync/oauth.ts` |
| 플랫폼별 브라우저 실행 | `gemini-oauth.ts` | `sync/oauth.ts` |
| 전역 config 경로 | `getGlobalConfigDir()` | `sync/storage.ts` |

## 향후 확장

- `vibe sync auto` — push를 인증 변경 시 자동 실행
- `vibe sync diff` — 로컬 vs 클라우드 차이 확인
- 선택적 동기화 — `vibe sync push --only gemini,gpt`
