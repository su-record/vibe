---
description: End-to-end testing with Closed Loop automation
argument-hint: "test scenario or URL"
---

# /vibe.e2e

**Closed Loop E2E Testing** - AI가 직접 브라우저를 조작하여 검증하고, 실패 시 자동 수정을 반복

## Philosophy: Closed Loop

```
구현 → 검증 → 실패 → 수정 → 재검증 → ... → 통과
       ↑_________________________________↓

사람 개입 없이 AI가 루프를 완주한다.
검증이 가벼울수록 루프는 더 많이 돈다.
```

## Usage

```
/vibe.e2e                              # Run all E2E tests
/vibe.e2e "login flow"                 # Test specific scenario
/vibe.e2e http://localhost:3000/login  # Test specific URL
/vibe.e2e --visual                     # Visual regression testing
/vibe.e2e --record                     # Record test video
```

## Browser Tool Selection (Token Efficiency)

**검증 비용이 비싸면 루프가 돌지 않는다.**

| Tool | 클릭 1회 토큰 | 방식 | Closed Loop 적합성 |
|------|-------------|------|-------------------|
| Playwright MCP | ~12,000+ chars | DOM 트리 전체 전달 | Bad - 2~3회 만에 컨텍스트 소진 |
| Agent Browser | ~6 chars | 접근성 트리 (의미만 추출) | Good - 수십 회 루프 가능 |
| Playwright Test Runner | N/A (코드 실행) | 테스트 코드 결과만 반환 | Good - pass/fail만 반환 |

### Tool Priority

```
1. Agent Browser (MCP) — AI가 직접 브라우저 조작, 접근성 트리 기반 (최소 토큰)
2. Playwright Test Runner — 테스트 코드 작성 후 실행, 결과만 수신 (pass/fail)
3. Playwright MCP — DOM 기반 직접 조작 (토큰 비효율, 최후 수단)
```

### Why Accessibility Tree?

```
DOM (Playwright MCP):
  div class="nav-wrapper mx-4 flex items-center justify-between..." → 200+ chars

Accessibility Tree (Agent Browser):
  button "Sign In" → 15 chars

AI에게 필요한 건 후자다.
시각장애인용 스크린 리더가 쓰는 트리가, AI 에이전트에게도 최적의 웹 표현이다.
```

## Core Features

- Screenshot Capture - Record UI state
- Console Error Collection - Detect JS errors
- Network Monitoring - Detect API failures
- Visual Regression - Compare screenshots
- Video Recording - Bug reproduction evidence
- Accessibility Check - Detect a11y violations

## Process

### Phase 1: Environment Detection

```
1. Agent Browser MCP 사용 가능? → 사용 (최우선)
2. Playwright 설치됨? → npx playwright --version
3. 없으면 → npx playwright install chromium
```

### Phase 2: Test Scenario Analysis

```
Scenario Detection
├── .claude/vibe/features/{feature}.feature → Extract BDD scenarios
├── .claude/vibe/specs/{feature}.md → Check acceptance criteria
└── Analyze existing e2e/*.spec.ts
```

**File Reading Policy**: Feature/SPEC 파일은 반드시 Read 도구로 전체 읽을 것.

### Phase 3: Closed Loop Execution

```
┌─────────────────────────────────────────────────────────────────┐
│  CLOSED LOOP E2E VERIFICATION                                    │
│                                                                  │
│  For each scenario in Feature file:                              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Scenario: "User submits notification form"                │    │
│  │                                                           │    │
│  │  [Browser] Navigate to URL                                │    │
│  │  [Browser] Find form (accessibility tree)                 │    │
│  │  [Browser] Fill inputs                                    │    │
│  │  [Browser] Click submit                                   │    │
│  │  [Browser] Check success message                          │    │
│  │       │                                                   │    │
│  │       ├─ PASS → Next scenario                             │    │
│  │       └─ FAIL → Root cause analysis                       │    │
│  │              → Fix code                                   │    │
│  │              → Re-run scenario (max 3 retries)            │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  All scenarios pass → DONE                                       │
│  Max retries exceeded → Report failures                          │
└─────────────────────────────────────────────────────────────────┘
```

**Agent Browser approach (preferred):**

```
AI directly controls browser:
  1. navigate("http://localhost:3000/login")
  2. type("email field", "test@example.com")
  3. type("password field", "password123")
  4. click("Sign In")
  5. assert: page contains "Dashboard"

Each action: ~6-20 chars of context (accessibility tree)
Total scenario: ~100-200 chars
→ Can run 50+ scenarios in one session
```

**Playwright Test Runner approach (fallback):**

```typescript
// Auto-generated lightweight test
import { test, expect } from '@playwright/test';

test('login flow', async ({ page }) => {
  await page.goto('http://localhost:3000/login');
  await page.fill('[data-testid="email"]', 'test@example.com');
  await page.fill('[data-testid="password"]', 'password123');
  await page.click('[data-testid="submit"]');
  await page.waitForURL('**/dashboard');
  await expect(page.locator('h1')).toContainText('Dashboard');
});
```

```bash
# Run and get pass/fail only (minimal token usage)
npx playwright test --reporter=line 2>&1 | tail -5
```

### Phase 4: Auto-Fix Loop (Closed Loop Core)

```
E2E scenario FAILED
      │
      ↓
[Collect evidence]
  - Screenshot of failure state
  - Console errors
  - Network failures
  - Accessibility tree snapshot (lightweight)
      │
      ↓
[Root cause analysis]
  - Which step failed? (Given/When/Then)
  - Error type? (element not found / assertion failed / network error)
      │
      ↓
[Fix implementation]
  - Read target source file (FULL, not Grep)
  - Apply minimal fix
      │
      ↓
[Re-run ONLY failed scenario]
  - Don't re-run passed scenarios (save tokens)
      │
      ↓
  PASS → Continue to next scenario
  FAIL → Retry (max 3)
  3x FAIL → Report as manual fix needed
```

### Phase 5: Visual Regression (--visual)

```
Comparing screenshots:
├── login-page.png
│   ├── Baseline: .claude/vibe/e2e/baseline/login-page.png
│   ├── Current:  .claude/vibe/e2e/current/login-page.png
│   └── Diff: 0.02% (threshold: 1%) → PASS
├── dashboard.png
│   └── Diff: 5.3% (threshold: 1%) → FAIL → auto-fix loop
```

### Phase 6: Accessibility Check

```typescript
import { injectAxe, checkA11y } from 'axe-playwright';

test('accessibility check', async ({ page }) => {
  await page.goto('/login');
  await injectAxe(page);
  await checkA11y(page, null, {
    detailedReport: true,
    detailedReportOptions: { html: true }
  });
});
```

## Output

```
E2E CLOSED LOOP RESULTS

Test Suite: Login Flow
Duration: 12.3s
Browser Tool: Agent Browser (accessibility tree)
Loop Iterations: 2 (1 auto-fix applied)

Results:
  Passed: 8 (1 after auto-fix)
  Failed: 0
  Skipped: 0

Auto-Fixes Applied:
  1. Scenario "invalid password error"
     Root cause: Missing error message element
     Fix: Added error toast in LoginForm.tsx:42
     Re-test: PASSED

Console Errors: 0
Accessibility Issues: 0

Token Usage: ~2,400 chars (vs ~96,000 with DOM-based approach)
```

## Configuration

`.claude/vibe/e2e/config.json`:

```json
{
  "baseURL": "http://localhost:3000",
  "browsers": ["chromium"],
  "viewport": { "width": 1280, "height": 720 },
  "browserTool": "auto",
  "closedLoop": {
    "enabled": true,
    "maxRetries": 3,
    "autoFix": true,
    "rerunFailedOnly": true
  },
  "video": "retain-on-failure",
  "screenshot": "only-on-failure",
  "trace": "retain-on-failure",
  "visualRegression": {
    "enabled": true,
    "threshold": 0.01
  },
  "accessibility": {
    "enabled": true,
    "rules": ["wcag2aa"]
  }
}
```

## Integration with /vibe.run

`/vibe.run` 에서 UI 시나리오 구현 후 자동으로 Closed Loop E2E 검증 트리거:

```
/vibe.run "login" ultrawork
  ├── Phase 1: Implement login form
  ├── Phase 2: Implement validation
  ├── [AUTO] E2E Closed Loop verification
  │   ├── Scenario 1: valid login → PASS
  │   ├── Scenario 2: invalid password → FAIL → auto-fix → PASS
  │   └── Scenario 3: email validation → PASS
  └── All scenarios verified → Complete
```

## Related Commands

- `/vibe.review` - Code review
- `/vibe.verify` - SPEC verification
- `/vibe.run` - Implementation with auto-verification

---

ARGUMENTS: $ARGUMENTS
