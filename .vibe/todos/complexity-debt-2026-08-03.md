# TODO: 복잡도 부채 상환

> 출처: `.vibe/specs/repo-hygiene-remediation.md` REQ-014 (측정 후 판단).
> 2026-08-03 oxlint 도입 시점 실측. 라쳇(`pnpm lint:ratchet`)이 상한을 잡고 있으므로
> **부채는 늘지 않는다.** 아래는 줄이는 작업의 우선순위다.

## 측정 결과

CLAUDE.md 한계(함수 ≤50줄 · 중첩 ≤3 · 복잡도 ≤10) 위반 **435건**:

| 규칙 | 건수 |
|---|---|
| `complexity` (>10) | 180 |
| `max-depth` (>3) | 156 |
| `max-lines-per-function` (>50) | 99 |

위반 상위 파일:

| 위반 | 파일 | 줄 수 |
|---|---|---|
| 32 | `src/infra/lib/codex-proxy.ts` | 1143 |
| 17 | `hooks/scripts/figma-extract.js` | 881 |
| 16 | `src/infra/lib/gpt/chat.ts` | 594 |
| 15 | `hooks/scripts/clone-refine.js` | 642 |
| 13 | `src/infra/lib/llm/utils/stream.ts` | — |
| 8 | `hooks/scripts/clone-extract.js` | 1306 |

## 판단: 줄 수는 나쁜 대리지표였다

리뷰에서 "대형 파일"로 지목했던 두 파일의 실측 결과가 갈렸다.

- `clone-extract.js` — **저장소에서 가장 긴 파일(1306줄)인데 위반은 8건, 6위권.** 길지만 함수 단위로는 평탄하다. 쪼갤 이유가 없다.
- `codex-proxy.ts` — 1143줄에 **위반 32건으로 1위.** 여기는 실제 복잡도 부채다.

줄 수만 보고 분해했다면 잘못된 파일을 건드릴 뻔했다. CLAUDE.md 의 "측정 없이 최적화하지 않는다" 가 그대로 적용된 사례다.

## 왜 지금 손대지 않는가

`codex-proxy.ts` 의 **커버리지가 43.19%** 다. 이 상태에서 32건을 리팩터링하면 절반 이상의 경로가
검증되지 않은 채 구조가 바뀐다 — **측정된 부채를 미측정 회귀 위험과 맞바꾸는 거래**다.
라쳇이 이미 증가를 막고 있으므로 서두를 이유가 없다.

## 순서

- [ ] **P1 — `codex-proxy.ts` 커버리지 선행 인상** (43% → 70%+). 리팩터링의 안전망을 먼저 만든다.
- [ ] **P2 — `codex-proxy.ts` 위반 32건 상환.** 커버리지 확보 후. 완료 시 `pnpm lint:ratchet --update` 로 baseline 을 조인다.
- [ ] **P3 — 나머지 상위 파일.** `figma-extract.js`(17) → `gpt/chat.ts`(16) → `clone-refine.js`(15) 순.

각 단계는 baseline 을 **줄이는 방향으로만** 갱신한다. 늘리려면 리뷰에서 정당화돼야 한다.
