# vibe.run — E2E Closed Loop & Auto-Fix

> vibe.run SKILL.md Automated Verification 에서 참조. UI 시나리오 E2E 루프와 실패 시 자동 수정 절차.

### E2E Closed Loop (UI Scenarios)

**UI 시나리오가 포함된 Feature일 때 자동 활성화.**

Browser Tool Priority:

| Priority | Tool | 용도 | 없을 때 |
|----------|------|------|---------|
| 1st | Playwright Test Runner | 테스트 코드 실행, **pass/fail 만** 소비 | `npx playwright install chromium` |
| 2nd | Playwright MCP (DOM) | spec 으로 표현 못 하는 확인, 최후 수단 | — |

> 검증 비용이 루프 횟수를 정한다. 1순위는 상호작용 내용을 spec 파일에 남기고
> 컨텍스트에는 exit code 만 들인다. DOM 을 컨텍스트로 끌어오는 2순위는 2~3회면
> 예산을 태우므로 기본값이 아니라 예외로 쓴다.

**활성화 조건:** Feature 파일에 UI 관련 시나리오 존재 + `.vibe/e2e/config.json`의 `closedLoop.enabled: true` (기본값) + dev server가 실행 중

### Auto-Fix on Failure

```
Scenario verification failed
      ↓ [Collect evidence]
      ↓ [Root cause analysis]
      ↓ [Read target file FULLY]
      ↓ [Implement fix]
      ↓ [Re-verify failed scenario only]
      Repeat until pass (stuck 감지로 종료)
```

**Termination conditions (loop-contract JUDGE):**
- PASS → 다음 scenario
- stuck (같은 failure가 이전 라운드와 동일, `loop-ledger.js check-stuck`) → automationLevel confirm: 사용자 질문; autonomous: TODO + next scenario

**Stakes 프로파일 (SSOT: `vibe/rules/loop-contract.md` Stakes 표):**
- `demo`/`prototype` → max_iterations 1, 리뷰 1패스, **검증 스크립트 신규 생성 금지** — 검증은 기존 테스트 러너·브라우저 게이트만 사용한다. 새 verify_*.py / 검증 전용 스크립트 파일을 만들지 않는다.
- JUDGE 검증 산출물 절제 (모든 stakes): 이번 feature 신규 검증 코드 줄 수가 신규 구현 코드 줄 수를 초과하면 (`git diff --numstat` 기준) **최종 보고에 P2 경고 1줄**을 적는다. run-ledger 에는 적재하지 않는다 (경고 필드 없음). advisory — 게이트 통과 여부는 불변.

---

