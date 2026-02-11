# my-claude-code-asset (CCPP) 분석 및 도입 추천 리포트

## Overview

- **분석일**: 2026-02-04
- **대상 레포**: `my-claude-code-asset` (Claude Code Power Pack v0.3.0)
- **현재 프로젝트**: `@su-record/core` v0.0.12
- **레포 설명**: Boris Cherny(Claude Code 창시자) 팁 + skills.sh 해커톤 우승작 기반 올인원 플러그인

## CCPP 레포 구조 요약

| 카테고리 | 수량 | 내용 |
|---------|------|------|
| Skills | 30개 | 워크플로우 13 + 기술 10 + E2E/Stitch 5 + 이미지 1 + etc |
| Agents | 8개 | architect, code-reviewer, frontend-developer, junior-mentor, planner, security-reviewer, stitch-developer, tdd-guide |
| Rules | 5개 | coding-style, git-workflow, performance, security, testing |
| 기타 | settings.json, install.sh, .claude-plugin/ |

---

## 비교 분석

### 1. Skills 비교

| 주제 | vibe (현재) | CCPP | 평가 |
|------|-----------|------|------|
| Frontend | frontend-design.md (1개) | frontend, react-patterns, shadcn-ui, tailwind-design-system, ui-ux-pro-max, vercel-react-best-practices (6개) | CCPP 압도적 |
| E2E Testing | e2e-commerce.md | e2e-agent-browser | CCPP가 더 범용적 |
| Git Workflow | git-worktree.md | commit-push-pr | 상호보완 |
| Python | - | async-python-patterns, python-testing-patterns, fastapi-templates (3개) | CCPP 고유 |
| TypeScript | - | typescript-advanced-types | CCPP 고유 |
| API Design | - | api-design-principles (REST + GraphQL 포함) | CCPP 고유 |
| TDD | - | tdd | CCPP 고유 |
| Tech Debt | - | techdebt | CCPP 고유 |
| Context 관리 | context7-usage.md | compact-guide, handoff | CCPP가 더 체계적 |
| 이미지 생성 | - | nano-banana (Gemini CLI) | CCPP 고유 |
| Stitch 통합 | - | stitch-design-md, stitch-enhance-prompt, stitch-loop, stitch-react (4개) | CCPP 고유 |
| Commerce | commerce-patterns.md, e2e-commerce.md | - | vibe 고유 |
| SEO | seo-checklist.md | - | vibe 고유 |
| Brand | brand-assets.md | - | vibe 고유 |

### 2. Agents 비교

| 역할 | vibe (현재) | CCPP | 차이점 |
|------|-----------|------|--------|
| Architecture | architect (high/med/low 3티어) | architect (Opus 단일) | vibe: 비용 최적화 티어 시스템 |
| Implementation | implementer (3티어) | - | vibe 고유 |
| Frontend | - | frontend-developer (Sonnet) | CCPP: Stripe/Vercel 수준 UI 전문 |
| Code Review | 12개 전문 리뷰어 (framework별) | code-reviewer (Opus, 통합) | vibe: 세분화, CCPP: 통합 |
| Security | security (리뷰 에이전트 내) | security-reviewer (Opus, 독립) | CCPP: 독립 에이전트로 더 상세 |
| Planning | - | planner (Opus) | CCPP 고유 |
| Junior Mentor | - | junior-mentor (Sonnet) | CCPP 고유: EXPLANATION.md 생성 |
| TDD | - | tdd-guide (Sonnet) | CCPP 고유 |
| Stitch | - | stitch-developer (Sonnet) | CCPP 고유 |
| Explorer | explorer (3티어) | - | vibe 고유 |
| Searcher | searcher (Haiku) | - | vibe 고유 |
| Build Error | build-error-resolver | - | vibe 고유 |
| Refactor | refactor-cleaner | - | vibe 고유 |
| Simplifier | simplifier | - | vibe 고유 |
| Compounder | compounder | - | vibe 고유 |
| Diagrammer | diagrammer | - | vibe 고유 |
| E2E Tester | e2e-tester | - | vibe 고유 |
| UI Previewer | ui-previewer | - | vibe 고유 |

### 3. Rules 비교

| 주제 | vibe/core/rules/ | CCPP/rules/ | 상태 |
|------|-----------------|-------------|------|
| 코드 구조 | code-structure.md | coding-style.md | 중복 (vibe가 더 상세) |
| 테스팅 | testing-strategy.md, bdd-contract-testing.md | testing.md | 중복 (vibe가 더 상세) |
| 복잡도 | complexity-metrics.md | (coding-style에 포함) | vibe가 독립 문서 |
| 네이밍 | naming-conventions.md | (coding-style에 포함) | vibe가 독립 문서 |
| 안티패턴 | anti-patterns.md | (coding-style에 포함) | vibe가 독립 문서 |
| Git Workflow | - | git-workflow.md | CCPP 고유 |
| Performance | - | performance.md | CCPP 고유 |
| Security | - | security.md | CCPP 고유 |
| 커뮤니케이션 | communication-guide.md | - | vibe 고유 |
| 개발철학 | development-philosophy.md | - | vibe 고유 |

---

## 도입 추천 항목

### Priority 1 (High) - 즉시 도입 권장

#### 1-1. `handoff` 스킬
- **이유**: vibe는 context 관리 시 `/vibe.utils --continue`로 세션을 이어가지만, HANDOFF.md를 생성하는 명시적 핸드오프 메커니즘이 없음
- **가치**: context 80-100k 도달 시 체계적인 세션 인계 문서 생성
- **도입 방법**: `skills/handoff/` 디렉토리 생성 후 SKILL.md 내용을 vibe 형식으로 변환
- **난이도**: 낮음 (마크다운 파일 추가)

#### 1-2. `vercel-react-best-practices` 스킬 (52개 최적화 룰)
- **이유**: 현재 vibe의 frontend-design.md는 UI 디자인 중심. 성능 최적화 패턴이 부재
- **가치**: React/Next.js 프로젝트에서 번들 최적화, 서버 사이드 캐싱, 리렌더 최적화 등 52개 구체적 패턴 제공
- **도입 방법**: skills/ 또는 languages/typescript-react.md에 통합
- **난이도**: 중간 (52개 룰 파일 → 기존 포맷에 맞게 재구성 필요)

#### 1-3. `security` 규칙
- **이유**: vibe/core/rules/에 보안 전용 규칙 파일이 없음
- **가치**: SQL injection, XSS, CSRF, 시크릿 관리, 보안 인시던트 대응 프로토콜
- **도입 방법**: `core/rules/standards/security.md` 추가
- **난이도**: 낮음

#### 1-4. `performance` 규칙
- **이유**: vibe/core/rules/에 성능 관련 규칙이 없음
- **가치**: React memoization, 번들 최적화, DB 쿼리 최적화, API 캐싱 가이드
- **도입 방법**: `core/rules/quality/performance.md` 추가
- **난이도**: 낮음

### Priority 2 (Medium) - 검토 후 도입

#### 2-1. `junior-mentor` 에이전트
- **이유**: vibe에는 학습/설명 목적의 에이전트가 없음
- **가치**: EXPLANATION.md 자동 생성, 비유 기반 설명, 주니어 개발자 온보딩
- **도입 방법**: `agents/junior-mentor.md` 추가
- **고려사항**: vibe의 에이전트 티어 시스템(Haiku/Sonnet/Opus)에 맞게 Sonnet 레벨로 배치

#### 2-2. `techdebt` 스킬
- **이유**: vibe에 기술 부채 정리 전용 워크플로우가 없음
- **가치**: 중복 코드, 미사용 import, debug 코드, any 타입, 매직 넘버 자동 탐지 + 자동 수정
- **도입 방법**: `skills/techdebt.md` 추가 또는 `/vibe.review`에 techdebt 모드 통합
- **난이도**: 중간

#### 2-3. `commit-push-pr` 스킬
- **이유**: vibe에는 커밋→푸시→PR 원스텝 워크플로우가 없음
- **가치**: 한국어 커밋 메시지 자동 생성, `gh pr create` 통합, Co-Authored-By 자동 추가
- **도입 방법**: `skills/commit-push-pr.md` 추가 또는 `/commit` 커맨드로 통합
- **난이도**: 낮음

#### 2-4. `typescript-advanced-types` 스킬
- **이유**: vibe의 TypeScript 규칙은 `any` 차단 위주. 고급 타입 패턴 가이드 부재
- **가치**: Generics, Conditional Types, Mapped Types, Template Literals, 6개 실전 패턴
- **도입 방법**: `skills/typescript-advanced-types.md` 추가
- **난이도**: 낮음

#### 2-5. `git-workflow` 규칙
- **이유**: vibe/core/rules/에 Git 워크플로우 규칙이 없음
- **가치**: 브랜치 전략, Conventional Commits, PR 체크리스트, 금지 사항
- **도입 방법**: `core/rules/standards/git-workflow.md` 추가
- **난이도**: 낮음

### Priority 3 (Low) - 선택적 도입

#### 3-1. `ui-ux-pro-max` 스킬
- **이유**: 50+ 스타일, 97개 컬러 팔레트, 57개 폰트 페어링의 대규모 디자인 인텔리전스
- **가치**: 현재 vibe의 frontend-design.md보다 훨씬 방대한 UI/UX 레퍼런스
- **고려사항**: Python 스크립트(search.py, core.py) + 23개 CSV 데이터 파일 포함. 통합 복잡도 높음
- **난이도**: 높음

#### 3-2. `react-patterns` 스킬
- **이유**: React 19 Server Components, Actions, use() hook 등 최신 패턴
- **가치**: React 18→19 마이그레이션 가이드, React Compiler 패턴
- **도입 방법**: `skills/react-patterns.md` 추가
- **난이도**: 낮음

#### 3-3. `api-design-principles` 스킬
- **이유**: REST + GraphQL 비교, HATEOAS, DataLoader 패턴
- **가치**: API 설계 시 참조 가이드
- **도입 방법**: `skills/api-design-principles.md` 추가
- **난이도**: 낮음

#### 3-4. `compact-guide` 스킬
- **이유**: vibe는 이미 자체 context 관리 시스템이 있으나, CCPP의 패턴이 보완적
- **가치**: `작업→/compact→(3회 반복)→/handoff→/clear` 명시적 패턴
- **도입 방법**: 기존 context-save.js 훅과 통합
- **난이도**: 낮음

### 도입 비추천 항목

| 항목 | 이유 |
|------|------|
| `stitch-*` 스킬 4개 | Stitch MCP 의존. vibe 사용자 대부분에게 불필요 |
| `nano-banana` 스킬 | Gemini CLI 의존. 범용성 낮음 |
| `frontend` 스킬 | vibe의 frontend-design.md와 기능 중복 |
| `plan` 스킬 | vibe의 Plan Mode + `/vibe.spec`으로 이미 커버 |
| `spec` / `spec-verify` 스킬 | vibe의 `/vibe.spec` + `/vibe.verify`로 이미 커버 |
| `review` / `simplify` / `build-fix` 스킬 | vibe의 에이전트 + `/vibe.review`로 이미 커버 |
| `verify` / `tdd` 스킬 | vibe의 quality gate + 테스트 전략으로 이미 커버 |
| `e2e-agent-browser` 스킬 | `agent-browser` CLI 의존. vibe는 Playwright 기반 E2E 보유 |
| `shadcn-ui` 스킬 | 특정 UI 라이브러리 전용. 범용 프레임워크에서는 과도한 특수화 |
| `settings.json` | vibe 자체 hooks 시스템과 충돌. WebSearch/WebFetch deny 정책 불일치 |
| `coding-style.md` 규칙 | vibe의 code-structure.md + complexity-metrics.md로 이미 커버 |
| `testing.md` 규칙 | vibe의 testing-strategy.md + bdd-contract-testing.md로 이미 커버 |

---

## 도입 영향도 분석

### 도입 시 예상 효과

| 영역 | 현재 상태 | 도입 후 개선 |
|------|---------|------------|
| 보안 | 규칙 없음 | security.md로 보안 체크리스트 자동화 |
| 성능 | 규칙 없음 | performance.md + vercel-react로 최적화 패턴 확보 |
| 세션 관리 | /vibe.utils --continue (자동) | + handoff (명시적 인계 문서) |
| Git 워크플로우 | 규칙 없음 | git-workflow.md로 브랜치 전략/커밋 규칙 표준화 |
| 코드 정리 | /vibe.review (리뷰 중심) | + techdebt (자동 탐지 + 자동 수정) |
| 학습 지원 | 없음 | junior-mentor로 주니어 온보딩 지원 |
| TypeScript | any 차단 규칙만 | + 고급 타입 패턴 가이드 |
| React 최적화 | frontend-design (디자인 중심) | + 52개 성능 최적화 패턴 |

### 도입 복잡도 추정

| Priority | 항목 수 | 파일 변경 | 코드 변경 필요 |
|----------|---------|----------|---------------|
| P1 (High) | 4개 | 마크다운 추가 | 없음 |
| P2 (Medium) | 5개 | 마크다운 + 에이전트 추가 | 없음~최소 |
| P3 (Low) | 4개 | 마크다운 추가 | 없음~최소 |

---

## 요약

CCPP는 **워크플로우 스킬**과 **프론트엔드 기술 스킬**에서 강점을 보이며, vibe는 **에이전트 시스템**, **다국어 지원**, **도구 자동화**에서 강점을 보입니다.

**가장 가치 높은 도입 항목 Top 5:**

1. `security` 규칙 — 현재 vibe에 가장 큰 공백
2. `performance` 규칙 — 현재 vibe에 두 번째로 큰 공백
3. `vercel-react-best-practices` — 52개 구체적 최적화 패턴
4. `handoff` 스킬 — 세션 인계 체계화
5. `git-workflow` 규칙 — Git 워크플로우 표준화
