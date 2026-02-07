# PRD: Telegram Model A - 개인 AI 비서 시스템

## 1. 개요

텔레그램을 통해 개인 AI 비서를 운영하는 시스템. 텔레그램 메시지를 받아 "Model A" 라우터가 의도를 분류하고, 개발/Google Apps/리서치/유틸리티/모니터링/복합 작업을 자동 실행한다.

## 2. 대상 및 환경

- **사용자**: 본인 전용 (1인)
- **실행 환경**: 로컬 PC (Windows + macOS)
- **Telegram**: PC마다 별도 Bot 생성하여 사용
- **크로스 플랫폼**: Windows/macOS 모두 100% 동작 필수

## 3. 기존 VIBE 인프라 (반드시 활용)

| 모듈 | 파일 | 활용 방식 |
|------|------|----------|
| TelegramBot | `src/interface/telegram/TelegramBot.ts` | 메시지 수신/발신 (onMessage, sendResponse) |
| ClaudeCodeBridge | `src/interface/ClaudeCodeBridge.ts` | Claude Code stream-json 프로토콜, 세션 resume, permission_request |
| JobManager | `src/job/JobManager.ts` | Job 생명주기 (pending→executing→completed) |
| IntentParser | `src/job/IntentParser.ts` | 한/영 키워드 기반 의도 분류 (개발 관련) |
| SmartRouter | `src/orchestrator/SmartRouter.ts` | 태스크별 LLM 라우팅 + fallback chain |
| LLMCluster | `src/orchestrator/LLMCluster.ts` | GPT/Gemini/AZ 병렬 쿼리 |
| PolicyEngine | `src/policy/PolicyEngine.ts` | 위험도 평가, 승인 흐름 |
| SessionPool | `src/daemon/SessionPool.ts` | 프로젝트별 세션 관리 |
| SyncEngine | `src/sync/SyncEngine.ts` | Google Drive OAuth (확장 대상) |
| WebhookHandler | `src/interface/webhook/WebhookHandler.ts` | GitHub 이벤트 수신 |
| BaseInterface | `src/interface/BaseInterface.ts` | 인터페이스 추상 클래스 |
| ExternalMessage | `src/interface/types.ts` | 채널 무관 메시지 타입 |
| telegram-bridge | `src/bridge/telegram-bridge.ts` | 현재 진입점 (model-a-bridge.ts로 교체) |

### 기존 타입 (준수 필수)

```typescript
type ChannelType = 'telegram' | 'web' | 'webhook' | 'cli';

interface ExternalMessage {
  id: string; channel: ChannelType; chatId: string; userId: string;
  content: string; type: 'text' | 'voice' | 'file' | 'command';
  metadata?: Record<string, unknown>; timestamp: string;
}

interface ClaudeStreamMessage {
  type: 'user' | 'assistant' | 'system' | 'result' | 'permission_request';
  subtype?: string;
  message?: { role?: string; content?: string | Array<{ text: string }> };
  result?: string;
  permission?: { tool: string; description: string };
}

type JobStatus = 'pending' | 'parsing' | 'planning' | 'evaluating' |
  'awaiting_approval' | 'approved' | 'rejected' | 'executing' |
  'completed' | 'failed' | 'cancelled';
```

## 4. 핵심 아키텍처

```
Telegram User (텍스트/음성/파일)
       │
       ▼
 [TelegramBot] (기존)
       │
       ▼
 [ModelA Router] ─── IntentClassifier (LLM + keyword 하이브리드)
       │
       ├─ development ──▶ [DevRoute]
       ├─ google ────────▶ [GoogleRoute]
       ├─ research ──────▶ [ResearchRoute]
       ├─ utility ───────▶ [UtilityRoute]
       ├─ monitor ───────▶ [MonitorRoute]
       └─ composite ─────▶ [CompositeRoute]
```

## 5. 기능 요구사항

### 5.1 코어 라우터 (ModelA Router)

**의도 분류 (IntentClassifier):**
- 3단계: 명시적 명령 매칭 → 키워드 heuristic → LLM 분류
- 분류 카테고리: development, google, research, utility, monitor, composite, conversation
- LLM 분류는 SmartRouter.route({ type: 'reasoning' }) 활용
- 복합 의도 분해 지원 ("검색해서 메일로 보내줘" → research + google)

**라우트 레지스트리:**
- BaseRoute 추상 클래스 (에러 처리, 재시도 3회, 지수 백오프)
- 각 라우트는 canHandle(intent) → boolean + execute(job, intent, message) 구현

**알림 매니저:**
- 진행 상황 텔레그램 전송 (10초 간격 제한)
- 완료/실패 알림
- 방해금지 시간 설정 (23:00~07:00)

### 5.2 개발 라우트 (DevRoute)

**레포 경로 해결 (RepoResolver):**
- 별칭 매칭: "vibe" → 설정된 경로
- WorkSpace 디렉토리 스캔: basePaths에서 디렉토리명 검색
- 절대 경로 직접 사용
- 설정: `~/.vibe/router.json`의 repos 섹션

**Claude Code 세션 관리 (DevSessionManager):**
- ClaudeCodeBridge 인스턴스 생성/관리
- 세션 resume 지원 (setSessionId/getSessionId)
- 같은 chatId + projectPath면 기존 세션 재사용
- 비활성 2시간 후 자동 종료

**Q&A 텔레그램 포워딩 (TelegramQABridge):**
- Claude Code permission_request → 텔레그램 인라인 키보드 (승인/거부)
- Claude Code 일반 질문 → 텔레그램 텍스트 + 답장 대기
- **60초 타임아웃 → AI 추천으로 자동 진행** (핵심 결정)
- 읽기 전용 도구(Read, Glob, Grep)는 자동 승인
- 설정 가능: maxWaitSeconds, autoApproveTools, defaultOnTimeout

**Git 작업 (GitOpsHandler):**
- git commit, push, PR 생성 (gh CLI)
- 완료 후 git status 요약을 텔레그램으로 전송
- spawn with args array 사용 (shell 금지, 보안)

**VIBE 커맨드:**
- /vibe.spec, /vibe.run, /vibe.analyze 등을 Claude Code에 전달
- 분석 결과를 텔레그램 메시지로 전달

### 5.3 Google Apps (GoogleRoute) - 하이브리드

**방식: Google API 우선, Playwright fallback**

| 서비스 | 방식 | Google API |
|--------|------|-----------|
| Gmail | API | Gmail API v1 |
| Drive | API (기존 SyncEngine 확장) | Drive API v3 |
| Sheets | API | Sheets API v4 |
| YouTube | API + LLM 요약 | YouTube Data API v3 |
| Calendar | API | Calendar API v3 |

**Gmail:**
- 메일 전송 (임의 주소 + 나에게 보내기)
- HTML/plain text 지원
- 파일 첨부
- 메일 검색/읽기

**Google Drive:**
- 파일 업로드/다운로드
- 폴더 생성
- 파일 검색/목록
- 파일 공유

**Google Sheets:**
- 스프레드시트 생성
- 셀/범위 읽기/쓰기
- 데이터 추가 (append)

**YouTube:**
- 비디오 검색
- 비디오 정보 (제목, 설명, 길이)
- 자막/캡션 가져오기
- LLM으로 콘텐츠 요약

**Calendar:**
- 일정 조회 ("내일 일정 알려줘")
- 일정 추가 ("회의 추가해줘")
- 일정 수정/삭제

**OAuth 통합:**
- 기존 SyncEngine의 Google OAuth 확장
- 스코프 추가: Gmail, Sheets, Calendar, YouTube
- 토큰 통합 저장: `~/.vibe/google-tokens.json`

**Playwright (fallback):**
- Chrome persistent context (기존 로그인 프로필 재사용)
- 크로스 플랫폼 Chrome 프로필 경로 자동 감지
- 최대 3개 동시 브라우저 컨텍스트
- API로 안 되는 작업에만 사용 (복잡한 웹 리서치 등)

### 5.4 리서치 라우트 (ResearchRoute)

**웹 검색:**
- Gemini 웹서치 활용 (기존 LLMCluster)
- Playwright 브라우저 검색 (fallback)

**콘텐츠 요약:**
- LLM 기반 웹페이지/문서 요약
- 요약 결과를 텔레그램/메일로 전송

**URL 북마크/클리핑:**
- URL 보내면 자동 요약 + 태그 + 저장
- Drive 또는 로컬 메모리에 저장

### 5.5 유틸리티 라우트 (UtilityRoute)

**이미지 생성:** VIBE 도구 활용 → 텔레그램 전송
**문서 작성:** LLM으로 문서 생성 → 메일/Drive 저장
**번역:** LLM 기반 고품질 번역
**메모:** 빠른 메모 → 구조화된 문서로 변환
**스크린샷/PDF:** Playwright로 웹페이지 캡처 → 텔레그램 전송
**파일 분석:** 텔레그램에 파일 보내면 분석/변환 (CSV→차트, PDF→요약)

### 5.6 모니터 라우트 (MonitorRoute)

**스케줄링 (SchedulerEngine):**
- cron 스타일 정기 작업 (node-cron)
- "매일 9시에 AI 뉴스 검색해서 메일로 보내줘"
- 자연어로 스케줄 등록/수정/삭제
- 스케줄 목록 조회

**CI/CD 모니터링 (GitHubMonitor):**
- GitHub Actions 실패 → 텔레그램 알림
- PR 리뷰 요청 → 텔레그램 알림
- 기존 WebhookHandler 활용

**일일 리포트 (DailyReportGenerator):**
- 매일 저녁 "오늘 한 일" 자동 요약
- git log + 작업 히스토리 + 메모리 기반
- 텔레그램으로 전송

### 5.7 복합 라우트 (CompositeRoute)

**태스크 플래너 (TaskPlanner):**
- LLM 기반 복합 의도 분해 (DAG)
- 의존성 있는 단계는 순차, 없으면 병렬 실행
- 중간 결과를 다음 단계에 전달

**예시:**
```
"AI 관련 최신 논문 3개 찾아서 요약하고, 구글 시트에 정리하고, 메일로 보내줘"
→ Step 1: WebSearch("AI latest papers")
→ Step 2: Summarize(step1.results) [depends: 1]
→ Step 3: SheetsWrite(step2.summary) [depends: 2] (병렬)
→ Step 4: GmailSend(step2.summary) [depends: 2] (병렬)
```

**자연어 히스토리:**
- "어제 뭐 했지?" → 메모리/커밋 히스토리 조회

**알림 필터링:**
- 중요도별 알림 설정 (긴급만, 전부, 무음)

## 6. 신규 파일 구조

```
src/router/
  ModelARouter.ts              -- 메인 라우터
  IntentClassifier.ts          -- LLM + keyword 의도 분류
  RouteRegistry.ts             -- 라우트 등록/관리
  types.ts                     -- 타입 정의

  routes/
    BaseRoute.ts               -- 추상 라우트 (에러 처리, 재시도)
    DevRoute.ts                -- 개발 라우트
    GoogleRoute.ts             -- Google Apps 라우트
    ResearchRoute.ts           -- 리서치 라우트
    UtilityRoute.ts            -- 유틸리티 라우트
    MonitorRoute.ts            -- 모니터/스케줄링 라우트
    CompositeRoute.ts          -- 복합 라우트

  resolvers/
    RepoResolver.ts            -- 로컬 레포 경로 해결

  sessions/
    DevSessionManager.ts       -- Claude Code 세션 관리

  qa/
    TelegramQABridge.ts        -- Q&A 포워딩 (60초 타임아웃)

  handlers/
    GitOpsHandler.ts           -- Git 작업

  services/
    GmailService.ts            -- Gmail API
    DriveService.ts            -- Drive API (기존 확장)
    SheetsService.ts           -- Sheets API
    YouTubeService.ts          -- YouTube API + LLM 요약
    CalendarService.ts         -- Calendar API
    WebSearchService.ts        -- 웹서치
    ContentSummarizer.ts       -- LLM 요약
    BookmarkService.ts         -- URL 저장/요약
    ImageGenerator.ts          -- 이미지 생성
    DocumentGenerator.ts       -- 문서 작성
    TranslationService.ts      -- 번역
    NoteService.ts             -- 메모 관리
    ScreenshotService.ts       -- 웹 캡처
    FileAnalyzer.ts            -- 파일 분석
    GitHubMonitor.ts           -- GitHub 이벤트 감시
    SchedulerEngine.ts         -- cron 스케줄러
    DailyReportGenerator.ts    -- 일일 리포트

  browser/
    BrowserManager.ts          -- Playwright 관리
    BrowserPool.ts             -- 브라우저 인스턴스 풀

  planner/
    TaskPlanner.ts             -- 복합 태스크 LLM 분해
    TaskExecutor.ts            -- DAG 실행 엔진

  notifications/
    NotificationManager.ts     -- 텔레그램 알림

src/bridge/
  model-a-bridge.ts            -- telegram-bridge.ts 교체
```

## 7. 설정 파일

```jsonc
// ~/.vibe/router.json
{
  "repos": {
    "aliases": { "vibe": "C:\\Users\\endba\\WorkSpace\\vibe" },
    "basePaths": ["C:\\Users\\endba\\WorkSpace"],
    "defaultRepo": "vibe"
  },
  "qa": {
    "maxWaitSeconds": 60,
    "autoApproveReadOnly": true,
    "autoApproveTools": ["Read", "Glob", "Grep", "WebSearch", "WebFetch"],
    "defaultOnTimeout": "ai_decide"
  },
  "browser": {
    "chromeUserDataDir": "auto",
    "headless": false,
    "maxInstances": 3
  },
  "scheduler": { "enabled": true, "jobs": [] },
  "monitor": {
    "github": { "repos": [], "events": ["workflow_run.completed", "pull_request.review_requested"] }
  },
  "notifications": {
    "progressUpdates": true,
    "progressIntervalMs": 10000,
    "quietHours": { "start": "23:00", "end": "07:00" }
  }
}
```

## 8. 의존성 추가

```json
{
  "playwright": "^1.50.0",
  "googleapis": "^144.0.0",
  "node-cron": "^3.0.3"
}
```

## 9. 수정 대상 기존 파일

| 파일 | 변경 |
|------|------|
| `src/bridge/telegram-bridge.ts` | model-a-bridge.ts로 교체 |
| `src/cli/commands/telegram.ts` | router start/stop 명령어 추가 |
| `src/sync/SyncEngine.ts` | OAuth 스코프 확장 |
| `src/interface/types.ts` | 라우트 관련 타입 추가 |
| `package.json` | 의존성 추가 |

## 10. 리서치 결과 요약

### 아키텍처 (GPT-5.2 x6 + Claude x4 합의)

- **계층 아키텍처**: Transport → Router → IntentClassifier → Services → Adapters
- **어댑터 패턴**: 외부 서비스 추상화 (인터페이스 뒤에 실제 구현 숨김)
- **이벤트 기반**: 장기 실행 태스크는 Job 큐 + 상태 업데이트
- **멱등성**: Telegram update_id로 중복 처리 방지
- **backpressure**: 채팅/API별 rate limiting

### 보안

- 토큰 암호화 저장 (파일 권한 0600)
- Claude Code: spawn with args array (shell 금지)
- 입력 유효성 검증 + 명령어 허용 목록
- 로그에 토큰/API 키 노출 금지
- Playwright: 전용 프로필 권장 (실제 프로필 사용 시 주의)

### 엣지 케이스

- 동시 세션: per-chat mutex 또는 큐
- LLM 모호성: confidence threshold + disambiguation
- 브라우저 크래시: watchdog + context 재시작
- Google API 429: retry-after + graceful degradation
- Stream desync: JSON frame delimiter 검증
- 타임아웃: 부분 결과 반환 + 리소스 해제

## 11. 구현 순서 (4 Stream 동시 진행)

**Stream 1**: 코어 라우터 + 개발 라우트 (Phase 1-2)
**Stream 2**: Google Apps (Phase 3)
**Stream 3**: 리서치 + 유틸리티 (Phase 4)
**Stream 4**: 모니터링 + 복합 (Phase 5-6)

Phase 1 완료 후 Stream 2-4 병렬 진행 가능.

## 12. 검증 시나리오

1. 텔레그램 → "vibe에서 테스트 파일 만들어줘" → Claude Code 실행 → 완료 알림
2. 텔레그램 → "메일 보내줘" → Gmail API → 전송 확인
3. 텔레그램 → "AI 뉴스 검색해줘" → 웹서치 → 요약 → 텔레그램
4. 텔레그램 → "검색해서 메일로 보내줘" → 리서치 + Gmail 조합
5. 텔레그램 → "매일 9시에 뉴스 보내줘" → 스케줄 등록 → 실행 확인
6. GitHub Actions 실패 → 텔레그램 알림
7. Claude Code 질문 → 텔레그램 전송 → 60초 타임아웃 → 자동 진행
