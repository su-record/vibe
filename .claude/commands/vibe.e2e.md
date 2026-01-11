---
description: End-to-end testing with Playwright automation
argument-hint: "test scenario or URL"
---

# /vibe.e2e

**E2E 테스트 자동화** - Playwright 기반 브라우저 테스트

## Usage

```
/vibe.e2e                              # 전체 E2E 테스트 실행
/vibe.e2e "login flow"                 # 특정 시나리오 테스트
/vibe.e2e http://localhost:3000/login  # 특정 URL 테스트
/vibe.e2e --visual                     # 시각적 회귀 테스트
/vibe.e2e --record                     # 테스트 영상 녹화
```

## 핵심 기능

```
┌─────────────────────────────────────────────────────────────────┐
│  🎭 Playwright E2E Testing                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ✅ 스크린샷 캡처 - UI 상태 기록                                 │
│  ✅ 콘솔 에러 수집 - JavaScript 에러 감지                        │
│  ✅ 네트워크 모니터링 - API 실패 감지                            │
│  ✅ 시각적 회귀 테스트 - 스크린샷 비교                           │
│  ✅ 비디오 녹화 - 버그 재현 증거                                 │
│  ✅ 접근성 검사 - a11y 위반 감지                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Process

### Phase 1: Environment Setup

```bash
# Playwright 설치 확인
npx playwright --version

# 브라우저 설치 (필요시)
npx playwright install chromium
```

### Phase 2: Test Scenario Analysis

```
📋 Scenario Detection
├── .vibe/features/{feature}.feature → BDD 시나리오 추출
├── .vibe/specs/{feature}.md → 검증 기준 확인
└── 기존 e2e/*.spec.ts 분석
```

### Phase 3: Test Execution

**Single Page Test:**
```typescript
// 자동 생성 테스트
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
│  │   ├── Baseline: .vibe/e2e/baseline/login-page.png           │
│  │   ├── Current:  .vibe/e2e/current/login-page.png            │
│  │   └── Diff: ✅ 0.02% (threshold: 1%)                         │
│  │                                                              │
│  ├── dashboard.png                                              │
│  │   ├── Baseline: .vibe/e2e/baseline/dashboard.png            │
│  │   ├── Current:  .vibe/e2e/current/dashboard.png             │
│  │   └── Diff: ❌ 5.3% (threshold: 1%)                          │
│  │       └── .vibe/e2e/diff/dashboard-diff.png                 │
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

버그 리포트와 연계:

```
/vibe.e2e --reproduce "사용자가 로그인 후 빈 페이지 표시"

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
│     📸 Screenshot: .vibe/e2e/failures/invalid-password.png      │
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
│  ├── 📸 Screenshots: .vibe/e2e/screenshots/                     │
│  ├── 🎥 Video: .vibe/e2e/videos/                                │
│  └── 📋 Report: .vibe/e2e/report.html                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Configuration

`.vibe/e2e/config.json`:

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

`/vibe.review` 완료 후 자동 제안:

```
┌─────────────────────────────────────────────────────────────────┐
│  💡 E2E Test Recommended                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  UI changes detected in this PR:                                 │
│  - src/components/LoginForm.tsx                                 │
│  - src/pages/Dashboard.tsx                                      │
│                                                                 │
│  Run E2E tests? /vibe.e2e "login flow"                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Related Commands

- `/vibe.review` - 코드 리뷰
- `/vibe.verify` - SPEC 검증
- `/vibe.compound` - 테스트 결과 문서화

---

ARGUMENTS: $ARGUMENTS
