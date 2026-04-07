---
name: chub-usage
tier: optional
description: "Context Hub (chub) — 검수된 최신 API 문서 조회. 외부 API/SDK 코드 작성 시 training data 대신 최신 문서를 기반으로 정확한 코드 작성."
triggers: [chub, context hub, API docs, latest API, deprecated API, SDK documentation, api reference, 최신 문서]
priority: 65
---

# Context Hub (chub) Usage

외부 API/SDK 코드 작성 전 검수된 최신 문서를 가져오는 스킬.
Training data의 지식 컷오프 문제를 해결합니다.

## Why?

| Problem | Solution |
|---------|----------|
| Training data에 의존 → deprecated API 사용 | chub get → 검수된 최신 문서 기반 코드 |
| 웹 검색 → 노이즈 섞인 결과 | chub search → 큐레이션된 문서만 |
| 세션마다 같은 실수 반복 | chub annotate → 학습 누적 |

## Prerequisites

```bash
npm install -g @aisuite/chub
```

## When to Use

| Situation | Example |
|-----------|---------|
| 외부 API 코드 작성 | "Stripe 결제 연동해줘" |
| SDK 최신 버전 확인 | "OpenAI 최신 모델 호출" |
| 공식 문서 필요 | "Supabase auth 설정" |
| Deprecated 패턴 방지 | "Firebase v10 마이그레이션" |

## Workflow

```
외부 API/SDK 코드 작성 요청
    ↓
Step 1: chub search "<라이브러리명>"
    ↓
Step 2: chub get <id> --lang ts
    ↓
Step 3: 문서 기반 코드 작성
    ↓
Step 4: gotcha 발견 시 chub annotate
```

## Usage

### Step 1 — 문서 검색

```bash
chub search "stripe"
chub search "openai"
chub search ""           # 전체 목록 확인
```

### Step 2 — 최신 문서 fetch

```bash
chub get stripe/api --lang ts
chub get openai/chat --lang py
chub get supabase/auth --lang js
```

### Step 3 — 문서 기반 코드 작성

fetch한 문서 내용을 기반으로 정확한 코드 작성.
**절대 training data에 의존하지 않는다. 문서 먼저, 코드 나중.**

### Step 4 — 학습 내용 기록

작업 중 발견한 gotcha, workaround, 버전 이슈:

```bash
chub annotate stripe/api "한국 결제는 pg 파라미터 필수"
chub annotate openai/chat "streaming에서 tool_calls는 delta로 옴"
chub annotate firebase/auth "v10에서 getAuth() import 경로 변경"
```

Annotation은 로컬 저장, 다음 세션에서 `chub get` 시 자동으로 같이 나옴.

## Implementation Pattern (Subagent)

컨텍스트 블로트 방지를 위해 서브에이전트에서 실행:

```
Task tool call:
- subagent_type: Explore
- model: haiku
- prompt: "Run `chub search <library>` then `chub get <id> --lang <lang>` to fetch latest API documentation for [topic]. Return only the relevant API usage examples, key changes from previous versions, and any annotations."
```

서브에이전트가 chub 호출을 처리하고 요약만 반환 → 메인 컨텍스트 깨끗하게 유지.

## Supported APIs (1,000+)

OpenAI, Anthropic, Stripe, Firebase, Supabase, Vercel, AWS S3, Cloudflare Workers, Auth0, Clerk 등.

```bash
chub search    # 인자 없이 실행하면 전체 목록 확인 가능
```

## Fallback Chain

```
chub 설치 안 됨
    ↓
Prompt: npm install -g @aisuite/chub
    ↓
If still unavailable: context7 또는 Web Search fallback
```
