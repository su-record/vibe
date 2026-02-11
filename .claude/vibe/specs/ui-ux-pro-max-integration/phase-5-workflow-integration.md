---
status: pending
phase: 5
parentSpec: _index.md
depends: [phase-1-data-engine, phase-2-spec-agents, phase-3-run-agents, phase-4-review-agents]
---

# SPEC: Phase 5 — 워크플로우 통합 + 데이터 배포

## Persona
<role>
DevOps + 프레임워크 통합 엔지니어. CLI 도구 설계, 데이터 배포 파이프라인, 에이전트 오케스트레이션에 전문성 보유. 기존 VIBE CLI(`src/cli/`) 패턴을 정확히 따름.
</role>

## Context
<context>
### Background
Phase 1~4에서 만든 데이터 엔진, 8개 에이전트를 `/vibe.spec`, `/vibe.run`, `/vibe.review` 워크플로우에 자연스럽게 통합하고, CSV 데이터를 사용자 환경에 배포하는 메커니즘 필요.

### 기존 워크플로우 구조
- `/vibe.spec` — SPEC 생성 (skills/vibe.spec/)
- `/vibe.run` — 구현 실행 (skills/vibe.run/)
- `/vibe.review` — 코드 리뷰 (skills/vibe.review/)
- `vibe update` — CLI 업데이트 명령어 (src/cli/)

### 에이전트 배치 요약
| Phase | 에이전트 | 실행 시점 |
|-------|---------|----------|
| SPEC | ①②③ | /vibe.spec 리서치 후 |
| RUN | ④⑤ | /vibe.run Phase 시작 전 |
| REVIEW | ⑥⑦⑧ | /vibe.review 실행 시 |

### 데이터 배포 경로
- 소스: `ui-ux-pro-max-skill/src/ui-ux-pro-max/data/*.csv` (24개 파일)
- 대상: `~/.claude/vibe/ui-ux-data/` (글로벌)
- 생성물: `.claude/vibe/design-system/{project}/MASTER.md` (프로젝트별)

### Related Code
- `src/cli/index.ts` — CLI 엔트리포인트
- `src/cli/postinstall.js` — npm 설치 후 자동 실행
- `skills/` — 스킬 디렉토리
- `agents/` — 에이전트 디렉토리
</context>

## Task
<task>
### Phase 5-1: CSV 데이터 배포 메커니즘
1. [ ] `vibe update` 명령어 확장 — UI/UX 데이터 동기화
   - npm 패키지의 `vibe/ui-ux-data/` → `~/.claude/vibe/ui-ux-data/` 복사
   - 24개 CSV 파일 + 13개 스택 가이드 CSV
   - 버전 체크: `~/.claude/vibe/ui-ux-data/version.json` 비교
   - 신규 설치 시 자동 복사 (postinstall)
   - 업데이트 시 변경된 파일만 복사 (delta sync — SHA-256 해시 비교 기반)
   - `os.homedir()` + `path.join()` 사용 (크로스 플랫폼 경로 해석, `~` 직접 사용 금지)
   - CsvDataLoader 런타임 fallback: 글로벌 경로에 데이터 없으면 패키지 내 `dist/vibe/ui-ux-data/`에서 직접 로드
2. [ ] `package.json` files 배열에 `vibe/ui-ux-data/` 추가
   - npm publish 시 CSV 데이터 포함
3. [ ] 데이터 무결성 검증
   - 복사 후 파일 수 확인 (24 + 13 = 37개)
   - 각 CSV 헤더 검증 (필수 컬럼 존재 확인 — `version.json`에 `schema` 필드로 파일별 필수 컬럼 정의)
   - `version.json` 구조: `{ version: "1.0.0", schema_version: "1", files: { "products.csv": ["No","Product_Type","Keywords",...], ... } }`

### Phase 5-2: /vibe.spec 워크플로우 연동
4. [ ] `/vibe.spec` 스킬에서 UI/UX 프로젝트 감지 시 ①②③ 자동 호출
   - **트리거 키워드**: website, landing, dashboard, app, e-commerce, portfolio, SaaS, mobile app, web app, UI, UX, frontend, 디자인
   - **실행 순서**:
     1. 기존 리서치 (GPT/Gemini/Kimi + Claude 에이전트) 병렬
     2. ① ui-industry-analyzer 실행 (supervisor)
     3. ②③ 병렬 실행 (①의 결과 입력)
     4. 결과를 SPEC의 `<context>` 섹션에 `### Design System` 하위로 주입
   - **결과 주입 형식**:
     ```
     ### Design System (Auto-generated)
     - Category: {①의 category}
     - Style: {①의 style_priority}
     - MASTER.md: {②의 출력 경로}
     - Layout: {③의 pattern + sections}
     ```
5. [ ] UI/UX 감지 OFF 옵션
   - `.claude/vibe/config.json`에 `"uiUxAnalysis": false` 설정 시 비활성화

### Phase 5-3: /vibe.run 워크플로우 연동
6. [ ] `/vibe.run` 스킬에서 Phase 시작 전 ④⑤ 자동 실행
   - ④ ui-stack-implementer: 항상 실행 (FrameworkDetector 결과 활용)
   - ⑤ ui-dataviz-advisor: 조건부 실행 (SPEC에 차트/대시보드/시각화 키워드)
   - 결과를 구현 에이전트의 시스템 프롬프트 컨텍스트에 주입
7. [ ] 디자인 시스템 자동 참조
   - `.claude/vibe/design-system/{project}/MASTER.md` 존재 시 자동 로드
   - 구현 에이전트가 CSS 변수, 폰트, 색상 팔레트를 직접 참조
   - 페이지별 오버라이드 `pages/{page}.md` 존재 시 우선 적용

### Phase 5-4: /vibe.review 워크플로우 연동
8. [ ] `/vibe.review` 스킬에서 ⑥⑦⑧ 자동 실행
   - **활성화 조건**: 변경된 파일 중 UI 파일 존재 (`.tsx`, `.jsx`, `.vue`, `.svelte`, `.html`, `.css`, `.scss`)
   - 기존 13개 리뷰 에이전트와 병렬 실행
   - findings 통합: 기존 findings[] + ⑥⑦⑧ findings[] 병합
   - P1/P2/P3 우선순위 통합 정렬
9. [ ] Review Debate Team 연동 (Agent Teams 실험적)
   - ⑦ ui-a11y-auditor의 Critical finding은 Review Debate Team에 자동 에스컬레이션
   - security-reviewer와 교차 검증 (보안 + 접근성 교차점)

### Phase 5-5: 에이전트 등록 + 문서화
10. [ ] `agents/ui/` 디렉토리에 8개 에이전트 MD 파일 등록 확인
    - ui-industry-analyzer.md (①)
    - ui-design-system-gen.md (②)
    - ui-layout-architect.md (③)
    - ui-stack-implementer.md (④)
    - ui-dataviz-advisor.md (⑤)
    - ux-compliance-reviewer.md (⑥)
    - ui-a11y-auditor.md (⑦)
    - ui-antipattern-detector.md (⑧)
11. [ ] `CLAUDE.md` 업데이트 — UI/UX 에이전트 섹션 추가
    - Agents 섹션에 `### UI/UX Agents (8)` 추가
    - 에이전트 목록 + 실행 시점 설명
</task>

## Constraints
<constraints>
- 기존 `/vibe.spec`, `/vibe.run`, `/vibe.review` 스킬의 핵심 로직 수정 최소화
- UI/UX 분석을 원치 않는 프로젝트를 위한 비활성화 옵션 필수
- CSV 데이터 배포는 npm 패키지 사이즈에 영향 — 총 CSV 크기 500KB 이하 확인
- `vibe update` 기존 기능 깨지지 않음 (하위 호환)
- 에이전트 MD 파일은 기존 agents/ 패턴 준수
</constraints>

## Output Format
<output_format>
### Files to Create
- `vibe/ui-ux-data/version.json` — 데이터 버전 메타
- `vibe/ui-ux-data/*.csv` — 24 + 13 CSV 데이터 (패키지 포함)

### Files to Modify
- `src/cli/index.ts` — `vibe update` 확장
- `src/cli/postinstall.js` — 자동 데이터 복사
- `package.json` — files 배열 업데이트
- `CLAUDE.md` — UI/UX 에이전트 문서
- 스킬 파일들 — ①~⑧ 호출 로직

### Verification Commands
- `vibe update` 실행 → `~/.claude/vibe/ui-ux-data/` 37개 파일 존재 확인
- `/vibe.spec "landing page"` → ①②③ 자동 실행 확인
- `/vibe.run "dashboard"` → ④⑤ 자동 실행 확인
- `/vibe.review` → UI 파일 변경 시 ⑥⑦⑧ 실행 확인
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] `vibe update` 실행 → `~/.claude/vibe/ui-ux-data/` 에 37개 CSV 파일 복사
- [ ] 신규 설치(postinstall) 시 자동 데이터 복사
- [ ] 데이터 버전 체크 → 변경 시에만 업데이트
- [ ] `/vibe.spec` UI 키워드 감지 → ①②③ 자동 실행
- [ ] `/vibe.spec` 비-UI 프로젝트 → ①②③ 비활성
- [ ] `/vibe.run` → ④ 항상 실행, ⑤ 조건부 실행
- [ ] `/vibe.run` → MASTER.md 자동 참조
- [ ] `/vibe.review` UI 파일 변경 → ⑥⑦⑧ 실행
- [ ] `/vibe.review` UI 파일 미변경 → ⑥⑦⑧ 비활성
- [ ] findings 통합 → P1/P2/P3 정렬
- [ ] `config.json` `"uiUxAnalysis": false` → 전체 비활성화
- [ ] CLAUDE.md에 UI/UX 에이전트 섹션 추가
- [ ] npm 패키지 사이즈 500KB 이하 증가
</acceptance>
