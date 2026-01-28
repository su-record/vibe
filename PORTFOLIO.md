# Vibe - AI Coding Framework Portfolio

## Project Overview

| Item | Description |
|------|-------------|
| Project Name | Vibe |
| Period | 2024.10 ~ Present (Active Development) |
| Role | Solo Developer (Design, Development, Maintenance) |
| Tech Stack | TypeScript, Node.js, Claude API, GPT API, Gemini API |
| npm | [@su-record/vibe](https://www.npmjs.com/package/@su-record/vibe) |
| GitHub | [su-record/vibe](https://github.com/su-record/vibe) |

## Problem Statement

### Before Vibe
- AI 코딩 도구(Claude Code, Cursor 등)의 출력 품질이 일관되지 않음
- 복잡한 기능 개발 시 요구사항 누락, 컨텍스트 유실 발생
- 코드 리뷰가 수동적이고 일관성 없음
- LLM별 강점을 활용하지 못하고 단일 모델에 의존

### After Vibe
- SPEC 기반 구조화된 개발로 요구사항 추적 가능
- 13+ 병렬 리뷰 에이전트로 자동화된 품질 관리
- Claude + GPT + Gemini 3-way 검증으로 신뢰도 향상
- 세션 간 컨텍스트 유지로 장기 프로젝트 지원

## AI Utilization (Cocone 평가 기준)

### 1. Code Generation & Automation
**AI 기여도: 70%**

- SPEC 문서에서 코드 자동 생성
- 13+ 리뷰 에이전트 병렬 실행으로 품질 자동 검증
- P1/P2 이슈 자동 수정

```
/vibe.spec "login" → SPEC 생성 → /vibe.run → 코드 생성 → 자동 리뷰 → 자동 수정
```

### 2. Multi-LLM Orchestration
**AI 기여도: 80%**

각 LLM의 강점을 작업 유형에 따라 자동 라우팅:

| Task Type | Primary LLM | Reason |
|-----------|-------------|--------|
| Architecture Review | GPT | 구조적 분석 강점 |
| UI/UX Feedback | Gemini | 시각적 분석 + 웹 검색 |
| Code Implementation | Claude | 정확한 코드 생성 |
| Security Audit | GPT + Gemini | 교차 검증으로 신뢰도 향상 |

**Race Review**: 동일 작업을 GPT + Gemini에서 병렬 실행 후 교차 검증
- 100% 일치 → P1 (High Confidence)
- 50% 일치 → P2 (Needs Verification)

### 3. Prompt Engineering
**AI 기여도: 60%**

PTCF (Prompt Template for Claude Framework) 구조 설계:

```xml
<role>      AI 역할 정의
<context>   기술 스택, 관련 코드, 배경
<task>      Phase별 작업 목록
<constraints> 제약 조건
<output_format> 생성할 파일 목록
<acceptance> 검증 기준
```

### 4. Context Management
**AI 기여도: 50%**

- 70%+ 컨텍스트 도달 시 자동 저장
- 세션 간 메모리 유지 (`save_memory` → `/new` → `start_session`)
- 요약 없이 원본 결정사항 보존

### 5. Agent System Design
**AI 기여도: 75%**

**12 Review Agents:**
- Security, Performance, Architecture, Complexity
- Language-specific: TypeScript, Python, React, Rails

**4 Research Agents:**
- Best Practices, Framework Docs, Codebase Patterns, Security Advisory

**Agent Tier System (비용 최적화):**
| Complexity | Model | Use Case |
|------------|-------|----------|
| Low (0-7) | Haiku | 단순 검색, 수정 |
| Medium (8-19) | Sonnet | 일반 기능 개발 |
| High (20+) | Opus | 아키텍처, 보안 |

### 6. Fire-and-Forget Background Execution
**AI 기여도: 65%**

논블로킹 에이전트 실행 시스템:

```typescript
const { taskId } = launch({
  prompt: 'Analyze codebase',
  agentName: 'analyzer',
  model: 'claude-sonnet-4-5'
});
// 즉시 반환 (<100ms), 나중에 poll(taskId)로 결과 확인
```

**동시성 제어:**
- Opus: 3 concurrent
- Sonnet: 5 concurrent
- Haiku: 8 concurrent

### 7. Phase Pipelining
**AI 기여도: 70%**

현재 Phase 실행 중 다음 Phase 사전 준비:

```
Phase N 실행 중     │ 백그라운드: Phase N+1 준비
────────────────────┼────────────────────────────
[구현 중...]        │ [다음 Phase 파일 분석]
[테스트 중...]      │ [테스트 케이스 사전 생성]
[완료]              │ [즉시 시작 가능!]
```

**성능 향상:**
- Sequential: ~10min (5 Phases)
- Parallel: ~7.5min
- **ULTRAWORK + Pipeline: ~5min** (50% 단축)

## Technical Highlights

### 1. 마커 기반 문서 관리 시스템

**문제:** `vibe update` 실행 시 CLAUDE.md에 내용이 계속 누적 (17,929줄까지 증가)

**해결:**
```typescript
const VIBE_END_MARKER = '<!-- VIBE:END -->';

// 마커 기반 정확한 섹션 교체
const vibeEndIdx = content.indexOf(VIBE_END_MARKER);
const afterVibe = content.substring(vibeEndIdx + VIBE_END_MARKER.length);

// 중복 VIBE 내용 자동 감지 및 제거
const isVibeContent = cleanedAfterVibe.includes('SPEC-driven AI Coding Framework');
if (isVibeContent) afterVibe = '';  // 중복 버림
```

**결과:** 17,929줄 → 693줄 (96% 감소), idempotent 업데이트

### 2. 23개 언어 프리셋 자동 감지

프로젝트의 `package.json`, `requirements.txt`, `go.mod` 등을 분석하여 기술 스택 자동 감지 후 해당 언어 규칙 적용:

- TypeScript, Python, Go, Rust, Swift, Kotlin
- React, Vue, Flutter, Android, iOS
- FastAPI, NestJS, Express, Rails

### 3. Requirements Traceability Matrix

요구사항 → SPEC → Feature → Test 추적:

```
REQ-login-001 → SPEC Phase 1 → Feature Scenario 1 → login.test.ts
REQ-login-002 → SPEC Phase 2 → Feature Scenario 3 → auth.test.ts
```

## Metrics

| Metric | Value |
|--------|-------|
| npm Weekly Downloads | 500+ |
| GitHub Stars | 50+ |
| Supported Languages | 23 |
| Review Agents | 13+ |
| Built-in Tools | 35+ |
| Code Quality Score | 83/100 (B) |

## Lessons Learned

### What Worked Well
1. **Multi-LLM 전략**: 단일 모델 의존보다 작업별 최적 모델 라우팅이 효과적
2. **마커 기반 관리**: 문서 섹션 경계를 명시적으로 표시하여 누적 방지
3. **Fire-and-Forget 패턴**: 블로킹 없이 병렬 작업 실행으로 성능 향상

### Challenges & Solutions
1. **컨텍스트 유실**: `/compact` 대신 명시적 `save_memory` + 새 세션 전략
2. **LLM 응답 불일치**: Race Review로 교차 검증, 일치도 기반 신뢰도 산출
3. **문서 누적**: 마커 + 중복 감지 로직으로 idempotent 업데이트 구현

## Future Plans

1. **MCP Integration**: Model Context Protocol 기반 도구 확장
2. **Visual Regression Testing**: Playwright 기반 UI 자동 테스트
3. **Custom Agent Builder**: 사용자 정의 리뷰 에이전트 생성 기능

---

## Contact

- GitHub: [su-record](https://github.com/su-record)
- npm: [@su-record/vibe](https://www.npmjs.com/package/@su-record/vibe)
