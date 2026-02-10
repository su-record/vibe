---
status: pending
currentPhase: 3
totalPhases: 4
createdAt: 2026-02-07T09:39:00+09:00
lastUpdated: 2026-02-07T09:39:00+09:00
---

# SPEC: telegram-model-a / Phase 3 - 리서치 + 유틸리티 라우트

## Persona
<role>
TypeScript/Node.js 시니어 개발자. LLM 기반 웹 검색/요약과 다양한 유틸리티 기능(이미지 생성, 번역, 문서 작성 등) 구현에 전문성을 가진다. 기존 LLMCluster와 SmartRouter를 활용하여 효율적인 멀티 LLM 파이프라인을 구축한다.
</role>

## Context
<context>
### Background
텔레그램에서 웹 검색, 콘텐츠 요약, URL 북마크, 이미지 생성, 문서 작성, 번역, 메모, 스크린샷, 파일 분석 등의 유틸리티 기능을 제공하는 2개 라우트.

### Who
본인 전용 (1인)

### Tech Stack
- LLM: SmartRouter (GPT/Gemini/AZ fallback chain), LLMCluster (병렬 쿼리)
- Browser: Playwright (웹 검색 fallback, 스크린샷)
- Existing: BaseRoute, RouteRegistry, NotificationManager, BrowserPool

### Related Code
- `src/orchestrator/SmartRouter.ts`: LLM 라우팅
- `src/orchestrator/LLMCluster.ts`: 멀티 LLM 병렬 쿼리, Gemini 웹서치
- `src/router/routes/BaseRoute.ts`: Phase 1에서 생성
- `src/router/browser/BrowserPool.ts`: Phase 2에서 생성

### Research Insights
- **Gemini**: 비동기 Job 큐로 무거운 작업(브라우저, LLM) 분리
- **Kimi**: LLM 응답 JSON schema 검증, 부분 결과 반환 + 리소스 해제
- **GPT**: 구조화된 로깅, background job 패턴
</context>

## Task
<task>
### Phase 3.1: 리서치 서비스
1. [ ] `src/router/services/WebSearchService.ts` 생성
   - Gemini 웹서치 활용: LLMCluster.webSearch(query) 호출
   - 검색 결과 구조화: `{ title, url, snippet }[]`
   - Playwright fallback: Gemini 실패 시 Google 검색 페이지 스크래핑
   - 결과 개수: 기본 5개, 최대 20개
   - Verify: unit test

2. [ ] `src/router/services/ContentSummarizer.ts` 생성
   - URL → 콘텐츠 추출: fetch + HTML 파싱 (cheerio 또는 자체 파싱)
   - LLM 요약: SmartRouter.route({ type: 'reasoning' }) 활용
   - 요약 길이: 짧게(3줄), 보통(10줄), 자세히(전체) — 기본 보통
   - 한국어 요약 우선
   - 긴 콘텐츠 청킹: 4000토큰 단위로 분할 → 각 청크 요약 → 최종 통합 요약
   - Verify: unit test

3. [ ] `src/router/services/BookmarkService.ts` 생성
   - URL 수신 → 자동 요약 + 태그 생성
   - 저장: SQLite DB (`~/.vibe/bookmarks.db`)
     - 스키마: id, url, title, summary, tags, createdAt
   - 조회: `list(tag?, limit = 20)`, `search(query)`
   - 삭제: `delete(id)`
   - Verify: unit test

### Phase 3.2: 리서치 라우트
4. [ ] `src/router/routes/ResearchRoute.ts` 생성
   - canHandle: intent.category === 'research'
   - subIntent 분류:
     - `web_search`: 웹 검색
     - `summarize`: URL 또는 텍스트 요약
     - `bookmark`: URL 저장/조회
   - 결과 포맷팅: 검색 결과를 텔레그램 마크다운으로 포맷
   - Verify: integration test

### Phase 3.3: 유틸리티 서비스
5. [ ] `src/router/services/ImageGenerator.ts` 생성
   - VIBE 기존 이미지 생성 도구 활용
   - 결과를 텔레그램 사진으로 전송
   - Verify: `npx tsc --noEmit`

6. [ ] `src/router/services/DocumentGenerator.ts` 생성
   - LLM 기반 문서 생성: SmartRouter 활용
   - 출력 형식: 마크다운
   - 저장 옵션: 텔레그램 파일 전송, Drive 저장 (Phase 2 DriveService 활용)
   - Verify: `npx tsc --noEmit`

7. [ ] `src/router/services/TranslationService.ts` 생성
   - LLM 기반 번역: SmartRouter.route({ type: 'general' })
   - 언어 자동 감지 + 목표 언어 지정
   - 기본: 한→영, 영→한 자동 감지
   - 긴 텍스트 청킹 지원 (4000토큰 단위)
   - Verify: unit test

8. [ ] `src/router/services/NoteService.ts` 생성
   - 빠른 메모 저장: SQLite DB (`~/.vibe/notes.db`)
     - 스키마: id, content, tags, category, createdAt, updatedAt
   - LLM 기반 구조화: 메모 → 카테고리/태그 자동 분류
   - 조회: `list(category?, limit = 20)`, `search(query)`
   - Verify: unit test

9. [ ] `src/router/services/ScreenshotService.ts` 생성
   - Playwright로 웹페이지 캡처: `capture(url): Buffer`
     - full page 또는 viewport
     - PDF 출력 지원
   - BrowserPool에서 컨텍스트 획득
   - 결과를 텔레그램 사진/파일로 전송
   - Verify: `npx tsc --noEmit`

10. [ ] `src/router/services/FileAnalyzer.ts` 생성
    - 텔레그램 파일 수신 → 분석/변환
    - 지원 형식:
      - CSV → 차트 설명 (LLM 분석)
      - PDF → 텍스트 추출 + 요약
      - 이미지 → 설명 (LLM 멀티모달)
      - JSON/YAML → 구조 분석
    - 임시 파일 다운로드 → 처리 → 삭제
    - Verify: `npx tsc --noEmit`

### Phase 3.4: 유틸리티 라우트
11. [ ] `src/router/routes/UtilityRoute.ts` 생성
    - canHandle: intent.category === 'utility'
    - subIntent 분류:
      - `image_generate`: 이미지 생성
      - `document_write`: 문서 작성
      - `translate`: 번역
      - `note_save`, `note_search`: 메모 관리
      - `screenshot`: 웹페이지 캡처
      - `file_analyze`: 파일 분석
    - 결과 포맷팅: 서비스별 적합한 텔레그램 응답
    - Verify: integration test

### Phase 3.5: 테스트
12. [ ] Unit Tests 작성
    - `WebSearchService.test.ts`, `ContentSummarizer.test.ts`
    - `BookmarkService.test.ts`, `NoteService.test.ts`
    - `TranslationService.test.ts`
    - Verify: `npx vitest run`
</task>

## Constraints
<constraints>
- LLM 호출은 SmartRouter/LLMCluster 통해서만 (직접 API 호출 금지)
- 긴 콘텐츠는 청킹하여 LLM 토큰 제한 준수 (4000토큰 단위)
- 임시 파일은 처리 후 즉시 삭제
- SQLite WAL mode 사용 (기존 패턴 따름)
- Playwright 브라우저 컨텍스트는 BrowserPool에서만 획득
- 함수 길이 30줄 이내, Nesting 3 이하
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/router/services/WebSearchService.ts`
- `src/router/services/ContentSummarizer.ts`
- `src/router/services/BookmarkService.ts`
- `src/router/services/ImageGenerator.ts`
- `src/router/services/DocumentGenerator.ts`
- `src/router/services/TranslationService.ts`
- `src/router/services/NoteService.ts`
- `src/router/services/ScreenshotService.ts`
- `src/router/services/FileAnalyzer.ts`
- `src/router/routes/ResearchRoute.ts`
- `src/router/routes/UtilityRoute.ts`

### Test Files to Create
- `src/router/services/WebSearchService.test.ts`
- `src/router/services/ContentSummarizer.test.ts`
- `src/router/services/BookmarkService.test.ts`
- `src/router/services/NoteService.test.ts`
- `src/router/services/TranslationService.test.ts`
- `src/router/routes/ResearchRoute.test.ts`
- `src/router/routes/UtilityRoute.test.ts`

### Verification Commands
- `npx tsc --noEmit`
- `npx vitest run`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: "AI 뉴스 검색해줘" → Gemini 웹서치 → 결과 5개 텔레그램 전송
- [ ] AC-2: URL 전송 → 자동 요약 + 태그 생성 → 북마크 저장
- [ ] AC-3: "번역해줘: Hello world" → LLM 번역 → "안녕 세계" 텔레그램 전송
- [ ] AC-4: "메모: 내일 미팅 준비" → SQLite 저장 + 자동 태그 분류
- [ ] AC-5: "스크린샷 [URL]" → Playwright 캡처 → 텔레그램 사진 전송
- [ ] AC-6: CSV 파일 전송 → LLM 분석 → 요약 결과 텔레그램 전송
- [ ] AC-7: 긴 콘텐츠(4000토큰+) → 청킹 → 통합 요약
- [ ] AC-8: `npx tsc --noEmit` 빌드 성공
- [ ] AC-9: `npx vitest run` 모든 테스트 통과

### Ambiguity Scan Auto-fixes

- BookmarkService/NoteService DB: 제한 없음 (개인용), 10000개 초과 시 경고
- FileAnalyzer 미지원 형식: "지원하지 않는 형식입니다" + 지원 형식 안내
- ContentSummarizer HTML 파싱: cheerio 사용 (경량 + Node.js 네이티브 호환)
- ImageGenerator: SmartRouter.route({ type: 'code-gen' })로 DALL-E/Gemini 이미지 생성 API 호출
- WebSearchService 응답 시간 목표: Gemini 웹서치 <5초, Playwright fallback <15초
</acceptance>
