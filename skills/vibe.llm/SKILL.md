---
name: vibe.llm
description: Refresh available models for claude/openai(api+oauth)/gemini/zai as of now and update the vibe model SSOT
argument-hint: "list | refresh"
user-invocable: true
---

# /vibe.llm

현재 시점 기준으로 각 LLM provider(claude, openai API+oauth, gemini, zai)의
**사용 가능한 모델을 최신화**하고, vibe 가 쓰는 **모델 SSOT(`~/.vibe/config.json` models)**를 갱신한다.

## Usage

```
/vibe.llm list        # provider 별 현재 사용 가능한 모델 표시 (★ = 추천/최신)
/vibe.llm refresh     # 라이브 조회 → 추천 모델을 config.json models 에 반영
```

CLI 로도 동일하게 동작한다:

```
vibe llm list
vibe llm refresh
```

## 동작

1. **라이브 조회** — 각 provider 의 list-models API 호출:
   - claude: `GET /v1/models` (ANTHROPIC_API_KEY)
   - openai: `GET /v1/models` (OPENAI_API_KEY). 키 없이 oauth(Codex)만 있으면 큐레이션 목록 표시
   - gemini: `GET /v1beta/models` (GEMINI_API_KEY)
   - zai: `GET /models` (coding/general 키)
2. **fallback** — 키가 없거나 API 실패 시 in-repo 큐레이션 목록을 사용(무네트워크에서도 동작)
3. **SSOT 갱신** — provider 별 추천(최신) 모델을 `~/.vibe/config.json` 의 `models`
   (gpt, gemini, zai, zaiCoding)에 기록. 변경 내역을 출력한다.

> Claude 모델은 Claude Code tier(sonnet/opus/haiku alias)로 관리되므로 자동으로 덮어쓰지 않고
> 조회 결과만 표시한다.

## 구현 위치

- CLI: `src/cli/commands/llm.ts` → `src/cli/llm/model-refresh.ts`
- SSOT: `~/.vibe/config.json` `models` (ModelOverrides)

이 스킬은 위 CLI 를 호출하고 결과(변경된 모델 SSOT)를 요약해 보고한다.

---

ARGUMENTS: $ARGUMENTS
