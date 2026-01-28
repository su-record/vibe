# Vibe

**SPEC-driven AI Coding Framework with Multi-LLM Orchestration**

[![npm version](https://img.shields.io/npm/v/@su-record/vibe.svg)](https://www.npmjs.com/package/@su-record/vibe)
[![npm downloads](https://img.shields.io/npm/dt/@su-record/vibe)](https://www.npmjs.com/package/@su-record/vibe)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Claude Code 전용 AI 코딩 프레임워크. SPEC 기반 요구사항 관리, Multi-LLM(Claude + GPT + Gemini) 오케스트레이션, 13+ 병렬 리뷰 에이전트를 통한 품질 자동화.

## Quick Start

```bash
npm install -g @su-record/vibe
vibe init
```

## Core Workflow

```
/vibe.spec → /vibe.run → /vibe.trace → /vibe.verify → /vibe.review
     ↓            ↓            ↓             ↓              ↓
  SPEC 작성    구현 실행    추적성 매트릭스   BDD 검증     병렬 리뷰
```

## Key Features

| Feature | Description |
|---------|-------------|
| **SPEC-driven Development** | 요구사항 → SPEC → Feature → Test 추적 가능한 개발 |
| **Multi-LLM Orchestration** | Claude + GPT + Gemini 3-way 검증 및 자동 라우팅 |
| **13+ Parallel Review Agents** | Security, Performance, Architecture 등 병렬 코드 리뷰 |
| **ULTRAWORK Mode** | 키워드 하나로 모든 최적화 활성화 |
| **Fire-and-Forget Agents** | 논블로킹 백그라운드 에이전트 실행 |
| **Phase Pipelining** | 현재 Phase 실행 중 다음 Phase 준비 |
| **Swarm Pattern** | 복잡한 작업 자동 분할 및 병렬 처리 (v2.7) |
| **23 Language Presets** | TypeScript, Python, Go, Rust, Swift, Kotlin 등 |

## Commands

### Terminal

| Command | Description |
|---------|-------------|
| `vibe init` | 프로젝트 초기화 |
| `vibe update` | 설정 업데이트 |
| `vibe status` | 상태 확인 |
| `vibe gpt auth` | GPT OAuth 인증 |
| `vibe gemini auth` | Gemini OAuth 인증 |

### Claude Code Slash Commands

| Command | Description |
|---------|-------------|
| `/vibe.spec "feature"` | SPEC 문서 생성 + 병렬 리서치 |
| `/vibe.run "feature"` | 구현 실행 |
| `/vibe.run "feature" ultrawork` | 최대 성능 모드 |
| `/vibe.verify "feature"` | BDD 검증 |
| `/vibe.trace "feature"` | 요구사항 추적성 매트릭스 |
| `/vibe.review` | 13+ 에이전트 병렬 리뷰 |
| `/vibe.review --race` | GPT + Gemini 경쟁 리뷰 |

## ULTRAWORK Mode

`ultrawork` 또는 `ulw` 키워드로 최대 성능 활성화:

```bash
/vibe.run "feature" ultrawork
```

**활성화 기능:**
- 병렬 서브에이전트 탐색 (3+ 동시)
- 백그라운드 에이전트 (다음 Phase 사전 준비)
- Phase 파이프라이닝 (Phase 간 대기 시간 제거)
- Boulder Loop (모든 시나리오 완료까지 자동 진행)
- 80%+ 컨텍스트에서 자동 저장

**속도 비교:**

| Mode | 5 Phases |
|------|----------|
| Sequential | ~10min |
| Parallel | ~7.5min |
| **ULTRAWORK + Pipeline** | **~5min** |

## Multi-LLM Orchestration

### Automatic Routing

프롬프트 키워드에 따라 자동으로 적합한 LLM 라우팅:

| Keyword | Routes to | Use Case |
|---------|-----------|----------|
| `architecture`, `design` | GPT | 아키텍처 리뷰 |
| `UI`, `UX` | Gemini | UI/UX 피드백 |
| `debugging` | GPT | 버그 분석 |
| `analyze code` | Gemini | 코드 리뷰 |

### Race Review

GPT + Gemini 병렬 실행 후 교차 검증:

```bash
/vibe.review --race
```

| Agreement | Priority | Action |
|-----------|----------|--------|
| Both agree (100%) | P1 | High confidence |
| One model (50%) | P2 | Needs verification |

## Parallel Review Agents

`/vibe.review`로 13+ 에이전트 동시 실행:

| Category | Agents |
|----------|--------|
| Security | security-reviewer, data-integrity-reviewer |
| Performance | performance-reviewer, complexity-reviewer |
| Architecture | architecture-reviewer, simplicity-reviewer |
| Language | python, typescript, rails, react reviewers |

**Priority System:**
- 🔴 P1 (Critical): 머지 차단
- 🟡 P2 (Important): 수정 권장
- 🔵 P3 (Nice-to-have): 백로그

## Swarm Pattern (v2.7)

복잡한 작업을 자동으로 분할하여 병렬 처리:

```typescript
import { swarm, analyzeTaskComplexity } from '@su-record/vibe/orchestrator';

// 복잡도 분석
const analysis = analyzeTaskComplexity('Your prompt');
console.log(analysis.score); // 15 이상이면 분할 대상

// Swarm 실행
const result = await swarm({
  prompt: 'Complex task...',
  maxDepth: 2,           // 최대 분할 깊이
  splitThreshold: 15,    // 복잡도 임계값
});
```

**작동 원리:**
```
프롬프트 → 복잡도 분석 → 분할 결정
                ↓
    ┌─ 낮음 → 직접 실행
    └─ 높음 → 하위 태스크 생성 → 병렬 처리 → 결과 병합
```

## Requirements Traceability (v2.6)

요구사항부터 테스트까지 추적:

```bash
/vibe.trace "feature"
```

```
REQ-login-001 → SPEC Phase 1 → Feature Scenario 1 → login.test.ts
REQ-login-002 → SPEC Phase 2 → Feature Scenario 3 → auth.test.ts
```

## Project Structure

**Global (`~/.claude/`):**
```
~/.claude/
├── commands/     # Slash commands
├── agents/       # Review/research agents
├── skills/       # Auto-activated guides
└── settings.json # Hooks
```

**Project (`.claude/vibe/`):**
```
.claude/vibe/
├── specs/        # SPEC documents
├── features/     # BDD scenarios
├── config.json   # Project settings
└── constitution.md
```

## Code Quality Standards

| Metric | Limit |
|--------|-------|
| Function length | 30 lines (권장), 50 lines (허용) |
| Nesting depth | 3 levels |
| Parameters | 5 |
| Cyclomatic complexity | 10 |

## Cursor IDE Support

`vibe init/update` 시 Cursor IDE 에셋 자동 설치:

| Asset | Path | Count |
|-------|------|-------|
| Subagents | `~/.cursor/agents/` | 12 |
| Skills | `~/.cursor/skills/` | 7 |
| Rules | `~/.cursor/rules-template/` | 23 languages |

## API Usage

```typescript
// Background agent
import { launch, poll } from '@su-record/vibe/orchestrator';
const { taskId } = launch({ prompt: 'Analyze code', agentName: 'analyzer' });
const result = await poll(taskId);

// Swarm pattern (v2.7) - 복잡한 작업 자동 분할
import { swarm } from '@su-record/vibe/orchestrator';
const result = await swarm({
  prompt: 'Implement login with: 1. UI 2. Validation 3. API 4. Tests',
  maxDepth: 2,
  splitThreshold: 15,
});

// LLM direct call
import { ask } from '@su-record/vibe/lib/gpt';
import { webSearch } from '@su-record/vibe/lib/gemini';
```

## Requirements

- Node.js 18.0.0+
- Claude Code

## License

MIT - [GitHub](https://github.com/su-record/vibe)

---

⭐ If this helps your workflow, consider giving it a star!
