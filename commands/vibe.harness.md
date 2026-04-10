---
description: Diagnose project Harness Engineering maturity across 6 axes
argument-hint: (no arguments)
---

# /vibe.harness

프로젝트의 Harness Engineering 성숙도를 6축 기준으로 진단한다.

> Harness = AI가 혼자서도 잘 일할 수 있는 작업 환경
> 맥락, 제한, 작업 환경, 작업 흐름, 검증 — 이 모든 것을 포괄하는 개념

## Process

### 1. 프로젝트 상태 수집

다음 항목을 병렬로 탐색:

```text
# 3 agents in parallel
Agent(subagent_type="explorer-low", model="haiku",
  prompt="Check project scaffolding: 1) Does docs/ exist with business docs? 2) Does .dev/ exist for AI logs? 3) Is src/ organized by role (not flat)? 4) Is tests/ separate from src/? 5) List top-level directory structure.")

Agent(subagent_type="explorer-low", model="haiku",
  prompt="Check project context & boundaries: 1) Does CLAUDE.md exist and how many lines? 2) Does .claude/rules/ exist and how many rules? 3) Does .claude/settings.local.json exist with hooks? 4) Does .claude/vibe/config.json exist? 5) Are there any .claude/skills/?")

Agent(subagent_type="explorer-low", model="haiku",
  prompt="Check project planning, execution, verification: 1) Are there any SPEC files in .claude/vibe/specs/? 2) Are there any Feature (BDD) files in .claude/vibe/features/? 3) Are there test files? How many? 4) Is there a CI config (.github/workflows, etc.)? 5) Are there any .dev/learnings/ files?")
```

### 2. 6축 평가

#### 축 1: 구조 (Scaffolding) — /20

| 항목 | 기준 | 점수 |
|------|------|------|
| 역할별 폴더링 | src/ 하위가 역할별로 분리됨 (components/, services/, models/ 등) | /5 |
| docs/ 존재 | 비즈니스 문서 폴더 존재 + 내용 있음 | /4 |
| .dev/ 존재 | AI 작업 기록 폴더 존재 | /3 |
| tests/ 분리 | 테스트가 소스 옆이 아닌 별도 구조 | /3 |
| .gitignore 완성 | out/, .dev/scratch/, settings.local.json 포함 | /2 |
| 레이어 분리 | domain/service/infra 또는 유사한 구분 존재 | /3 |

#### 축 2: 맥락 (Context) — /20

| 항목 | 기준 | 점수 |
|------|------|------|
| CLAUDE.md 존재 | 프로젝트 지도 역할 | /5 |
| CLAUDE.md 적정 길이 | ~100줄 이하, 포인터 중심 | /3 |
| rules/ 존재 | 코딩 규칙, 테스트 컨벤션 정의 | /4 |
| 점진적 노출 | 스킬 tier 분리 또는 rules glob 패턴 | /3 |
| docs/ 참조 | CLAUDE.md에서 docs/ 참조 여부 | /3 |
| 언어 룰 | 스택별 코딩 표준 정의 | /2 |

#### 축 3: 계획 (Planning) — /15

| 항목 | 기준 | 점수 |
|------|------|------|
| SPEC 워크플로 | spec/feature 파일 생성 체계 존재 | /5 |
| 기획서/인터뷰 | 요구사항 수집 프로세스 존재 | /4 |
| 승인 게이트 | 계획 → 구현 사이 확인 단계 존재 | /3 |
| 템플릿 | SPEC/Feature 템플릿 존재 | /3 |

#### 축 4: 실행 (Orchestration) — /15

| 항목 | 기준 | 점수 |
|------|------|------|
| 에이전트/스킬 | 전문 에이전트 또는 스킬 정의 | /5 |
| 팀 구성 | 에이전트 팀 (architect + implementer + tester 등) | /4 |
| Permission 모델 | 에이전트별 권한 분리 (read-only vs write) | /3 |
| 비개발 워크플로 | 코드 외 작업 (문서, 리서치 등) 지원 | /3 |

#### 축 5: 검증 (Verification) — /15

| 항목 | 기준 | 점수 |
|------|------|------|
| 자동 품질 검사 | PostToolUse hook으로 코드 검사 | /4 |
| 테스트 존재 | 테스트 파일 존재 + 실행 가능 | /4 |
| CI/CD | 자동 빌드/테스트 파이프라인 | /4 |
| 추적성 (Traceability) | SPEC → 코드 → 테스트 매핑 | /3 |

#### 축 6: 개선 (Compound) — /15

| 항목 | 기준 | 점수 |
|------|------|------|
| learnings 기록 | .dev/learnings/ 에 트러블슈팅 기록 | /4 |
| 패턴 축적 | 반복 작업이 스킬/룰로 정착 | /4 |
| 자동 개선 | Evolution Engine 또는 유사 메커니즘 | /4 |
| 메모리 | 세션 간 학습 유지 메커니즘 | /3 |

### 3. 종합 리포트 출력

```markdown
## Harness 진단 결과 (N/100)

### 총점 및 등급
- **점수**: N/100
- **등급**: [S / A / B / C / D]

| 등급 | 점수 | 설명 |
|------|------|------|
| S | 90-100 | Production-ready Harness |
| A | 75-89 | Well-structured, minor gaps |
| B | 60-74 | Functional but missing key elements |
| C | 40-59 | Basic setup, significant gaps |
| D | 0-39 | Minimal or no Harness |

### 축별 점수

| 축 | 점수 | 상태 |
|---|---|---|
| 구조 (Scaffolding) | /20 | [상세] |
| 맥락 (Context) | /20 | [상세] |
| 계획 (Planning) | /15 | [상세] |
| 실행 (Orchestration) | /15 | [상세] |
| 검증 (Verification) | /15 | [상세] |
| 개선 (Compound) | /15 | [상세] |

### 상위 3 개선 포인트

1. **[가장 낮은 축]**: [구체적 액션]
2. **[두 번째 축]**: [구체적 액션]
3. **[세 번째 축]**: [구체적 액션]

### 자동 수정 가능 항목

다음 항목은 지금 바로 개선할 수 있습니다:
1. [ ] `/scaffold` — 프로젝트 구조 생성
2. [ ] `vibe init` — AI 설정 초기화
3. [ ] CLAUDE.md 경량화 — 포인터 중심으로 리팩터

자동 수정을 진행할까요? (y/n)
```

### 4. 리포트 저장

결과를 `.claude/vibe/reports/harness-{date}.md`에 저장.

---

## 핵심 원칙

1. **있는 그대로 평가** — 점수를 부풀리지 않는다
2. **구체적 액션 제안** — "개선 필요" 대신 실행 가능한 명령어 제시
3. **점진적 개선** — 한 번에 모든 걸 고치려 하지 않고, 상위 3개에 집중
4. **반복 측정** — 시간 경과에 따른 점수 변화 추적 가능

---

ARGUMENTS: $ARGUMENTS
