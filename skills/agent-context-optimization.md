---
description: Long-running agent context management guide. Auto-activates for context optimization, token budget management, agent orchestration design, harness architecture, or session continuity planning.
---

# 롱-러닝 에이전트 컨텍스트 관리 팁

장시간 실행되는 에이전트의 컨텍스트를 효율적으로 관리하기 위한 4가지 핵심 팁.

## 팁 1: 최초 로드되는 컨텍스트 최소화

최상위 AGENTS.md는 무조건 로드되므로 **less is more**, **progressive disclosure** 원칙에 따라 꾸준히 압축하고 리팩토링한다. MCP 도구 정의도 매번 컨텍스트에 올라가므로 정말 필요할 때만 켠다.

| 원칙 | 설명 |
|------|------|
| Less is more | 최소한의 고신호 토큰만 유지 |
| Progressive disclosure | 필요 시점에 상세 정보 로드 |
| MCP 선택적 활성화 | 도구 정의도 토큰 소비 — 필요할 때만 |

### 참고자료

- [Effective context engineering for AI agents (Anthropic)](https://www.anthropic.com/engineering/context-engineering) — "가장 작은 고신호 토큰 집합 찾기" 원칙의 이론적 프레임워크
- [AI 시대 소프트웨어 프로젝트 문서화](https://blog.korka.app/posts/ai-era-documentation/) — CLAUDE.md/AGENTS.md 작성 실전 가이드 (강규영)
- [Writing a good CLAUDE.md (HumanLayer)](https://humanlayer.dev/blog/writing-a-good-claude-md) — CLAUDE.md 작성 가이드

## 팁 2: 모델이 할 필요 없는 일은 스크립트로

API 호출, 포맷 변환, 린터 등 **결정론적인 알고리즘**으로 더 빠르고 정확한 결과를 낼 수 있는 일이 많다. MCP도 의외로 쉽게 대체할 수 있다. 스킬에 이런 스크립트를 패키징해두고, 모델은 실행만 하면 되게끔 한다.

| 접근 | 장점 |
|------|------|
| 스크립트 실행 | 코드가 컨텍스트에 안 올라가고 출력만 토큰 소비 |
| bash + SQL 하이브리드 | 탐색/검증엔 bash, 구조화된 데이터엔 SQL |
| 도구 최소화 | 도구 수를 줄이면 성공률 향상 |

### 참고자료

- [Equipping agents for the real world with Agent Skills (Anthropic)](https://www.anthropic.com/engineering/agent-skills) — Progressive disclosure 설계 원칙
- [We removed 80% of our agent's tools (Vercel)](https://vercel.com/blog/we-removed-80-percent-of-our-agents-tools) — bash+SQL 2개로 줄이니 성공률 80%→100%
- [Testing if "bash is all you need" (Vercel)](https://vercel.com/blog/testing-if-bash-is-all-you-need) — 하이브리드가 최적이라는 nuance

## 팁 3: 서브에이전트로 핸드오프 + 파일로 맥락 전달

병렬로/독립적으로 돌릴 수 있는 작업들은 적극적으로 위임하여 메인 오케스트레이터의 컨텍스트를 아낀다. compact 이후나 핸드오프 시 맥락이 잘 전달되도록, **"이 파일 하나만 읽으면 뭘 왜 해야 하는지 알 수 있는"** 계획/작업 상태/교훈 파일을 관리한다.

| 패턴 | 효과 |
|------|------|
| 서브에이전트 격리 | 독립 컨텍스트 윈도우 사용, 관련 정보만 반환 |
| 파일 기반 메모리 | compact/핸드오프에도 맥락 유지 |
| claude-progress.txt | 작업 상태 + 다음 단계 + 주의사항 기록 |

### 참고자료

- [How we built our multi-agent research system (Anthropic)](https://www.anthropic.com/engineering/multi-agent-research-system) — 서브에이전트 격리로 단일 에이전트 대비 90% 성능 향상
- [Effective harnesses for long-running agents (Anthropic)](https://www.anthropic.com/engineering/effective-harnesses) — claude-progress.txt 패턴의 원전. Initializer + Coding agent 분리
- [ralph-orchestrator](https://github.com/ghuntley/ralph-orchestrator) — 랄프 플러그인의 자율 에이전트 버전

## 팁 4: 회고하며 개선 반복

작업 과정에서의 교훈을 읽고, 비효율적이거나 의도대로 동작하지 않았던 순간들을 에이전트와 함께 회고한다. 프롬프팅 습관, 하네스 구조, 코드베이스 구조, AGENTS.md 등에서 개선점을 찾아 반영하고 다시 실험한다.

| 단계 | 설명 |
|------|------|
| 교훈 수집 | 작업 중 비효율/오동작 기록 |
| 에이전트와 회고 | 개선점 도출 |
| 반영 및 실험 | 하네스/프롬프트/구조 수정 후 재실행 |

### 참고자료

- [Demystifying evals for AI agents (Anthropic)](https://www.anthropic.com/engineering/evaluating-ai-agents) — Task, trial, transcript, outcome, grader 용어 정리
- [session-wrap](https://github.com/jungbong/session-wrap) — 세션 회고 스킬 (팀 어텐션 정구봉)
- [compounding-engineering plugin](https://github.com/nichochar/compounding-engineering) — 매번 이자를 쌓아나가는 회고 워크플로우

## 요약

```
1. 컨텍스트 최소화 → less is more, progressive disclosure
2. 스크립트 활용 → 결정론적 작업은 모델 밖에서
3. 서브에이전트 + 파일 메모리 → 오케스트레이터 컨텍스트 보호
4. 회고 반복 → eval 체계화, 하네스 지속 개선
```

## 배경

위 팁들의 이론적 기반:

- [Effective context engineering for AI agents (Anthropic)](https://www.anthropic.com/engineering/context-engineering) — **"가장 작은 고신호 토큰 집합 찾기"**라는 원칙. 4가지 팁 전체의 배경이 되는 글.
