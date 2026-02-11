# language: ko
Feature: CCPP 에셋 도입 (ccpp-adoption)
  Claude Code Power Pack(CCPP)에서 선별한 9개 에셋을
  vibe 프로젝트 포맷에 맞게 변환하여 통합한다.

  Background:
    Given vibe 프로젝트가 "/Users/grove/workspace/vibe" 경로에 존재한다
    And CCPP 레포가 "/Users/grove/workspace/my-claude-code-asset" 경로에 존재한다
    And 현재 브랜치가 "feature/ccpp-adoption"이다

  # ─── Phase 1: Rules ───

  Scenario: 1-1. Security Rule 추가
    Given CCPP "rules/security.md" 소스 파일이 존재한다 (35줄)
    When 해당 파일을 vibe rule 포맷으로 변환한다
    Then ".claude/core/rules/standards/security.md" 파일이 생성된다
    And 파일에 YAML 프론트매터가 없다
    And H1 제목이 "Security Standards"이다
    And OWASP Top 10 기반 체크리스트가 포함되어 있다
    And 시크릿 관리 가이드가 포함되어 있다
    And SQL Injection, XSS, CSRF 방지 패턴이 포함되어 있다
    And ✅ Good / ❌ Bad 코드 예시가 포함되어 있다
    And 파일 길이가 200-300줄이다
    And 기존 ".claude/core/rules/standards/" 파일들이 변경되지 않았다

  Scenario: 1-2. Performance Rule 추가
    Given CCPP "rules/performance.md" 소스 파일이 존재한다 (39줄)
    When 해당 파일을 vibe rule 포맷으로 변환한다
    Then ".claude/core/rules/quality/performance.md" 파일이 생성된다
    And 파일에 YAML 프론트매터가 없다
    And H1 제목이 "Performance Standards"이다
    And React 최적화 패턴 (memoization, 번들, 이미지)이 포함되어 있다
    And 백엔드 최적화 패턴 (DB, 캐싱, API)이 포함되어 있다
    And Web Vitals 기준 (LCP, FID, CLS)이 포함되어 있다
    And ✅ Good / ❌ Bad 코드 예시가 포함되어 있다
    And 성능 체크리스트가 포함되어 있다
    And 파일 길이가 200-300줄이다
    And 기존 ".claude/core/rules/quality/" 파일들이 변경되지 않았다

  Scenario: 1-3. Git Workflow Rule 추가
    Given CCPP "rules/git-workflow.md" 소스 파일이 존재한다 (48줄)
    When 해당 파일을 vibe rule 포맷으로 변환한다
    Then ".claude/core/rules/standards/git-workflow.md" 파일이 생성된다
    And 파일에 YAML 프론트매터가 없다
    And H1 제목이 "Git Workflow Standards"이다
    And 브랜치 전략 (main → develop → feature/fix/refactor)이 포함되어 있다
    And Conventional Commits 한국어 형식이 포함되어 있다
    And PR 체크리스트가 포함되어 있다
    And 금지사항 목록이 포함되어 있다
    And ✅ Good / ❌ Bad 커밋 메시지 예시가 포함되어 있다
    And 파일 길이가 150-250줄이다

  # ─── Phase 2: Skills ───

  Scenario: 2-1. Handoff Skill 추가
    Given CCPP "skills/handoff/SKILL.md" 소스 파일이 존재한다 (56줄)
    When 해당 파일을 vibe skill 포맷으로 변환한다
    Then "skills/handoff.md" 파일이 생성된다
    And 파일에 YAML 프론트매터 "description" 필드가 존재한다
    And HANDOFF.md 생성 템플릿이 포함되어 있다
    And 사용 시점 가이드가 포함되어 있다
    And "/vibe.utils --continue"와의 차이점이 명시되어 있다
    And vibe 내장 도구 (core_save_memory 등) 연계 안내가 있다
    And 파일 길이가 80-120줄이다

  Scenario: 2-2. Vercel React Best Practices Skill 추가
    Given CCPP "skills/vercel-react-best-practices/SKILL.md" 소스 파일이 존재한다 (126줄)
    And CCPP "skills/vercel-react-best-practices/AGENTS.md" 참조 파일이 존재한다 (2,517줄)
    When 해당 파일을 vibe skill 포맷으로 변환한다
    Then "skills/vercel-react-best-practices.md" 파일이 생성된다
    And 파일에 YAML 프론트매터 "description" 필드가 존재한다
    And 45개 룰 인덱스 (Quick Reference)가 포함되어 있다
    And 8개 카테고리별 Priority 체계가 포함되어 있다
    And CRITICAL/HIGH 항목의 핵심 코드 예시가 포함되어 있다
    And AGENTS.md 전문은 포함되지 않는다
    And 파일 길이가 300-400줄이다

  Scenario: 2-3. Techdebt Skill 추가
    Given CCPP "skills/techdebt/SKILL.md" 소스 파일이 존재한다 (70줄)
    When 해당 파일을 vibe skill 포맷으로 변환한다
    Then "skills/techdebt.md" 파일이 생성된다
    And 파일에 YAML 프론트매터 "description" 필드가 존재한다
    And 검사 항목이 포함되어 있다 (중복 코드, 미사용 import, debug 코드, 코드 품질)
    And 검사 명령어가 Grep/Glob 도구 기반으로 되어 있다
    And vibe 도구 (core_analyze_complexity 등) 연계 가이드가 있다
    And 출력 형식 (리포트 템플릿)이 포함되어 있다
    And 자동 수정 범위와 안전 가드가 명시되어 있다
    And 파일 길이가 100-150줄이다

  Scenario: 2-4. Commit-Push-PR Skill 추가
    Given CCPP "skills/commit-push-pr/SKILL.md" 소스 파일이 존재한다 (41줄)
    When 해당 파일을 vibe skill 포맷으로 변환한다
    Then "skills/commit-push-pr.md" 파일이 생성된다
    And 파일에 YAML 프론트매터 "description" 필드가 존재한다
    And Conventional Commits 한국어 형식이 포함되어 있다
    And "gh pr create" 통합이 포함되어 있다
    And "Co-Authored-By" 자동 추가 규칙이 있다
    And 보안 파일 체크 (.env, credentials)가 포함되어 있다
    And main 브랜치 보호 규칙이 포함되어 있다
    And 파일 길이가 80-120줄이다

  Scenario: 2-5. TypeScript Advanced Types Skill 추가
    Given CCPP "skills/typescript-advanced-types/SKILL.md" 소스 파일이 존재한다 (725줄)
    When 해당 파일을 vibe skill 포맷으로 변환한다
    Then "skills/typescript-advanced-types.md" 파일이 생성된다
    And 파일에 YAML 프론트매터 "description" 필드가 존재한다
    And 6개 핵심 패턴이 포함되어 있다 (Generics, Conditional Types, Mapped Types, Template Literals, Utility Types, Infer)
    And 각 패턴에 코드 예시가 포함되어 있다
    And vibe TypeScript 규칙 (any 차단)과의 연계가 명시되어 있다
    And 파일 길이가 700-750줄이다

  # ─── Phase 3: Agent ───

  Scenario: 3-1. Junior Mentor Agent 추가
    Given CCPP "agents/junior-mentor.md" 소스 파일이 존재한다 (306줄)
    When 해당 파일을 vibe agent 포맷으로 변환한다
    Then "agents/junior-mentor.md" 파일이 생성된다
    And 파일에 YAML 프론트매터가 없다
    And H1 제목이 "Junior Mentor Agent (Sonnet)"이다
    And Role 섹션이 존재한다
    And Model 섹션에 "Sonnet"이 명시되어 있다
    And Process 섹션이 존재한다
    And Output 섹션에 EXPLANATION.md 생성이 포함되어 있다
    And nano-banana (Gemini CLI) 의존성이 없다
    And vibe 도구 (/vibe.utils --diagram)와의 연계가 명시되어 있다
    And 파일 길이가 80-120줄이다

  # ─── 에러 핸들링 ───

  Scenario: CCPP 소스 파일이 존재하지 않을 때
    Given CCPP 소스 파일 "rules/nonexistent.md"가 존재하지 않는다
    When 해당 파일을 vibe rule 포맷으로 변환 시도한다
    Then 에러 로그가 출력된다
    And 해당 에셋은 건너뛴다
    And 최종 리포트에 누락 항목이 명시된다

  Scenario: 타겟 경로에 동일 이름 파일이 이미 존재할 때
    Given 타겟 경로에 동일 이름 파일이 이미 존재한다
    When 해당 파일을 생성 시도한다
    Then 기존 파일이 보존된다
    And 신규 파일 생성이 중단된다
    And 사용자에게 확인을 요청한다

  # ─── Phase 4: 검증 ───

  Scenario: 전체 검증
    When 모든 Phase의 파일이 생성된다
    Then 총 9개 파일이 존재한다
    And 기존 vibe 에셋 파일들이 변경되지 않았다
    And "npm run build"가 성공한다
    And 모든 Rule 파일에 프론트매터가 없다
    And 모든 Skill 파일에 "description" 프론트매터가 있다
    And Agent 파일에 프론트매터가 없다
    And 외부 도구 의존성 (Gemini CLI, Stitch MCP, agent-browser)이 없다
