---
slug: post-task-curation
status: draft
scope: internal
authors: [su-record, claude]
registered: 2026-05-07
related-skills: [vibe-regress, vibe-verify, vibe-utils]
ssot-files:
  - hooks/scripts/step-counter.js
  - src/cli/commands/init.ts
  - skills/vibe-regress/SKILL.md
  - CLAUDE.md
new-files:
  - .vibe/recipes/<slug>.md
  - .vibe/anti-patterns/<slug>.md
  - skills/vibe-learn/SKILL.md
  - skills/vibe-learn/templates/{recipe,anti-pattern}.md
naming-decision: |
  `.vibe/recipes/` 와 `.vibe/anti-patterns/` 는 top-level. `.vibe/regressions/`,
  `.vibe/contracts/` 와 동급. `.dev/learnings/` (사람이 쓰는 free-form
  troubleshooting) 와 이름이 겹치지 않도록 `learnings` 단어를 회피.
---

# Post-Task Curation — Learn Once, Reuse Forever

**Purpose**: Browser Use가 브라우저 도메인에서 한 것을 vibe는 개발 워크플로 도메인에서 한다. 한 agent가 어렵게 풀어낸 task의 경로를 다음 agent의 1회차 출발점으로 만든다.

## Why this exists

지금 vibe는 *실패*만 학습한다 (`/vibe.verify` fail → `/vibe.regress`). 그러나 동등하게 값나가는 두 신호가 버려지고 있다:

1. **3회+ 재시도 끝에 성공한 task의 경로** — 다음 agent에 압축 recipe로 전달하면 1~3회 호출로 재현 가능.
2. **3회 연속 같은 카테고리 실패** — 패치를 멈추라는 신호 (CLAUDE.md "Debugging Rules"). 멈출 뿐 아니라 *기록*해야 한다.

둘 다 `step-counter.js` 가 이미 수집 중인 tool-call 메타데이터를 살짝 늘리면 잡힌다.

## Goal — Verifiable

**G1.** `/vibe.run` 도중 같은 (file, error-category) 가 3회 발생하면 60초 안에 `.vibe/anti-patterns/<slug>.md` 가 자동 생성된다 — 사용자 개입 없이.

**G2.** `/vibe.run` 종료 시 retry_count ≥ 3 인 tool-call 시퀀스 중 최종 success 인 구간이 1개 이상 있으면 `.vibe/recipes/<slug>.md` 가 생성된다.

**G3.** `/vibe.utils --continue` 가 `.vibe/{recipes,anti-patterns}/` 의 frontmatter 인덱스를 읽어 다음 세션 system-context 에 prepend 한다 (제목 + symptom + 1줄 추천만 — 본문 아님).

**G4.** 신규 디렉토리 `.vibe/{recipes,anti-patterns}/` 가 `vibe init` 으로 생성되고, gitignore SSOT 가 갱신되어 commit 가능하다.

**Non-goals**: ① recipe 자동 *적용*. agent가 읽고 판단할 뿐 강제 실행 없음. ② 시각화 UI. ③ 글로벌 (cross-project) skill 승격 — 이번 SPEC은 project-local 만.

## Architecture

```
┌──────────────────────┐
│  PostToolUse hook    │  step-counter.js (확장)
│  - tool, args, ok    │  → .vibe/metrics/current-run.jsonl (append)
│  - retry tracking    │  → 3-fail trip 시 inline anti-pattern.md 생성
└──────────┬───────────┘
           │ stream
           ▼
┌──────────────────────┐
│  Run terminator      │  /vibe.run 종료 시점 또는 SessionEnd
│  - jsonl 분석         │  → recipe 후보 추출 (retry≥3 + success)
│  - LLM 요약 (선택)     │  → .vibe/recipes/<slug>.md
└──────────────────────┘
           │
           ▼
┌──────────────────────┐
│  Next session bootstrap │  /vibe.utils --continue
│  learnings index 로드   │  → context prepend (title + 1-line)
└──────────────────────┘
```

**Why two layers (inline trip + post-run extract)**:
- Anti-pattern 은 *멈춰야 할 신호* — 즉시 기록해야 다음 시도가 영향을 받음.
- Recipe 는 *완성된 경험* — task 가 끝나야 "이게 정답이었다"는 라벨이 붙음.

## File changes (precise)

### A. `.vibe/{recipes,anti-patterns}/` 디렉토리 + gitignore SSOT

| File | Change |
|---|---|
| `src/cli/commands/init.ts:353` | 배열에 `'recipes'`, `'anti-patterns'` 추가 |
| `src/cli/commands/init.ts:359-361` (README 생성 부) | `recipes/`, `anti-patterns/` 두 줄 추가 |
| `CLAUDE.md` Git Include 라인 (105-107) | `.vibe/{recipes,anti-patterns}/` 를 Include 로 |
| `~/.claude/CLAUDE.md` 글로벌 동치 라인 | 동일 갱신 |

### B. `step-counter.js` 확장 (현재 46줄 → ~110줄 예상)

기존: `current-run.json` 의 `steps += 1` 만.

추가 책임:
1. `tool`, `success`, `error_category`, `target_file` (best-effort) 를 `current-run.jsonl` 에 append 라인으로 쓴다.
2. **3-fail detector**: 같은 `(target_file, error_category)` 가 마지막 N=10 라인 안에 3회 ≥ → anti-pattern md 생성 (LLM 호출 *없이*, 템플릿 채움).
3. recursion guard 유지 (env `VIBE_HOOK_DEPTH` 기존 패턴).

`error_category` 분류는 lightweight regex 셋 (이미 있는 `root-cause-tag` enum 재사용 — 18개 안 됨, 11개).

### C. `vibe-learn` skill 신설 (post-run extractor)

```
skills/vibe-learn/
  SKILL.md
  templates/
    recipe.md
    anti-pattern.md
```

Subcommands:
- `extract` — `current-run.jsonl` 분석 → recipe 후보 출력 (LLM)
- `index` — `.vibe/{recipes,anti-patterns}/*.md` frontmatter 모아 1-line 인덱스 반환
- `consume` — `/vibe.utils --continue` 가 호출, 인덱스를 system-context 형식으로 직렬화

### D. `/vibe.run` 및 `/vibe.verify` 종료 hook 추가

`/vibe.run` 의 마지막 phase 에 `vibe-learn extract` 호출. 실패 시 silent (학습 자산은 best-effort).

`/vibe.verify` 는 기존 `--from-verify` 패턴(라인 246-263) 옆에 `--from-task` 분기를 추가 — 동일한 자동-등록 패턴.

### E. ~~수동 진입점~~ — 제외 (자동만)

수동 `/vibe.learn` 명령은 만들지 않는다. 모든 학습 자산은 `step-counter.js` (anti-pattern) 와 `/vibe.run` 종료 hook (recipe) 두 곳에서만 자동 생성. 사용자는 결과물 (`.vibe/{recipes,anti-patterns}/`) 만 본다.

## Frontmatter schema — `.vibe/{recipes,anti-patterns}/`

```yaml
# recipes/<slug>.md
slug: string                     # kebab-case
type: recipe
symptom-context: string          # "Google Flights 도시 입력 시" 같은
recipe: string                   # 1-3줄 압축
tools-touched: [string]          # ["Bash", "Edit"] 등
retry-count-saved: int           # 첫 시도 N회 → 다음엔 1-3회 가정
created: YYYY-MM-DD
source-run: string               # current-run.jsonl 의 run_id
confidence: low | medium | high  # 1회만 본 vs 3회+ 동일 패턴

# anti-patterns/<slug>.md
slug: string
type: anti-pattern
root-cause-tag: enum             # vibe-regress 의 11개 enum 재사용
trigger-signature: string        # "(file=*.test.ts, category=type-narrow)"
fail-count: int                  # 트립 시점 N
suggested-stop: string           # "이 파일은 구조 문제 — 패치 대신 X 검토"
created: YYYY-MM-DD
```

**재사용**: `root-cause-tag` enum 은 `skills/vibe-regress/SKILL.md:39-55` 와 *bit-for-bit identical*. 신규 enum 만들지 않음. 새 카테고리 필요 시 양쪽에 동시 추가.

## Phases

### Phase 1 — 인프라 (G4 + 부분 G1)
- `.vibe/{recipes,anti-patterns}/` SSOT 갱신 (init.ts, README, CLAUDE.md)
- `step-counter.js` jsonl 로깅으로 확장 (3-fail 감지는 아직)
- 테스트: `tests/hooks/step-counter.test.ts`
- DoD: `vibe init` 후 `.vibe/{recipes,anti-patterns}/` 존재, jsonl 1라인이라도 쓰임

### Phase 2 — Anti-pattern 자동 기록 (G1 완성)
- 3-fail detector 추가
- 템플릿 기반 anti-pattern md 생성 (LLM 없음)
- 테스트: 동일 file+category 3회 누적 시 md 생성 검증
- DoD: G1 통과

### Phase 3 — Recipe 추출 + 다음 세션 inject (G2 + G3)
- 트리거: **`/vibe.verify` 마지막** (history.jsonl append 직후, 라인 201-202 사이) — bash 한 줄 hook 호출.
- 신규 스크립트: `hooks/scripts/recipe-extractor.js` (독립). LLM 호출 = `claude --print --model claude-haiku-4-5-20251001` *우선 시도*, `--model` 플래그 미지원이면 `--model` 빼고 재호출. 실패 시 silent.
- 휴리스틱 게이트: `total_tools ≥ 8 AND fail_count ≥ 3` 통과 시만 LLM 호출.
- 산출: `.vibe/recipes/<slug>.md` (slug = `{feature}__{YYYYMMDD-HHMMSS}`). frontmatter: `slug, type=recipe, symptom-context, recipe, tools-touched, retry-count-saved, created, source-run, confidence`.
- session-start.js 확장: 기존 메모리 로드 다음에 `.vibe/recipes/*.md` + `.vibe/anti-patterns/*.md` 디렉토리 스캔. frontmatter 만 parse, 본문 X. 최근 N=5 출력.
- 인덱싱: **디렉토리 스캔** — INDEX.jsonl 없음. 파일 수 <100 가정.
- 테스트: recipe-extractor 는 `VIBE_RECIPE_LLM=mock` 환경변수로 LLM 호출 스킵 가능. session-start 는 격리 디렉토리에서 frontmatter parse 만 검증.
- DoD: G2, G3 통과

각 Phase 는 독립 PR. Phase 1만 단독 머지 가능 (인프라 추가 + 후행 호환).

## Risks / Open Questions

1. **LLM 호출 비용** — Phase 3 recipe 추출이 매 run 마다 LLM 부르면 비싸다. → 휴리스틱 게이트 (retry_count ≥ 3 *이고* total_tools ≥ 8) 통과 시만 호출. **모델: Haiku** (CLAUDE.md "Exploration → Haiku" 와 일치 — 요약 작업이고 정확도보다 처리량). 사용자가 `quick` 키워드 쓰면 스킵.

2. **거짓 양성 anti-pattern** — file 경로 normalize 안 하면 같은 파일을 다른 path 로 본다. → relative path + symlink resolve.

3. **error_category 분류 정확도** — regex 기반은 거칠다. 처음엔 `other` 빈도가 높을 것. 운영하며 enum 확장.

4. **Cross-session contamination** — 다른 feature 의 learning 이 현재 세션에 prepend 되면 노이즈. → `feature` 필드로 필터, 같은 feature 또는 cross-cutting (`feature: '*'`) 만.

5. **SessionEnd hook 존재 여부** — Claude Code harness 가 native SessionEnd 를 쏘는지 미확인. 없다면 `/vibe.run` 의 마지막 phase 에서 명시 호출 (현재 매핑 결과). Codex harness 는 config.toml notify 의 agent-turn-complete 가 등가물.

6. **글로벌 승격 경로** — Phase 3 까지는 project-local. 향후 confidence=high + 다수 프로젝트 등장 시 `~/.claude/skills/` 승격 — 별 SPEC.

## Acceptance

- [ ] G1–G4 자동화 테스트 통과
- [ ] `vibe init` 후 신규 프로젝트에서 `.vibe/{recipes,anti-patterns}/` 가짐
- [ ] 기존 `/vibe.run`, `/vibe.verify`, `/vibe.regress` 동작 회귀 없음 (회귀 테스트 추가)
- [ ] Phase 1 단독으로도 머지 가능 (Phase 2, 3 미구현 상태에서 깨지지 않음)
- [ ] CLAUDE.md / AGENTS.md / README 갱신 (AGENTS.md 는 `/vibe.docs agent` 로 회생성)

## Out of scope (다음 SPEC)

- Project-local recipe → global skill 자동 승격 (포스팅의 254-agent reuse 단계)
- Cross-project knowledge graph
- Recipe 자동 적용 (agent 결정에만 영향, 강제 실행 없음 — 이건 영구히 out)
- UI / dashboard
