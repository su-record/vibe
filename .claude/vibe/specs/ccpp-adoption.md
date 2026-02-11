# SPEC: ccpp-adoption

## Metadata

| Field | Value |
|-------|-------|
| SPEC ID | ccpp-adoption |
| Version | 1.0.0 |
| Created | 2026-02-04 |
| Branch | feature/ccpp-adoption |
| Status | Draft |
| Source | CCPP (Claude Code Power Pack) v0.3.0 |
| Target | @su-record/core v0.0.12 |

---

## <role>

CCPP 에셋 통합 전문가. CCPP(Claude Code Power Pack)에서 선별한 9개 에셋을 vibe 프로젝트의 기존 포맷과 구조에 맞게 변환하여 통합한다.

</role>

## <context>

### 배경

`@su-record/core` (vibe) 프로젝트에 보안 규칙, 성능 규칙, Git 워크플로우 규칙이 부재하며, 세션 핸드오프, 기술 부채 관리, 커밋-PR 자동화, TypeScript 고급 타입, React 성능 최적화 스킬이 없다. `my-claude-code-asset` (CCPP v0.3.0) 레포에서 이 공백을 메울 수 있는 에셋을 선별하여 vibe 포맷으로 변환 도입한다.

### 분석 결과 요약

- **분석 리포트**: `.claude/core/reports/ccpp-adoption-analysis-2026-02-04.md`
- **도입 범위**: P1 (High) 4개 + P2 (Medium) 5개 = 총 9개
- **통합 방식**: 직접 복사 후 vibe 포맷 변환
- **코드 변경**: 없음 (마크다운 에셋만 추가)

### vibe 포맷 규칙

| 에셋 유형 | 위치 (프로젝트 루트 기준) | 프론트매터 | 구조 | 기본 길이 |
|-----------|--------------------------|-----------|------|----------|
| Skill | `skills/*.md` | `description` (YAML) | Overview → Usage → Commands | 80-150줄 (레퍼런스 스킬은 예외 허용) |
| Rule | `.claude/core/rules/{core\|quality\|standards}/*.md` | 없음 | H1 제목 → 섹션 → ✅/❌ 예시 | 200-550줄 |
| Agent | `agents/*.md` | 없음 | H1 (이름 + 모델) → Role → Model → Process → Output | 40-120줄 |

### 기존 에셋 현황

| 유형 | 현재 수량 | 추가 후 |
|------|----------|---------|
| Skills | 11개 | 15개 (+4) |
| Rules | 10개 | 13개 (+3) |
| Agents | 41개 | 42개 (+1) |

</context>

## <task>

### Phase 1: Rules 추가 (P1 — 3개)

CCPP `rules/` 디렉토리의 3개 규칙 파일을 vibe 포맷으로 변환하여 추가한다.

#### 1-1. Security Rule

- **소스**: `my-claude-code-asset/rules/security.md` (35줄)
- **타겟**: `.claude/core/rules/standards/security.md`
- **변환 작업**:
  - H1 제목을 `# Security Standards` 로 변경
  - 기존 CCPP 내용(시크릿 관리, SQL Injection, XSS, CSRF)을 유지하되 확장
  - OWASP Top 10 기반 체크리스트 추가
  - ✅ Good / ❌ Bad 코드 예시 패턴 추가 (vibe rule 포맷)
  - 환경변수 관리 가이드 추가 (.env.example 패턴)
  - 의존성 보안 (`npm audit`) 가이드 추가. Snyk는 선택 사항으로 안내
  - 인증/권한 검증 패턴 추가
  - 보안 이슈 발견 시 프로토콜: security-reviewer 에이전트 호출, 심각도 분류 (Critical/High/Medium/Low), Critical은 즉시 중단 후 사용자 보고
  - **목표 길이**: 200-300줄

#### 1-2. Performance Rule

- **소스**: `my-claude-code-asset/rules/performance.md` (39줄)
- **타겟**: `.claude/core/rules/quality/performance.md`
- **변환 작업**:
  - H1 제목을 `# Performance Standards` 로 변경
  - 프론트엔드 최적화 (React memoization, 번들, 이미지) 유지 및 확장
  - 백엔드 최적화 (DB 인덱싱, N+1 방지, 캐싱) 유지 및 확장
  - 알고리즘 복잡도 가이드 (O(n²) 이상 경고)
  - Web Vitals 기준 (LCP < 2.5s, INP < 200ms, CLS < 0.1) 추가 — Google Web.dev 기준, Lighthouse 모바일 프리셋 측정
  - ✅ Good / ❌ Bad 코드 예시 패턴 추가 (vibe rule 포맷)
  - 성능 체크리스트 유지
  - **목표 길이**: 200-300줄

#### 1-3. Git Workflow Rule

- **소스**: `my-claude-code-asset/rules/git-workflow.md` (48줄)
- **타겟**: `.claude/core/rules/standards/git-workflow.md`
- **변환 작업**:
  - H1 제목을 `# Git Workflow Standards` 로 변경
  - 브랜치 전략 유지 (main → develop → feature/fix/refactor)
  - Conventional Commits 한국어 형식 유지
  - PR 체크리스트 유지 및 확장
  - 금지사항 유지 (force push, .env 커밋 등)
  - Co-Authored-By 규칙 추가
  - ✅ Good / ❌ Bad 커밋 메시지 예시 추가
  - **목표 길이**: 200-300줄

### Phase 2: Skills 추가 (P1+P2 — 5개)

CCPP `skills/` 디렉토리의 5개 스킬을 vibe 포맷으로 변환하여 추가한다.

#### 2-1. Handoff Skill (P1)

- **소스**: `my-claude-code-asset/skills/handoff/SKILL.md` (56줄)
- **타겟**: `skills/handoff.md`
- **변환 작업**:
  - YAML 프론트매터를 vibe 형식으로 변환: `description` 필드만 사용
  - HANDOFF.md 생성 로직 유지
  - vibe의 `core_auto_save_context` / `core_save_memory` 도구와 연계 안내 추가
  - 사용 시점 가이드 유지 (80-100k 토큰, /compact 3회 후)
  - `/vibe.utils --continue`와의 차이점 명시
  - **목표 길이**: 80-120줄

#### 2-2. Vercel React Best Practices Skill (P1)

- **소스**: `my-claude-code-asset/skills/vercel-react-best-practices/SKILL.md` (126줄) + `AGENTS.md` (2,517줄)
- **타겟**: `skills/vercel-react-best-practices.md`
- **변환 작업**:
  - YAML 프론트매터를 vibe 형식으로 변환
  - SKILL.md의 45개 룰 인덱스(Quick Reference)를 유지
  - 8개 카테고리별 Priority 체계 유지
  - AGENTS.md의 2,517줄 전문은 포함하지 않음 — 인덱스 + 카테고리별 핵심 요약만 포함
  - 각 카테고리에서 CRITICAL/HIGH 항목의 핵심 코드 예시만 선별 포함
  - AGENTS.md 전체 내용은 후속 SPEC에서 처리. 본 스킬 내에 "상세 규칙은 CCPP AGENTS.md 참고" 안내만 포함
  - **목표 길이**: 300-400줄 (인덱스 + 핵심 예시)
  - **별도 파일**: AGENTS.md 전문 변환 파일은 이번 SPEC 범위에 포함하지 않음. 필요 시 후속 SPEC으로 처리

#### 2-3. Techdebt Skill (P2)

- **소스**: `my-claude-code-asset/skills/techdebt/SKILL.md` (70줄)
- **타겟**: `skills/techdebt.md`
- **변환 작업**:
  - YAML 프론트매터를 vibe 형식으로 변환
  - 검사 항목 유지 (중복 코드, 미사용 import, debug 코드, 코드 품질)
  - vibe의 `core_analyze_complexity`, `core_validate_code_quality` 도구 연계 추가
  - bash 검사 명령어를 Grep/Glob 도구 기반으로 변환
  - 출력 형식 유지
  - 자동 수정 범위 유지 및 안전 가드 추가
  - **목표 길이**: 100-150줄

#### 2-4. Commit-Push-PR Skill (P2)

- **소스**: `my-claude-code-asset/skills/commit-push-pr/SKILL.md` (41줄)
- **타겟**: `skills/commit-push-pr.md`
- **변환 작업**:
  - YAML 프론트매터를 vibe 형식으로 변환
  - Conventional Commits 한국어 형식 유지
  - gh pr create 통합 유지
  - Co-Authored-By 자동 추가 유지
  - vibe의 git-workflow rule과 연계
  - 보안 파일 체크 (.env, credentials) 유지
  - main 브랜치 보호 유지
  - **목표 길이**: 80-120줄

#### 2-5. TypeScript Advanced Types Skill (P2)

- **소스**: `my-claude-code-asset/skills/typescript-advanced-types/SKILL.md` (725줄)
- **타겟**: `skills/typescript-advanced-types.md`
- **변환 작업**:
  - YAML 프론트매터를 vibe 형식으로 변환
  - 핵심 6개 패턴 유지: Generics, Conditional Types, Mapped Types, Template Literals, Utility Types, Infer
  - 각 패턴의 코드 예시 유지
  - vibe의 TypeScript 규칙 (`any` 차단)과 연계하여 대안 패턴 강조
  - 725줄 전체를 유지하되 vibe 프론트매터 추가
  - **목표 길이**: 700-750줄

### Phase 3: Agent 추가 (P2 — 1개)

#### 3-1. Junior Mentor Agent

- **소스**: `my-claude-code-asset/agents/junior-mentor.md` (306줄)
- **타겟**: `agents/junior-mentor.md`
- **변환 작업**:
  - 프론트매터 제거, vibe agent 포맷으로 변환
  - H1 제목을 `# Junior Mentor Agent (Sonnet)` 으로 변경
  - Role / Model / When to Use / Process / Output / DO / DON'T 섹션 구조로 재구성
  - EXPLANATION.md 생성 기능 유지
  - 비유 기반 설명 원칙 유지
  - nano-banana (Gemini CLI) 의존성 제거 — 대신 vibe의 `diagrammer` 에이전트 또는 `/vibe.utils --diagram` 연계
  - 시각 자료 생성 섹션은 vibe 도구 기반으로 대체
  - **목표 길이**: 80-120줄 (306줄 → 핵심만 추출)

### Phase 4: 검증

#### 4-1. 파일 존재 검증
- 9개 파일 모두 지정 경로에 존재 (Glob 도구로 확인)

#### 4-2. 포맷 검증 (자동화 가능)
- Rules: H1 제목 존재, YAML 프론트매터 없음, ✅/❌ 예시 최소 3쌍
- Skills: YAML 프론트매터 `description` 필드 존재, 섹션 헤더 존재
- Agent: 프론트매터 없음, Role/Model/Process/Output 섹션 존재

#### 4-3. 내용 검증
- 금지 키워드 탐지: `Gemini CLI`, `nano-banana`, `Stitch MCP`, `agent-browser` → 0건 (Grep 도구)
- vibe 도구 연계: 각 Skill/Rule에 최소 1개 vibe core 도구 또는 에이전트 참조 확인
- vibe 도구 존재 확인: 참조된 도구명(core_*, /vibe.utils 등)이 CLAUDE.md 또는 도구 레지스트리에 실제 존재하는지 검증
- 외부 도구 허용/비허용: 허용(`gh`, `git`, `npm audit`), 선택사항(`Snyk`), 비허용(`Gemini CLI`, `Stitch MCP`, `agent-browser`)

#### 4-4. 줄 수 검증 (참고 기준)
- 줄 수는 참고 기준이며 ±10% 허용. 핵심 기준은 섹션/체크리스트/예시 완성도

#### 4-5. 비파괴 검증
- 기존 에셋 파일 변경 없음 (git diff로 확인)
- CLAUDE.md, config.json 변경 불필요 확인

</task>

## <constraints>

### 필수 제약

1. **코드 변경 없음**: 마크다운 에셋만 추가. TypeScript/JavaScript 코드 수정 없음
2. **기존 에셋 수정 없음**: 현재 vibe의 skills/rules/agents 파일을 변경하지 않음
3. **vibe 포맷 준수**: 각 에셋 유형별 포맷 규칙 엄격 준수
4. **한국어 우선**: 모든 문서는 한국어로 작성 (코드 예시 내 주석은 영어 허용). H1 제목은 영어 허용 (예: `# Security Standards`)
5. **외부 의존성 없음**: CCPP의 Gemini CLI, Stitch MCP, agent-browser 등 외부 도구 의존 제거
6. **기존 도구 연계**: vibe 내장 도구 (core_*, MCP tools)와 연계
7. **AGENTS.md 전문 미포함**: vercel-react-best-practices의 2,517줄 AGENTS.md는 인덱스만 포함

### 품질 기준

| 기준 | 목표 |
|------|------|
| 파일 수 | 정확히 9개 |
| 포맷 준수율 | 100% |
| 한국어 비율 | 모든 설명 텍스트와 헤더는 한국어. 영어는 코드 블록, 기술 용어, 명령어 내에서만 허용 |
| 중복 내용 | 기존 vibe 에셋과 동일 문단(연속 5문장 이상) 복사 금지. 유사 내용은 리라이트하거나 링크로 대체 |

### 에러 처리

| 상황 | 처리 방법 |
|------|----------|
| CCPP 소스 파일 미존재 | 에러 로그 출력 후 해당 에셋 건너뛰기, 최종 리포트에 누락 항목 명시 |
| CCPP 소스 파일 읽기 불가 | 에러 로그 출력, 수동 확인 요청 |
| 타겟 디렉토리 미존재 | 자동 생성 (mkdir -p) |
| vibe 포맷 변환 검증 실패 | 해당 파일 재변환 시도 (최대 2회), 실패 시 수동 리뷰 요청 |
| 기존 파일과 이름 충돌 | 기존 파일 보존, 신규 파일 생성 중단, 사용자 확인 요청 |

### 확장 범위 명세

| 에셋 | 확장 항목 | 구체적 내용 |
|------|----------|------------|
| Security Rule | OWASP Top 10 (2021) 체크리스트 | 10개 전 항목(A01~A10) 포함. 각 항목별 체크리스트 3-5개 + ✅/❌ 예시 1개. 작성 시점 버전(2021)을 문서에 기록 |
| Security Rule | 환경변수 관리 | `.env.example` 패턴, 시크릿 로테이션 권장 주기(90~180일), 예외(개발 환경/관리형 키), 트리거 기반 로테이션(유출 의심/퇴사 등) |
| Security Rule | 의존성 보안 | `npm audit` 실행 가이드, 취약점 심각도별 대응 기준 |
| Security Rule | 추가 보안 영역 | 로그 마스킹/PII 처리, 세션/쿠키 플래그, 보안 헤더(CSP, HSTS), CORS 설정, 파일 업로드 제한 — 각 영역별 ✅/❌ 예시 1개 |
| Performance Rule | 프론트엔드 확장 | React.memo, useMemo, useCallback 사용 기준, 번들 크기 < 200KB (production gzip 기준, initial JS 합산, next build output 또는 bundle analyzer로 측정), 이미지 lazy loading |
| Performance Rule | 백엔드 확장 | DB 인덱스 설계 원칙 3가지, N+1 탐지 패턴, 캐싱 전략 (TTL 기준) |
| Performance Rule | 알고리즘 복잡도 | O(n²) 이상 경고, 대안 알고리즘 제시 패턴 |
| Git Workflow Rule | PR 체크리스트 확장 | 리뷰어 지정, CI 통과 확인, 코드 커버리지 확인 항목 추가 |

</constraints>

## <output_format>

### 산출물 목록

| # | 파일 경로 | 유형 | Phase |
|---|----------|------|-------|
| 1 | `.claude/core/rules/standards/security.md` | Rule | 1 |
| 2 | `.claude/core/rules/quality/performance.md` | Rule | 1 |
| 3 | `.claude/core/rules/standards/git-workflow.md` | Rule | 1 |
| 4 | `skills/handoff.md` | Skill | 2 |
| 5 | `skills/vercel-react-best-practices.md` | Skill | 2 |
| 6 | `skills/techdebt.md` | Skill | 2 |
| 7 | `skills/commit-push-pr.md` | Skill | 2 |
| 8 | `skills/typescript-advanced-types.md` | Skill | 2 |
| 9 | `agents/junior-mentor.md` | Agent | 3 |

### 디렉토리 구조 (변경 후)

```
.claude/
├── core/
│   └── rules/
│       ├── standards/
│       │   ├── security.md          ← NEW
│       │   ├── git-workflow.md      ← NEW
│       │   ├── anti-patterns.md
│       │   ├── code-structure.md
│       │   ├── complexity-metrics.md
│       │   └── naming-conventions.md
│       ├── quality/
│       │   ├── performance.md       ← NEW
│       │   ├── bdd-contract-testing.md
│       │   ├── checklist.md
│       │   └── testing-strategy.md
│       └── core/
│           ├── communication-guide.md
│           ├── development-philosophy.md
│           └── quick-start.md
├── skills/
│   ├── handoff.md                   ← NEW
│   ├── vercel-react-best-practices.md ← NEW
│   ├── techdebt.md                  ← NEW
│   ├── commit-push-pr.md            ← NEW
│   ├── typescript-advanced-types.md  ← NEW
│   └── ... (기존 11개)
└── agents/
    ├── junior-mentor.md             ← NEW
    └── ... (기존 41개)
```

</output_format>

## <acceptance>

### 완료 기준

1. **파일 생성**: 9개 파일 모두 지정된 경로에 생성
2. **포맷 검증**:
   - Skills: YAML 프론트매터 (`description`) 포함
   - Rules: 프론트매터 없음, ✅/❌ 예시 포함
   - Agent: 프론트매터 없음, Role/Model/Process/Output 섹션 포함
3. **내용 검증**:
   - 각 파일이 CCPP 소스의 핵심 내용을 포함
   - vibe 도구와의 연계 가이드 포함
   - 외부 의존성 (Gemini CLI 등) 제거 확인
4. **길이 검증**:
   - Rules: 200-300줄
   - Skills (일반): 80-150줄
   - Skills (레퍼런스): 300-750줄 (vercel-react-best-practices, typescript-advanced-types)
   - Agent: 80-120줄
5. **비파괴 검증**: 기존 파일 변경 없음
6. **빌드 영향 없음**: `npm run build` 성공 (마크다운만 추가이므로 영향 없음)

</acceptance>

---

## Appendix: Source Reference

| CCPP 소스 파일 | 줄 수 | 변환 복잡도 |
|---------------|-------|-----------|
| rules/security.md | 35 | 낮음 (확장 필요) |
| rules/performance.md | 39 | 낮음 (확장 필요) |
| rules/git-workflow.md | 48 | 낮음 (확장 필요) |
| skills/handoff/SKILL.md | 56 | 낮음 |
| skills/vercel-react-best-practices/SKILL.md | 126 | 중간 (AGENTS.md 선별) |
| skills/vercel-react-best-practices/AGENTS.md | 2,517 | 높음 (인덱스만 추출) |
| skills/techdebt/SKILL.md | 70 | 낮음 |
| skills/commit-push-pr/SKILL.md | 41 | 낮음 |
| skills/typescript-advanced-types/SKILL.md | 725 | 낮음 (프론트매터만 변환) |
| agents/junior-mentor.md | 306 | 중간 (구조 변환 + 의존성 제거) |
