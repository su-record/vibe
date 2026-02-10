# Feature: telegram-model-a - Phase 3: 리서치 + 유틸리티 라우트

**SPEC**: `.claude/vibe/specs/telegram-model-a/phase-3-research-utility.md`
**Master Feature**: `.claude/vibe/features/telegram-model-a/_index.feature`

## User Story (Phase Scope)

**As a** 개인 사용자
**I want** 텔레그램에서 웹 검색, 요약, 번역, 메모, 스크린샷 등 유틸리티 기능을 사용하기를
**So that** 다양한 도구를 열지 않고 텔레그램 하나로 정보 수집과 편의 기능을 처리할 수 있다

## Scenarios

### Scenario 1: 웹 검색

```gherkin
Scenario: "AI 뉴스 검색해줘" → Gemini 웹서치
  Given 사용자가 "AI 뉴스 검색해줘"를 전송
  And IntentClassifier가 "research"로 분류
  When ResearchRoute가 실행 (subIntent: web_search)
  Then WebSearchService가 Gemini 웹서치 호출
  And 검색 결과 5개를 마크다운 포맷으로 텔레그램 전송
```
**Verification**: SPEC AC #1

### Scenario 2: URL 요약 및 북마크

```gherkin
Scenario: URL 전송 → 자동 요약 + 태그 + 북마크 저장
  Given 사용자가 "https://example.com/article" URL을 전송
  When ResearchRoute가 실행 (subIntent: bookmark)
  Then ContentSummarizer가 URL 콘텐츠 추출 + LLM 요약
  And BookmarkService가 URL, 제목, 요약, 태그를 SQLite에 저장
  And 텔레그램에 요약 + 태그 결과 전송
```
**Verification**: SPEC AC #2

### Scenario 3: 번역

```gherkin
Scenario: "번역해줘" → LLM 번역
  Given 사용자가 "번역해줘: Hello world, how are you?"를 전송
  And IntentClassifier가 "utility"로 분류
  When UtilityRoute가 실행 (subIntent: translate)
  Then TranslationService가 언어 자동 감지 (영어→한국어)
  And LLM 번역 결과를 텔레그램에 전송
```
**Verification**: SPEC AC #3

### Scenario 4: 메모 저장

```gherkin
Scenario: "메모: ..." → SQLite 저장 + 자동 태그
  Given 사용자가 "메모: 내일 미팅 준비 - 발표자료 수정, 데모 준비"를 전송
  When UtilityRoute가 실행 (subIntent: note_save)
  Then NoteService가 메모를 SQLite에 저장
  And LLM으로 태그 자동 분류 ("미팅", "발표")
  And 텔레그램에 "메모 저장됨 [태그: 미팅, 발표]" 확인
```
**Verification**: SPEC AC #4

### Scenario 5: 스크린샷

```gherkin
Scenario: "스크린샷 [URL]" → Playwright 캡처
  Given 사용자가 "스크린샷 https://example.com"을 전송
  When UtilityRoute가 실행 (subIntent: screenshot)
  Then ScreenshotService가 BrowserPool에서 컨텍스트 획득
  And Playwright로 페이지 캡처
  And 텔레그램에 이미지(사진)로 전송
```
**Verification**: SPEC AC #5

### Scenario 6: 파일 분석 (CSV)

```gherkin
Scenario: CSV 파일 전송 → LLM 분석
  Given 사용자가 텔레그램에 sales.csv 파일을 첨부
  And "이 파일 분석해줘"를 전송
  When UtilityRoute가 실행 (subIntent: file_analyze)
  Then FileAnalyzer가 CSV 파싱
  And LLM으로 데이터 분석 + 인사이트 생성
  And 텔레그램에 분석 결과 전송
  And 임시 파일 삭제
```
**Verification**: SPEC AC #6

### Scenario 7: 긴 콘텐츠 청킹

```gherkin
Scenario: 4000토큰 이상 콘텐츠 → 청킹 → 통합 요약
  Given 10000토큰 길이의 웹페이지 콘텐츠
  When ContentSummarizer가 요약 실행
  Then 4000토큰 단위로 3개 청크로 분할
  And 각 청크별 요약 생성
  And 3개 요약을 통합하여 최종 요약 생성
```
**Verification**: SPEC AC #7

### Scenario 8: 웹 검색 Playwright fallback

```gherkin
Scenario: Gemini 웹서치 실패 시 Playwright fallback
  Given WebSearchService가 Gemini 웹서치 호출
  And Gemini 서비스 에러 발생
  When Playwright fallback 실행
  Then BrowserPool에서 컨텍스트 획득
  And Google 검색 페이지 스크래핑
  And 검색 결과 텔레그램 전송
```
**Verification**: SPEC AC #1

### Scenario 9: 메모 검색

```gherkin
Scenario: "메모 찾아줘: 미팅" → 검색 결과
  Given 여러 개의 메모가 SQLite에 저장됨
  When 사용자가 "메모 찾아줘: 미팅"을 전송
  Then NoteService.search("미팅") 호출
  And 관련 메모 목록을 텔레그램에 전송
```
**Verification**: SPEC AC #4

## Coverage

| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | AC-1 |  |
| 2 | AC-2 |  |
| 3 | AC-3 |  |
| 4 | AC-4 |  |
| 5 | AC-5 |  |
| 6 | AC-6 |  |
| 7 | AC-7 |  |
| 8 | AC-1 |  |
| 9 | AC-4 |  |
