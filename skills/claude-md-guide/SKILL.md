---
name: claude-md-guide
description: "Guide for writing effective CLAUDE.md files from scratch. Evidence-based methodology from 40+ sources including research papers, official docs, and real-world examples. Covers 3-layer architecture, Curse of Instructions mitigation, progressive disclosure, and maintenance. Use when creating new CLAUDE.md, improving existing ones, or teaching team members how to write project instructions for AI agents."
triggers: [claude-md guide, write claude.md, create claude.md, claude.md 작성, 클로드 문서, project instructions, claude-md]
priority: 55
chain-next: [agents-md]
---

# claude-md-guide — CLAUDE.md 작성 가이드

> **원칙**: "에이전트가 이걸 모르면 실수할까?" → No면 삭제. Yes면 유지.

## Why This Matters

연구 결과에 따르면 지시사항이 많아질수록 LLM의 준수율이 **지수적으로** 하락합니다 (Curse of Instructions):

| 지시 수 | GPT-4o 준수율 | Claude Sonnet 준수율 |
|---------|--------------|---------------------|
| 1개 | ~85% | ~90% |
| 5개 | ~44% | ~59% |
| 10개 | ~15% | ~44% |
| 15개+ | ~5% | ~15% |

**결론**: 모든 줄이 비용. 짧고 정확한 CLAUDE.md가 길고 포괄적인 것보다 낫습니다.

---

## Step 1: 프로젝트 탐색 — 자동 수집

CLAUDE.md를 작성하기 전에 먼저 프로젝트를 탐색합니다:

```
Glob: pattern="package.json"       → 스택, 스크립트 확인
Glob: pattern="*.config.*"         → 빌드/린트 설정
Glob: pattern="tsconfig.json"      → TypeScript 설정
Glob: pattern=".env.example"       → 환경변수 구조
Glob: pattern="Makefile"           → 빌드 시스템
Glob: pattern="docker-compose.*"   → 인프라 구조
Glob: pattern="CLAUDE.md"          → 기존 파일 확인
Glob: pattern="AGENTS.md"          → 호환 파일 확인
```

수집한 정보를 사용자에게 요약 제시하고, 빠진 컨텍스트를 질문합니다.

## Step 2: 인터뷰 — 비발견적 정보 추출

자동 탐색으로 알 수 없는 정보만 질문합니다. **한 번에 질문 하나, 가능하면 객관식**으로:

### 질문 카테고리

**1. 런타임 함정 (Runtime Traps)**
- 코드에서 보이지 않는 런타임 차이가 있나요? (예: Bun vs Node, ESM vs CJS)
- 특정 환경에서만 발생하는 버그가 있나요?

**2. 금지 패턴 (Forbidden Patterns)**
- 절대 사용하면 안 되는 라이브러리/패턴이 있나요?
- 과거에 문제를 일으킨 접근법이 있나요?

**3. 비표준 관례 (Non-standard Conventions)**
- 표준과 다른 네이밍/구조 규칙이 있나요?
- 팀에서 합의한 특수한 워크플로우가 있나요?

**4. 아키텍처 결정 (Architecture Decisions)**
- 코드만 봐서는 알 수 없는 설계 이유가 있나요?
- 특정 패턴을 선택한 비즈니스 맥락이 있나요?

**5. 경계선 (Boundaries)**
- 에이전트가 절대 건드리면 안 되는 파일/디렉토리가 있나요?
- 변경 전 반드시 확인받아야 하는 영역이 있나요?

## Step 3: 구조 설계 — 3-Layer Architecture

수집한 정보를 3개 레이어로 분리합니다:

### Layer 1: CLAUDE.md (프로젝트 헌법)

**모든 세션에 자동 로드** → 보편적이고 안정적인 정보만.

```markdown
# {프로젝트명}

{프로젝트가 뭔지 1-2문장. 코드에서 목적이 불분명할 때만.}

## Tech Stack
{package.json에서 바로 알 수 없는 것만. 예: "Bun runtime (not Node)"}

## Commands
{package.json scripts에 없거나 비직관적인 것만}
- `npm run build && npx vitest run` — 빌드 후 테스트 (순서 중요)

## Conventions
{린터가 잡지 못하는 것만}
- ESM only — imports need `.js` extension
- {비표준 네이밍 규칙이 있다면}

## Gotchas
{에이전트가 반복적으로 실수할 것들}
- **{함정 제목}.** {구체적인 do/don't 설명}

## Boundaries
✅ Always: {항상 해야 하는 것}
⚠️ Ask first: {먼저 확인받아야 하는 것}
🚫 Never: {절대 하면 안 되는 것}
```

### Layer 2: SPEC.md (기능별 설계 문서)

**특정 기능 작업 시에만 로드** → what과 why에 집중, how는 에이전트에게.

저장 위치: `.claude/vibe/specs/YYYY-MM-DD-{주제}.md`

```markdown
# {기능명} SPEC

## 목적 (Why)
## 요구사항 (What)
## 성공 기준 (Acceptance Criteria)
## 기술적 제약 (Constraints)
## 경계선 (Out of Scope)
```

### Layer 3: plan.md (실행 계획)

**세션별 태스크 리스트** → 2-5분 단위, 파일 경로 명시.

저장 위치: `.claude/vibe/specs/{name}-execplan.md`

```markdown
# Execution Plan

## Task 1: {제목}
- Files: `src/foo.ts`, `src/foo.test.ts`
- Action: {구체적 변경 내용}
- Verify: `npm test src/foo.test.ts`

## Task 2: ...
```

## Step 4: 작성 — 증거 기반 원칙 적용

### 크기 제한

| 등급 | 줄 수 | 적합한 경우 |
|------|-------|------------|
| 최적 | 60-150줄 | 대부분의 프로젝트 |
| 허용 | 150-200줄 | 복잡한 모노레포 |
| 경고 | 200-300줄 | 분리 필요 |
| 위험 | 300줄+ | 에이전트가 절반 무시 |

### 위치별 주의력 분포 (Lost in the Middle 효과)

LLM은 문서의 **처음과 끝**에 집중하고 **중간을 무시**합니다:

```
주의력: ████████░░░░░░░░████████
        ^시작     ^중간(↓20-40%)  ^끝
```

**대응**:
- **가장 중요한 규칙** → 문서 상단에 배치
- **자주 위반되는 규칙** → 문서 하단(끝)에 배치
- **배경 정보** → 중간에 배치 (무시되어도 괜찮은 것)

### 포함 vs 제외 체크리스트

**✅ 포함 (비발견적, 운영상 중요)**

| 유형 | 예시 |
|------|------|
| 런타임 함정 | "Bun runtime, not Node" |
| 금지 패턴 | "Never use `any`, use `unknown` + type guards" |
| SSOT 위치 | "Only edit `constants.ts` for stack mapping" |
| 순서 불변 규칙 | "Build before test, always" |
| 비표준 커맨드 | 복합 명령어, 특수 플래그 |
| 보안 규칙 | 인증, 경로 순회 방지 등 |

**❌ 제외 (발견 가능하거나 다른 도구에 맡길 것)**

| 유형 | 이유 | 대안 |
|------|------|------|
| 디렉토리 구조 | `ls`로 발견 가능 | 코드 자체 |
| 기술 스택 목록 | `package.json`에 있음 | 코드 자체 |
| 코드 스타일 (들여쓰기, 세미콜론) | 린터가 잡음 | ESLint, Prettier |
| API 문서 | 코드에서 읽을 수 있음 | Swagger, JSDoc |
| 일반적 Best Practice | LLM이 이미 앎 | 불필요 |
| API 키, 시크릿 | 빠르게 구식이 됨 | `.env`, vault |
| 기능별 상세 지시 | Layer 2로 분리 | SPEC.md |

### 강조 기법

중요한 규칙이 무시될 때 사용:

```markdown
**IMPORTANT**: {critical rule}
**MUST**: {mandatory action}
**NEVER**: {absolute prohibition}
```

단, 모든 줄에 강조를 넣으면 **강조가 무효화**됩니다. P1 규칙에만 사용하세요.

### Progressive Disclosure (점진적 공개)

CLAUDE.md에 모든 것을 넣지 말고 참조하세요:

```markdown
# Architecture
See @docs/ARCHITECTURE.md for design decisions.

# Security
@.claude/rules/security.md
```

Claude Code는 `@` 참조를 따라가서 필요할 때만 로드합니다.

## Step 5: 검증 — 작성 품질 체크

작성된 CLAUDE.md를 검증합니다:

### 줄별 검증

모든 줄에 대해 4가지 질문:

1. **이걸 빼면 에이전트가 실수할까?** → No면 삭제
2. **모든 세션에 필요한가?** → No면 Layer 2/3으로 이동
3. **린터/훅이 대신할 수 있나?** → Yes면 린터/훅으로 이동
4. **코드에서 발견 가능한가?** → Yes면 삭제

### 앵커링 경고

기술명을 언급하면 에이전트가 그쪽으로 편향됩니다:
- ❌ "We use React" → 불필요 (package.json에 있음)
- ✅ "Never use jQuery, even for legacy code" → 유용 (함정 방지)

### 토큰 효율성

| 문제 | 예시 | 개선 |
|------|------|------|
| 장황한 설명 | "Please always make sure to..." | "Always:" |
| 중복 | 같은 규칙을 다른 표현으로 반복 | 한 번만 |
| 불필요한 맥락 | "As we discussed..." | 삭제 |

## Step 6: 유지보수 — 살아있는 문서

### 점진적 추가 패턴

처음부터 완벽하게 쓰지 마세요:

```
1. 최소한의 CLAUDE.md로 시작 (30-50줄)
2. 에이전트가 실수하는 걸 관찰
3. 반복되는 실수만 규칙으로 추가
4. 2-3주마다 불필요한 줄 정리
```

### Reflection Loop (Addy Osmani 패턴)

```
에이전트 작업 완료
  → "무엇이 예상과 달랐나?" 자문
  → 반복되는 패턴 발견 시 CLAUDE.md에 1줄 추가
  → 근본 원인이 코드 구조면 코드를 고치고 규칙은 추가하지 않음
```

### 위험 신호

| 신호 | 의미 | 대응 |
|------|------|------|
| 300줄 초과 | 정보 과부하 | 분리 또는 정리 |
| 같은 실수 반복 | 규칙이 노이즈에 묻힘 | 강조 또는 통합 |
| 규칙 추가해도 변화 없음 | 파일이 너무 김 | 근본 원인 수정 |
| 팀원이 규칙 무시 | 발견 가능한 정보 | 삭제 |

---

## Quick Reference: 프로젝트 규모별 가이드

### 소규모 (파일 10개 미만)

```markdown
# {프로젝트명}

## Commands
- `{build}` — {설명}
- `{test}` — {설명}

## Gotchas
- **{함정 1}.** {설명}
- **{함정 2}.** {설명}

## Never
- 🚫 {금지 사항}
```

**목표: 20-30줄**

### 중규모 (파일 10-50개)

위 + Conventions, Boundaries 섹션 추가.

**목표: 60-150줄**

### 대규모 (파일 50개+, 모노레포)

루트 CLAUDE.md (공통 규칙) + 하위 디렉토리별 CLAUDE.md.

```
project/
├── CLAUDE.md              ← 공통 (60줄)
├── packages/api/CLAUDE.md ← API 전용 (30줄)
├── packages/web/CLAUDE.md ← 웹 전용 (30줄)
└── .claude/rules/         ← 경로별 규칙
    ├── security.md
    └── testing.md
```

**목표: 루트 100줄 + 하위 각 30줄**

---

## 세션 분리 원칙

CLAUDE.md 작성도 세션을 분리하면 품질이 올라갑니다:

| 세션 | 목표 | 산출물 |
|------|------|--------|
| 세션 1 | 프로젝트 탐색 + 인터뷰 | 초안 |
| 세션 2 | 검증 + 최적화 | 최종본 |
| 이후 | 점진적 유지보수 | 지속 개선 |

작성 완료 후: `→ /agents-md` 스킬로 최적화 검증을 실행하세요.

---

## References

### Research
- [Curse of Instructions: LLMs Cannot Follow Multiple Instructions at Once](https://openreview.net/forum?id=R6q67CDBCH)
- [Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172)
- [The Instruction Hierarchy: Training LLMs to Prioritize Privileged Instructions](https://arxiv.org/html/2404.13208v1)
- [Context Length Alone Hurts LLM Performance Despite Perfect Retrieval](https://arxiv.org/html/2510.05381v1)

### Official Docs
- [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices)
- [Using CLAUDE.md Files](https://claude.com/blog/using-claude-md-files)

### Community
- [Addy Osmani: AGENTS.md](https://addyosmani.com/blog/agents-md/)
- [HumanLayer: Writing a good CLAUDE.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
- [Builder.io: CLAUDE.md Guide](https://www.builder.io/blog/claude-md-guide)
- [GitHub Blog: How to Write a Great agents.md](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/)
