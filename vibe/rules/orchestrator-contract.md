# Orchestrator Contract — orchestrator 스킬 작성 계약 (SSOT)

> `type: orchestrator` 스킬(fan-out/fan-in 으로 서브에이전트를 조율하는 스킬)의
> **구조·스키마·네이밍 규칙**의 유일한 정의다. 각 orchestrator.md 는 이 스키마를 따르되
> **내용(phase·실패모드·에이전트)은 스킬별로 고유**하다 — 내용을 공유 파일로 병합하지 않는다.
>
> 대상: `skills/{techdebt,parallel-research,exec-plan,design-audit,create-prd}/orchestrator.md`

## Frontmatter

```yaml
---
name: <skill>-orchestrator      # 스킬 디렉토리명 + "-orchestrator"
type: orchestrator
agents: [<agent-basename>, ...]  # skills/<skill>/agents/ 의 파일 basename (접두사 없이)
---
```

## 필수 섹션 (순서 고정)

1. `## Workflow` — `### Phase N: <이름>` 목록. 각 Phase 는 아래 4개 필드를 갖는다:
   - `**Agent**:` — 이 Phase 를 수행하는 에이전트의 **basename**(복수 가능), 또는 `orchestrator (self)`
   - `**Input**:` / `**Output**:` — 데이터 계약
   - `**Parallel**:` — `yes`/`no` + 한 줄 근거
2. `## DAG (Dependency Graph)` — Phase 의존 관계를 `mermaid graph TD` 로.
3. `## Error Handling` — 스키마 고정 3열 테이블. 행 내용은 스킬별 고유:

   | Phase | Failure Mode | Strategy |
   |-------|-------------|----------|

4. `## Scalability Modes` — 스키마 고정 3열 테이블. `Full`/`Reduced`/`Single` 3-tier 분류:

   | Mode | When | Agents Used |
   |------|------|-------------|

## 에이전트 네이밍 규칙

전역 에이전트(`agents/**/*.md`, `CLAUDE_MODEL_MAPPING` 키)와의 **이름 충돌을 피하기 위해**
skill-local 에이전트는 접두사를 붙인다:

- 에이전트 파일의 frontmatter `name:` = `<prefix>-<agent-basename>`
- 에이전트끼리의 상호 참조("Reports findings to: …", "… from …")도 **접두사 이름**으로
- 단, orchestrator.md 의 frontmatter `agents:[]` 와 Workflow `**Agent**:` 는 **basename**(접두사 없이) — 파일명과 일치

**Prefix registry** (스킬 → 접두사):

| Skill | Prefix | 예 |
|-------|--------|-----|
| techdebt | `techdebt` | `techdebt-scanner` |
| exec-plan | `plan` | `plan-decomposer` |
| design-audit | `design` | `design-a11y-auditor` |
| parallel-research | `research` | `research-best-practices` |
| create-prd | `prd` | `prd-requirements-writer` |

> WHY: `edge-case-finder`, `reviewer`, `researcher` 등은 전역 에이전트/리뷰어와 basename 이
> 겹친다. 접두사가 없으면 조율 LLM 이 전역 에이전트와 skill-local 에이전트를 혼동한다.
