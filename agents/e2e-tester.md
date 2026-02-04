---
description: End-to-end testing with Playwright automation
argument-hint: "test scenario or URL"
---

# /su.e2e

**E2E Test Automation** - Playwright-based browser testing

## Usage

```
/su.e2e                              # Run all E2E tests
/su.e2e "login flow"                 # Test specific scenario
/su.e2e http://localhost:3000/login  # Test specific URL
/su.e2e --visual                     # Visual regression testing
/su.e2e --record                     # Record test video
```

## Core Features

```
┌─────────────────────────────────────────────────────────────────┐
│  🎭 Playwright E2E Testing                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ Screenshot Capture - Record UI state                        │
│  ✅ Console Error Collection - Detect JS errors                 │
│  ✅ Network Monitoring - Detect API failures                    │
│  ✅ Visual Regression - Compare screenshots                     │
│  ✅ Video Recording - Bug reproduction evidence                 │
│  ✅ Accessibility Check - Detect a11y violations                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Process

### Phase 1: Environment Setup

```bash
# Check Playwright installation
npx playwright --version

# Install browsers if needed
npx playwright install chromium
```

### Phase 2: Test Scenario Analysis

```
📋 Scenario Detection
├── .claude/core/features/{feature}.feature → Extract BDD scenarios
├── .claude/core/specs/{feature}.md → Check acceptance criteria
└── Analyze existing e2e/*.spec.ts
```

### Phase 3: Test Execution

**Single Page Test:**
```typescript
// Auto-generated test
import { test, expect } from '@playwright/test';

test('login flow', async ({ page }) => {
  // Navigate
  await page.goto('http://localhost:3000/login');

  // Screenshot: initial state
  await page.screenshot({ path: 'screenshots/login-initial.png' });

  // Fill form
  await page.fill('[data-testid="email"]', 'test@example.com');
  await page.fill('[data-testid="password"]', 'password123');

  // Submit
  await page.click('[data-testid="submit"]');

  // Wait for navigation
  await page.waitForURL('**/dashboard');

  // Screenshot: success state
  await page.screenshot({ path: 'screenshots/login-success.png' });

  // Assertions
  await expect(page.locator('h1')).toContainText('Dashboard');
});
```

**Console Error Collection:**
```typescript
test.beforeEach(async ({ page }) => {
  // Collect console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`Console Error: ${msg.text()}`);
    }
  });

  // Collect network failures
  page.on('requestfailed', request => {
    console.log(`Request failed: ${request.url()}`);
  });
});
```

### Phase 4: Visual Regression (--visual)

```
┌─────────────────────────────────────────────────────────────────┐
│  👁️ Visual Regression Test                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Comparing screenshots:                                          │
│                                                                 │
│  ├── login-page.png                                             │
│  │   ├── Baseline: .claude/core/e2e/baseline/login-page.png           │
│  │   ├── Current:  .claude/core/e2e/current/login-page.png            │
│  │   └── Diff: ✅ 0.02% (threshold: 1%)                         │
│  │                                                              │
│  ├── dashboard.png                                              │
│  │   ├── Baseline: .claude/core/e2e/baseline/dashboard.png            │
│  │   ├── Current:  .claude/core/e2e/current/dashboard.png             │
│  │   └── Diff: ❌ 5.3% (threshold: 1%)                          │
│  │       └── .claude/core/e2e/diff/dashboard-diff.png                 │
│  │                                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 5: Accessibility Check

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

### Phase 6: Bug Reproduction (Optional)

Link with bug reports:

```
/su.e2e --reproduce "User sees blank page after login"

┌─────────────────────────────────────────────────────────────────┐
│  🐛 Bug Reproduction Mode                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Steps executed:                                                │
│  1. ✅ Navigate to /login                                       │
│  2. ✅ Enter credentials                                        │
│  3. ✅ Click login button                                       │
│  4. ❌ Dashboard shows blank                                    │
│                                                                 │
│  Evidence collected:                                             │
│  ├── 📸 screenshots/bug-step-1.png                              │
│  ├── 📸 screenshots/bug-step-2.png                              │
│  ├── 📸 screenshots/bug-step-3.png                              │
│  ├── 📸 screenshots/bug-step-4-FAIL.png                         │
│  ├── 🎥 videos/bug-reproduction.webm                            │
│  └── 📋 logs/console-errors.txt                                 │
│                                                                 │
│  Console Errors Found:                                           │
│  └── TypeError: Cannot read property 'user' of undefined        │
│      at Dashboard.tsx:42                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Output

```
┌─────────────────────────────────────────────────────────────────┐
│  🎭 E2E TEST RESULTS                                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Test Suite: Login Flow                                          │
│  Duration: 12.3s                                                │
│  Browser: Chromium 120                                          │
│                                                                 │
│  Results:                                                        │
│  ├── ✅ Passed: 8                                                │
│  ├── ❌ Failed: 1                                                │
│  └── ⏭️ Skipped: 0                                               │
│                                                                 │
│  Failed Tests:                                                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  ❌ "should show error for invalid password"                    │
│     Expected: "Invalid password" message                        │
│     Actual: No error message displayed                          │
│     📸 Screenshot: .claude/core/e2e/failures/invalid-password.png      │
│                                                                 │
│  Console Errors: 2                                               │
│  ├── TypeError at Dashboard.tsx:42                              │
│  └── 404 at /api/user/preferences                               │
│                                                                 │
│  Accessibility Issues: 3                                         │
│  ├── [serious] Form input missing label                         │
│  ├── [moderate] Color contrast insufficient                     │
│  └── [minor] Missing skip link                                  │
│                                                                 │
│  Artifacts:                                                      │
│  ├── 📸 Screenshots: .claude/core/e2e/screenshots/                     │
│  ├── 🎥 Video: .claude/core/e2e/videos/                                │
│  └── 📋 Report: .claude/core/e2e/report.html                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Configuration

`.claude/core/e2e/config.json`:

```json
{
  "baseURL": "http://localhost:3000",
  "browsers": ["chromium"],
  "viewport": { "width": 1280, "height": 720 },
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

## Integration with Review

Auto-suggest after `/su.review`:

```
┌─────────────────────────────────────────────────────────────────┐
│  💡 E2E Test Recommended                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  UI changes detected in this PR:                                 │
│  - src/components/LoginForm.tsx                                 │
│  - src/pages/Dashboard.tsx                                      │
│                                                                 │
│  Run E2E tests? /su.e2e "login flow"                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Related Commands

- `/su.review` - Code review
- `/su.verify` - SPEC verification
- `/su.compound` - Document test results

---

ARGUMENTS: $ARGUMENTS
