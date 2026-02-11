---
status: pending
phase: 1
parentSpec: _index.md
---

# SPEC: Phase 1 — 데이터 레이어 + BM25 검색 엔진

## Persona
<role>
TypeScript/Node.js 시니어 개발자. 정보 검색(IR) 알고리즘, CSV 데이터 처리, MCP 도구 시스템에 전문성 보유. 기존 VIBE 코드베이스 패턴(`src/tools/`, `src/lib/`)을 정확히 따름.
</role>

## Context
<context>
### Background
VIBE에 UI/UX 디자인 인텔리전스를 추가하기 위해, ui-ux-pro-max-skill의 24개 CSV 데이터(~1,500 rows)를 로드하고 BM25 알고리즘으로 검색하는 TypeScript 엔진이 필요함.

### 원본 Python 엔진 참조
- `ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/core.py` — BM25 클래스 (k1=1.5, b=0.75), tokenize, fit, score 메서드
- `ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/design_system.py` — 5단계 파이프라인
- 12개 검색 도메인: style, color, chart, landing, product, ux, typography, icons, react, web, prompt, ui-reasoning
- 13개 스택: html-tailwind, react, nextjs, astro, vue, nuxtjs, nuxt-ui, svelte, swiftui, react-native, flutter, shadcn, jetpack-compose

### Tech Stack
- TypeScript 5.5+, Node.js 18+
- papaparse (CSV 파싱)
- Vitest (테스트)

### Related Code
- `src/tools/ui/previewUiAscii.ts` — 기존 UI 도구 패턴
- `src/tools/ui/index.ts` — UI 도구 export
- `src/types/tool.ts` — 도구 타입 정의
- `src/lib/FrameworkDetector.ts` — 프레임워크 감지 (스택 가이드 연동)

### 리서치 인사이트 (GPT/Gemini/Kimi 종합)
- **BM25 구현**: NFKC 정규화 → 소문자 → 토큰화 → 스톱워드 제거. IDF 사전 계산, avgdl 캐싱
- **CSV 파싱**: RFC 4180 준수, BOM 처리, 멀티라인 quoted fields 지원
- **보안**: 검색 쿼리 길이 200자 제한, 토큰 수 20개 제한, hex 값 정규식 검증 `/^#[0-9A-Fa-f]{6}$/`
- **캐싱**: LRU Query Cache (L1: 쿼리→결과, L2: 토큰→포스팅리스트)
- **엣지케이스**: 빈 쿼리, 스톱워드만 있는 쿼리, BOM 헤더, 빈 CSV
</context>

## Task
<task>
### Phase 1-1: CSV 데이터 로더
1. [ ] `src/lib/ui-ux/CsvDataLoader.ts` 생성
   - papaparse로 CSV 파싱 (header: true, skipEmptyLines: true, transformHeader로 trim)
   - BOM 자동 제거
   - 도메인별 CSV 매핑 (12개 도메인 + 13개 스택). 도메인→파일 매핑: react → react-performance.csv
   - 글로벌 경로 `~/.claude/vibe/ui-ux-data/` 자동 탐색
   - 데이터 없을 시 `null` 반환 (에러 throw 안 함)
   - Verify: 유닛테스트 — 샘플 CSV 파싱 확인 (`tests/fixtures/ui-ux-data/` 테스트 픽스처 사용)
   - `null` 반환 시 SearchService는 빈 `SearchResult` (count=0, results=[]) 반환

2. [ ] `tests/fixtures/ui-ux-data/` 테스트 픽스처 생성
   - 도메인당 5~10행 미니 CSV (products, styles, colors, typography, ux-guidelines, web-interface, landing, charts, icons, react-performance, prompt, ui-reasoning)
   - 스택 가이드 1개 (nextjs.csv, 5행)
   - 빈 CSV, BOM 포함 CSV, 잘못된 헤더 CSV (엣지케이스 테스트용)
   - 기대 BM25 점수 벡터: "SaaS dashboard" 쿼리 → products fixture에서 Top-1 결과 확인 (순위 기반, `toBeCloseTo` 허용)

3. [ ] `src/lib/ui-ux/types.ts` 생성
   - CSV 행별 TypeScript 인터페이스 정의
   - `StyleRow`, `ColorRow`, `TypographyRow`, `UiReasoningRow`, `UxGuidelineRow`, `WebInterfaceRow`, `LandingRow`, `ChartRow`, `IconRow`, `ProductRow`, `ReactPerfRow`
   - `StackGuidelineRow` (13개 스택 공통)
   - `SearchDomain` 타입 (12개 도메인 union: style, color, chart, landing, product, ux, typography, icons, react, web, prompt, ui-reasoning)
   - `StackName` 타입 (13개 스택 union)
   - `SearchResult<T>` 제네릭 (domain, query, file, count, results)
   - `DesignSystem` 인터페이스 (5단계 파이프라인 출력)
   - `DecisionRules` 인터페이스 (JSON Decision_Rules 파싱 결과)
   - Verify: tsc 컴파일 에러 없음

### Phase 1-2: BM25 검색 엔진
3. [ ] `src/lib/ui-ux/Bm25Engine.ts` 생성
   - `tokenize(text: string): string[]` — NFKC 정규화 → 소문자 → `/[a-z0-9가-힣]+/g` 매칭 → 2글자 이상 필터
   - **Stopwords 목록**: `src/lib/ui-ux/constants.ts`에 정의 — 영문 80개 (the, a, an, is, are, ...) + 한글 20개 (은, 는, 이, 가, ...)
   - `fit(documents: string[]): void` — IDF 사전 계산 (IDF = log((N - df + 0.5) / (df + 0.5) + 1)), avgdl 캐싱
   - `score(query: string): Array<{index: number; score: number}>` — BM25 스코어링 (k1=1.5, b=0.75)
   - 빈 쿼리 → 빈 배열 반환
   - 스톱워드만 있는 쿼리 → 빈 배열 반환
   - Verify: 유닛테스트 — 알려진 점수와 비교

4. [ ] `src/lib/ui-ux/SearchService.ts` 생성
   - `search(query: string, domain?: SearchDomain, maxResults?: number): SearchResult` — 메인 검색 (maxResults 기본값: 10, 상한: 50)
   - `searchStack(query: string, stack: StackName, maxResults?: number): SearchResult` — 스택 검색 (maxResults 기본값: 10, 상한: 50)
   - `detectDomain(query: string): SearchDomain` — 키워드 기반 자동 도메인 감지 (`src/lib/ui-ux/constants.ts`에 키워드→도메인 맵 정의, 기본 도메인: "product")
   - 도메인별 검색 컬럼 매핑 (원본 core.py SEARCH_COLUMNS 동일)
   - **도메인별 BM25 인스턴스**: `Map<SearchDomain, Bm25Engine>` — 도메인 최초 검색 시 해당 CSV 로드 + fit() (Lazy Init)
   - **Hot Cache**: products.csv, ui-reasoning.csv는 모듈 초기화 시 선행 로드 (에이전트 빈번 사용)
   - **Lazy Load**: 나머지 10개 도메인은 최초 검색 요청 시 로드 후 메모리 보관
   - LRU Cache (maxSize: 100, TTL: 5분, 캐시 키: `${type}:${query}:${domainOrStack}:${maxResults}` — type은 "domain" 또는 "stack")
   - 쿼리 sanitize: 길이 200자 제한, 토큰 20개 제한
   - BM25 정렬: score 내림차순, 동점 시 원본 행 인덱스 오름차순 (결정론적)
   - Verify: 유닛테스트 — 12개 도메인 각각 검색 결과 확인

### Phase 1-3: 디자인 시스템 생성기
5. [ ] `src/lib/ui-ux/DesignSystemGenerator.ts` 생성
   - 5단계 파이프라인 (원본 design_system.py 포팅):
     1. `detectCategory(query)` — product 검색 → 카테고리 추출
     2. `applyReasoning(category)` — ui-reasoning.csv → Decision_Rules JSON 파싱, style_priority, anti_patterns
     3. `multiDomainSearch(query, stylePriority)` — style/color/landing/typography 병렬 검색
     4. `selectBestMatch(results, priority)` — 우선순위 스코어링 (Exact +10, Keyword +3, Other +1)
     5. `buildDesignSystem(matches)` — 통합 DesignSystem 객체 생성
   - `formatMarkdown(ds: DesignSystem): string` — MASTER.md 마크다운 생성
   - `formatPageOverride(ds, pageName, pageQuery): string` — 페이지 오버라이드 생성
   - `persist(ds, projectName, page?)` — 파일 시스템 영속화 (outputDir 고정: `.claude/vibe/design-system/{projectName}/`, projectName 검증: `/^[a-zA-Z0-9_-]{1,50}$/` + Windows 예약명 차단 (CON, NUL 등), page 검증: `/^[a-zA-Z0-9_-]{1,30}$/`)
   - CSS 변수 생성 시 값 escape (자체 `escapeCssValue()` 유틸리티 — Node.js에 `CSS.escape()` 미존재하므로 직접 구현)
   - hex 코드 검증: `/^#[0-9A-Fa-f]{6}$/`
   - Verify: 유닛테스트 — "SaaS dashboard" 쿼리로 전체 파이프라인 동작 확인

### Phase 1-4: MCP 도구 등록
6. [ ] `src/tools/ui/index.ts` 수정 — 4개 신규 도구 export 추가
   - `core_ui_search` — BM25 검색 (11개 도메인)
   - `core_ui_stack_search` — 프레임워크별 검색 (13개 스택)
   - `core_ui_generate_design_system` — 5단계 디자인 시스템 생성
   - `core_ui_persist_design_system` — MASTER.md + 페이지 오버라이드 저장
   - 기존 `core_preview_ui_ascii` 도구와 공존
   - Verify: `npm run build` 성공
</task>

## Constraints
<constraints>
- 외부 의존성: papaparse만 추가 (다른 BM25 라이브러리 사용 금지 — 자체 구현)
- Python 코드 참조만 하고, 실행하지 않음 (완전 TS 포팅)
- 기존 `src/tools/ui/previewUiAscii.ts` 수정 금지
- CSV 데이터는 런타임에 2개 허용 경로에서 읽음: ① `os.homedir()/.claude/vibe/ui-ux-data/` (글로벌, 우선), ② 패키지 내 `dist/vibe/ui-ux-data/` (fallback). 두 경로 모두 path traversal 검증 적용
- 검색 쿼리 입력: 최대 200자, 토큰 20개
- 모든 함수에 명시적 반환 타입
- `any` 타입 사용 금지
- 30줄 이하 함수 권장, 50줄 이하 허용
- BM25 검색 응답 시간: 단일 도메인 검색 100ms 이하 (1,500행 기준)
- CSV 로드 에러 시 `null` 반환 + `console.warn` 경고 메시지 출력 (에러 throw 금지)
- BM25 `fit()`에 빈 배열 전달 시: avgdl=0 처리, `score()` 호출 시 빈 배열 반환
- 디자인 시스템 파이프라인 부분 실패: 개별 단계 실패 시 해당 섹션만 `null` 처리, 나머지 단계 계속 진행
- CSV 경로 검증: `~/.claude/vibe/ui-ux-data/` 기본 경로에서만 파일 로드, `..` 포함 경로 거부 (path traversal 방지)
- 전체 디자인 시스템 생성 E2E 지연: 1,500행 기준 500ms 이하
- 메모리 한도: CSV 데이터 전체 메모리 상주 시 50MB 이하
</constraints>

## Output Format
<output_format>
### Files to Create
- `src/lib/ui-ux/types.ts` — 타입 정의
- `src/lib/ui-ux/CsvDataLoader.ts` — CSV 파싱
- `src/lib/ui-ux/Bm25Engine.ts` — BM25 알고리즘
- `src/lib/ui-ux/SearchService.ts` — 검색 서비스
- `src/lib/ui-ux/DesignSystemGenerator.ts` — 5단계 생성기
- `src/lib/ui-ux/index.ts` — 모듈 export

### Files to Modify
- `src/tools/ui/index.ts` — 4개 도구 추가
- `package.json` — papaparse 의존성 추가

### Verification Commands
- `npx vitest run src/lib/ui-ux/`
- `npm run build`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] BM25 엔진이 "SaaS dashboard" 쿼리로 products.csv에서 관련 결과 반환
- [ ] 12개 도메인 전부 검색 가능 (style, color, chart, landing, product, ux, typography, icons, react, web, prompt, ui-reasoning)
- [ ] 13개 스택 전부 검색 가능
- [ ] 자동 도메인 감지가 "glassmorphism" → style, "form validation" → ux 로 정확히 라우팅
- [ ] 디자인 시스템 생성기가 MASTER.md 포맷 출력 (CSS 변수, 컴포넌트 스펙, 안티패턴 포함)
- [ ] 페이지 오버라이드 생성 (Dashboard, Checkout 등 페이지 타입 감지)
- [ ] hex 코드 검증 통과 (유효하지 않은 색상값 거부)
- [ ] 빈 쿼리, 스톱워드 전용 쿼리 등 엣지케이스 처리
- [ ] LRU 캐시 동작 (동일 쿼리 2회 실행 시 캐시 히트)
- [ ] `npm run build` 성공
- [ ] CSV 데이터 없을 때 graceful 처리 (에러 없이 빈 결과)
- [ ] BM25 `fit([])` 후 `score()` 호출 시 빈 배열 반환 (크래시 없음)
- [ ] 디자인 시스템 파이프라인 개별 단계 실패 시 나머지 단계 계속 진행
- [ ] `..` 포함 CSV 경로 요청 시 거부 (path traversal 방지)
</acceptance>
