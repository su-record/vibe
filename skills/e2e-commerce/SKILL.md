---
name: e2e-commerce
description: "E2E test scenarios for commerce checkout and payment flows. Provides ready-made Playwright test templates for cart→checkout→payment→confirmation flows, including PG sandbox testing (Toss/Stripe), error scenarios (payment failure, timeout, stock exhaustion), and idempotency verification. Use when writing E2E tests for any e-commerce feature — checkout, payment, order status, or refund flows."
triggers: [e2e commerce, checkout test, payment test, order flow test]
priority: 65
---

# E2E Commerce Test Scenarios

## Pre-check (K1)

> Are you testing a checkout/payment/order flow? If testing simple CRUD or non-transactional features, standard E2E patterns suffice — this skill is not needed.

## Must-Test Scenarios

### P0 — Blocks Deployment

| Scenario | What to Verify | Gotcha |
|----------|---------------|--------|
| **Happy path checkout** | Cart → Shipping → Payment → Order confirmation | Verify order status text, not just URL change |
| **Payment failure** | Error message shown, stock released | Check stock is RELEASED after failure, not just error displayed |
| **Duplicate payment** | Only 1 order created on double-click | `Promise.all([click(), click()])` then verify order count via API |
| **Out of stock** | Blocks checkout with clear message | Simulate stock depletion mid-checkout via test API |

### P1 — Should Pass

| Scenario | What to Verify | Gotcha |
|----------|---------------|--------|
| **Coupon calculation** | Discount amount and total correct | Test percentage AND fixed amount coupons separately |
| **Webhook resilience** | Order completes even with delayed webhook | Configure 5s delay, verify processing→complete transition |
| **Cart merge on login** | Guest cart merged into user cart | User cart takes priority for duplicate items |
| **Partial refund** | Refunded amount correct, order updated | Verify remaining amount, not just refund event |

### P2 — Nice to Have

| Scenario | What to Verify |
|----------|---------------|
| Multiple payment methods | Each method completes checkout |
| Guest checkout | Full flow without login |
| Order cancellation | Refund triggered, stock restored |

## Test Environment Gotchas

| Gotcha | Fix |
|--------|-----|
| Using real PG sandbox in CI | Use MSW (`setupServer`) for mock PG responses |
| Flaky tests from timing | Use `waitForSelector`/`waitForURL`, never `sleep` |
| Test data leaks between tests | Seed in `beforeAll`, clean in `afterAll` |
| Hardcoded test card numbers | Document: `4000000000000002` = decline |

## Related

See `commerce-patterns` skill for implementation gotchas (idempotency, atomic stock, payment state machine) that these tests verify.

## Done Criteria (K4)

- [ ] All P0 scenarios pass in CI
- [ ] P1 scenarios written and tracked
- [ ] Test data seeded/cleaned per suite
- [ ] No flaky tests (no arbitrary waits)
- [ ] Mock PG server configured for CI
