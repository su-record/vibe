# Feature: ui-ux-pro-max-integration - Phase 1: 데이터 레이어 + BM25 검색 엔진

**SPEC**: `.claude/vibe/specs/ui-ux-pro-max-integration/phase-1-data-engine.md`
**Master Feature**: `.claude/vibe/features/ui-ux-pro-max-integration/_index.feature`

## User Story (Phase Scope)
**As a** VIBE 데이터 엔진
**I want** 24개 CSV 디자인 데이터를 BM25 알고리즘으로 검색할 수 있기를
**So that** 에이전트들이 사용자 쿼리에 맞는 디자인 인텔리전스를 정확하게 찾을 수 있다

## Scenarios

### Scenario 1: CSV 데이터 로더 — 정상 파싱
```gherkin
Scenario: CSV 파일을 정상적으로 파싱한다
  Given ~/.claude/vibe/ui-ux-data/ 에 products.csv 파일이 존재한다
  When CsvDataLoader.load("product") 를 호출한다
  Then 98개 행의 ProductRow[] 배열이 반환된다
  And 각 행은 No, Product_Type, Keywords 등 8개 컬럼을 포함한다
```
**Verification**: SPEC AC — BM25 엔진이 products.csv에서 관련 결과 반환

### Scenario 2: CSV 데이터 로더 — BOM 처리
```gherkin
Scenario: BOM이 포함된 CSV 파일을 정상 처리한다
  Given BOM(0xEF 0xBB 0xBF)이 포함된 CSV 파일이 존재한다
  When CsvDataLoader.load() 를 호출한다
  Then BOM이 제거되고 첫 번째 헤더가 정상 파싱된다
```
**Verification**: SPEC AC — BOM 헤더 처리

### Scenario 3: CSV 데이터 로더 — 파일 미존재
```gherkin
Scenario: CSV 데이터 파일이 없을 때 graceful 처리
  Given ~/.claude/vibe/ui-ux-data/ 디렉토리가 비어있다
  When CsvDataLoader.load("product") 를 호출한다
  Then null이 반환된다
  And 에러가 throw 되지 않는다
```
**Verification**: SPEC AC — CSV 데이터 없을 때 graceful 처리

### Scenario 4: BM25 엔진 — 기본 검색
```gherkin
Scenario: BM25 엔진이 관련 문서를 높은 점수로 반환한다
  Given products.csv 데이터로 BM25 엔진이 fit() 되었다
  When score("SaaS dashboard") 를 호출한다
  Then "SaaS (General)" 카테고리 행이 상위 3개 결과에 포함된다
  And 각 결과의 score > 0 이다
```
**Verification**: SPEC AC — "SaaS dashboard" 쿼리로 관련 결과 반환

### Scenario 5: BM25 엔진 — 빈 쿼리
```gherkin
Scenario: 빈 쿼리에 대해 빈 배열을 반환한다
  Given BM25 엔진이 초기화되었다
  When score("") 를 호출한다
  Then 빈 배열 [] 이 반환된다
```
**Verification**: SPEC AC — 빈 쿼리 엣지케이스 처리

### Scenario 6: BM25 엔진 — 스톱워드 전용 쿼리
```gherkin
Scenario: 스톱워드만 있는 쿼리에 대해 빈 배열을 반환한다
  Given BM25 엔진이 초기화되었다
  When score("the a an is") 를 호출한다
  Then 빈 배열 [] 이 반환된다
```
**Verification**: SPEC AC — 스톱워드 전용 쿼리 엣지케이스

### Scenario 7: SearchService — 11개 도메인 검색
```gherkin
Scenario: 11개 도메인 각각에서 검색이 가능하다
  Given SearchService가 초기화되었다
  When search("modern design", "style", 3) 를 호출한다
  Then SearchResult 객체가 반환된다
  And results 배열의 길이가 3 이하이다
  And domain 필드가 "style" 이다
```
**Verification**: SPEC AC — 11개 도메인 전부 검색 가능

### Scenario 8: SearchService — 13개 스택 검색
```gherkin
Scenario: 13개 프레임워크 스택 검색이 가능하다
  Given SearchService가 초기화되었다
  When searchStack("form validation", "nextjs", 5) 를 호출한다
  Then SearchResult 객체가 반환된다
  And 결과에 Next.js v15 관련 가이드가 포함된다
```
**Verification**: SPEC AC — 13개 스택 전부 검색 가능

### Scenario 9: SearchService — 자동 도메인 감지
```gherkin
Scenario: 쿼리 키워드로 도메인을 자동 감지한다
  Given SearchService가 초기화되었다
  When detectDomain("glassmorphism card effect") 를 호출한다
  Then "style" 도메인이 반환된다
  When detectDomain("form validation error") 를 호출한다
  Then "ux" 도메인이 반환된다
```
**Verification**: SPEC AC — "glassmorphism" → style, "form validation" → ux 라우팅

### Scenario 10: SearchService — LRU 캐시
```gherkin
Scenario: 동일 쿼리 재실행 시 캐시에서 반환한다
  Given SearchService가 초기화되었다
  When search("dashboard layout", "style", 3) 를 2회 연속 호출한다
  Then 두 번째 호출은 캐시에서 반환된다
  And 두 결과는 동일하다
```
**Verification**: SPEC AC — LRU 캐시 동작

### Scenario 11: SearchService — 쿼리 sanitize
```gherkin
Scenario: 긴 쿼리가 200자로 제한된다
  Given SearchService가 초기화되었다
  When 300자 길이의 쿼리로 search() 를 호출한다
  Then 쿼리가 200자로 잘려서 검색된다
  And 에러 없이 결과가 반환된다
```
**Verification**: SPEC AC — 쿼리 sanitize (200자 제한)

### Scenario 12: DesignSystemGenerator — 전체 파이프라인
```gherkin
Scenario: 5단계 파이프라인으로 디자인 시스템을 생성한다
  Given CSV 데이터가 로드되었다
  When generate("SaaS dashboard", "my-project") 를 호출한다
  Then DesignSystem 객체가 생성된다
  And category 필드가 "SaaS (General)" 이다
  And css_variables 에 --color-primary 가 포함된다
  And anti_patterns 배열이 비어있지 않다
```
**Verification**: SPEC AC — MASTER.md 포맷 출력

### Scenario 13: DesignSystemGenerator — hex 코드 검증
```gherkin
Scenario: 유효하지 않은 hex 코드를 거부한다
  Given 색상 검색 결과에 "#GGGGGG" 가 포함되었다
  When buildDesignSystem() 이 실행된다
  Then 해당 색상값은 기본값으로 대체된다
  And 경고 로그가 생성된다
```
**Verification**: SPEC AC — hex 코드 검증 통과

### Scenario 14: DesignSystemGenerator — MASTER.md 파일 영속화
```gherkin
Scenario: 디자인 시스템을 MASTER.md 파일로 저장한다
  Given DesignSystem 객체가 생성되었다
  When persist(ds, "my-project") 를 호출한다
  Then .claude/vibe/design-system/my-project/MASTER.md 파일이 생성된다
  And 파일에 CSS 변수, Google Fonts URL, 안티패턴이 포함된다
```
**Verification**: SPEC AC — 디자인 시스템 영속화

### Scenario 15: MCP 도구 등록 — 빌드 성공
```gherkin
Scenario: 4개 신규 도구가 등록되고 빌드에 성공한다
  Given src/tools/ui/index.ts 에 4개 도구가 export 되었다
  When npm run build 를 실행한다
  Then 빌드가 성공한다
  And core_ui_search, core_ui_stack_search, core_ui_generate_design_system, core_ui_persist_design_system 도구가 등록된다
```
**Verification**: SPEC AC — npm run build 성공

### Scenario 16: BM25 엔진 — 빈 문서 배열
```gherkin
Scenario: 빈 문서 배열로 fit() 후 score() 호출 시 빈 배열 반환
  Given BM25 엔진이 생성되었다
  When fit([]) 로 빈 배열을 전달한다
  And score("SaaS") 를 호출한다
  Then 빈 배열 [] 이 반환된다
  And 에러가 throw 되지 않는다
```
**Verification**: SPEC AC — BM25 빈 문서 배열 엣지케이스

### Scenario 17: 디자인 시스템 파이프라인 — 부분 실패
```gherkin
Scenario: 파이프라인 개별 단계 실패 시 나머지 단계가 계속 진행된다
  Given CSV 데이터가 로드되었다
  And color 도메인 CSV가 비어있다
  When generate("SaaS dashboard", "my-project") 를 호출한다
  Then DesignSystem 객체가 생성된다
  And color_palette 필드가 null 이다
  And 나머지 필드 (typography, layout 등) 는 정상 생성된다
```
**Verification**: SPEC AC — 파이프라인 부분 실패 처리

### Scenario 18: CSV 로더 — path traversal 방지
```gherkin
Scenario: .. 포함 경로 요청을 거부한다
  Given CsvDataLoader 가 초기화되었다
  When load("../../etc/passwd") 를 호출한다
  Then null 이 반환된다
  And console.warn 에 "Invalid path" 경고가 출력된다
```
**Verification**: SPEC AC — path traversal 방지

## Coverage
| Scenario | SPEC AC | Status |
|----------|---------|--------|
| 1 | BM25 products.csv 검색 | ⬜ |
| 2 | BOM 처리 | ⬜ |
| 3 | CSV 없을 때 graceful | ⬜ |
| 4 | "SaaS dashboard" 검색 | ⬜ |
| 5 | 빈 쿼리 | ⬜ |
| 6 | 스톱워드 전용 쿼리 | ⬜ |
| 7 | 11개 도메인 검색 | ⬜ |
| 8 | 13개 스택 검색 | ⬜ |
| 9 | 자동 도메인 감지 | ⬜ |
| 10 | LRU 캐시 | ⬜ |
| 11 | 쿼리 sanitize | ⬜ |
| 12 | 전체 파이프라인 | ⬜ |
| 13 | hex 코드 검증 | ⬜ |
| 14 | MASTER.md 영속화 | ⬜ |
| 15 | 빌드 성공 | ⬜ |
| 16 | BM25 빈 문서 배열 | ⬜ |
| 17 | 파이프라인 부분 실패 | ⬜ |
| 18 | path traversal 방지 | ⬜ |
