---
name: e2e-commerce
description: "E2E test scenarios for commerce checkout and payment flows"
triggers: [e2e commerce, checkout test, payment test, order flow test]
priority: 65
---
# E2E Commerce Test Scenarios

Playwright-based E2E testing for commerce checkout flows.

## When to Use

- After implementing checkout/payment features
- Before production deployment
- CI/CD pipeline quality gate
- Regression testing after changes

## Test Scenarios

### 1. Happy Path - Complete Checkout

```typescript
// tests/e2e/checkout.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Checkout Flow', () => {
  test('complete purchase - happy path', async ({ page }) => {
    // 1. Add to cart
    await page.goto('/products/test-product');
    await page.click('[data-testid="add-to-cart"]');
    await expect(page.locator('[data-testid="cart-count"]')).toHaveText('1');

    // 2. Go to cart
    await page.click('[data-testid="cart-icon"]');
    await expect(page).toHaveURL('/cart');

    // 3. Proceed to checkout
    await page.click('[data-testid="checkout-button"]');
    await expect(page).toHaveURL('/checkout');

    // 4. Fill shipping info
    await page.fill('[name="name"]', 'Test User');
    await page.fill('[name="phone"]', '010-1234-5678');
    await page.fill('[name="address"]', 'Test Address 123');

    // 5. Select payment method
    await page.click('[data-testid="payment-card"]');

    // 6. Complete payment (sandbox/mock)
    await page.click('[data-testid="pay-button"]');

    // 7. Verify order complete
    await expect(page).toHaveURL(/\/orders\/\w+/);
    await expect(page.locator('[data-testid="order-status"]')).toHaveText('결제 완료');
  });
});
```

### 2. Stock Validation

```typescript
test('prevent checkout when out of stock', async ({ page }) => {
  // Setup: Product with stock = 1, another user reserves it
  await page.goto('/products/low-stock-product');
  await page.click('[data-testid="add-to-cart"]');
  await page.goto('/checkout');

  // Simulate stock depletion during checkout
  await page.evaluate(async () => {
    await fetch('/api/test/deplete-stock', { method: 'POST' });
  });

  // Attempt payment
  await page.click('[data-testid="pay-button"]');

  // Should show out of stock error
  await expect(page.locator('[data-testid="error-message"]'))
    .toContainText('재고가 부족합니다');
});
```

### 3. Payment Failure Handling

```typescript
test('handle payment failure gracefully', async ({ page }) => {
  await page.goto('/products/test-product');
  await page.click('[data-testid="add-to-cart"]');
  await page.goto('/checkout');

  // Fill form
  await page.fill('[name="name"]', 'Test User');
  await page.fill('[name="address"]', 'Test Address');

  // Use test card that triggers failure
  await page.fill('[name="card-number"]', '4000000000000002'); // Decline card
  await page.click('[data-testid="pay-button"]');

  // Verify error handling
  await expect(page.locator('[data-testid="payment-error"]'))
    .toContainText('결제가 거절되었습니다');

  // Stock should be released
  await page.goto('/products/test-product');
  await expect(page.locator('[data-testid="stock-status"]'))
    .not.toContainText('품절');
});
```

### 4. Duplicate Payment Prevention

```typescript
test('prevent duplicate payment on double click', async ({ page }) => {
  await page.goto('/checkout');
  // Fill checkout form...

  // Double click pay button rapidly
  const payButton = page.locator('[data-testid="pay-button"]');
  await Promise.all([
    payButton.click(),
    payButton.click(),
  ]);

  // Wait for completion
  await page.waitForURL(/\/orders\/\w+/);

  // Verify only one order created
  const orderId = page.url().split('/').pop();
  const response = await page.request.get(`/api/orders?userId=test`);
  const orders = await response.json();

  expect(orders.filter(o => o.id === orderId)).toHaveLength(1);
});
```

### 5. Coupon Application

```typescript
test('apply coupon and verify discount', async ({ page }) => {
  await page.goto('/products/test-product'); // Price: 10,000
  await page.click('[data-testid="add-to-cart"]');
  await page.goto('/checkout');

  // Original price
  await expect(page.locator('[data-testid="total-price"]'))
    .toHaveText('10,000원');

  // Apply 10% coupon
  await page.fill('[name="coupon"]', 'DISCOUNT10');
  await page.click('[data-testid="apply-coupon"]');

  // Verify discount applied
  await expect(page.locator('[data-testid="discount-amount"]'))
    .toHaveText('-1,000원');
  await expect(page.locator('[data-testid="total-price"]'))
    .toHaveText('9,000원');
});
```

### 6. Webhook Resilience

```typescript
test('order completes even with webhook delay', async ({ page, request }) => {
  // Configure webhook delay in test environment
  await request.post('/api/test/configure-webhook', {
    data: { delay: 5000 } // 5 second delay
  });

  // Complete checkout
  await page.goto('/checkout');
  // ... fill form
  await page.click('[data-testid="pay-button"]');

  // Should show processing state
  await expect(page.locator('[data-testid="order-status"]'))
    .toHaveText('처리 중');

  // Wait for webhook
  await page.waitForSelector('[data-testid="order-status"]:has-text("결제 완료")', {
    timeout: 10000
  });
});
```

## CLI Usage

```bash
# Run all commerce e2e tests
/vibe.utils --e2e commerce

# Run specific scenario
/vibe.utils --e2e checkout-flow

# Run with visual recording
/vibe.utils --e2e commerce --record

# Run against staging
/vibe.utils --e2e commerce --env staging
```

## Test Environment Setup

### Mock PG Server
```typescript
// tests/mocks/pg-server.ts
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

export const pgMockServer = setupServer(
  // Success response
  http.post('/payments/authorize', () => {
    return HttpResponse.json({
      success: true,
      transactionId: `txn_${Date.now()}`,
      status: 'AUTHORIZED',
    });
  }),

  // Failure simulation
  http.post('/payments/authorize', ({ request }) => {
    const body = request.json();
    if (body.cardNumber === '4000000000000002') {
      return HttpResponse.json({
        success: false,
        error: 'CARD_DECLINED',
      }, { status: 400 });
    }
  }),
);
```

### Database Seeding
```typescript
// tests/fixtures/commerce.ts
export async function seedCommerceData(db: Database) {
  // Create test products
  await db.products.createMany([
    { id: 'test-product', name: 'Test Product', price: 10000, stock: 100 },
    { id: 'low-stock', name: 'Low Stock', price: 5000, stock: 1 },
  ]);

  // Create test coupons
  await db.coupons.create({
    code: 'DISCOUNT10',
    discountPercent: 10,
    expiresAt: addDays(new Date(), 30),
  });
}
```

## CI/CD Integration

```yaml
# .github/workflows/e2e.yml
name: E2E Commerce Tests

on:
  pull_request:
    paths:
      - 'src/checkout/**'
      - 'src/payment/**'
      - 'src/cart/**'

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: npm ci

      - name: Start test server
        run: npm run start:test &

      - name: Run E2E tests
        run: npx playwright test tests/e2e/commerce/

      - name: Upload test results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

## Quality Checklist

### Must Pass (P0)
- [ ] Happy path checkout completes
- [ ] Payment failure releases stock
- [ ] Duplicate payment prevented
- [ ] Out of stock blocks checkout

### Should Pass (P1)
- [ ] Coupon calculation correct
- [ ] Webhook retry handled
- [ ] Cart merge on login works
- [ ] Partial refund processed

### Nice to Have (P2)
- [ ] Multiple payment methods
- [ ] Guest checkout flow
- [ ] Order cancellation
- [ ] Subscription renewal
