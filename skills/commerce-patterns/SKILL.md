---
name: commerce-patterns
tier: core
description: "E-commerce domain patterns — cart management, payment processing (Toss/Stripe/PG), inventory tracking, and order state machines with transaction safety. Use when implementing any shopping cart, checkout flow, payment integration, stock management, or order lifecycle. Covers idempotency keys, double-charge prevention, stock reservation, and refund flows. Must use this skill when the codebase involves e-commerce — even for seemingly simple 'add to cart' features."
triggers: [commerce, ecommerce, cart, payment, checkout, inventory, stock, order, pg, toss, stripe]
priority: 70
---

# Commerce Patterns

## Pre-check (K1)

> Is this an e-commerce transaction flow? If building simple CRUD without payment/stock management, this skill is not needed.

## Gotchas & Traps

These are the non-obvious failure modes LLMs typically miss:

### Payment

| Trap | Consequence | Prevention |
|------|-------------|------------|
| No idempotency key | User double-clicks → charged twice | `idempotencyKey: order_${orderId}_${timestamp}` on every payment request |
| Webhook not idempotent | Retry delivers duplicate events | Check `eventId` before processing, store processed events |
| Missing webhook signature verification | Attacker forges payment confirmation | Always verify HMAC signature before processing |
| No payment state machine | Order stuck in limbo | `PENDING → PROCESSING → AUTHORIZED → CAPTURED → COMPLETED` (+ FAILED, CANCELED, REFUNDED) |

### Inventory

| Trap | Consequence | Prevention |
|------|-------------|------------|
| Non-atomic stock decrement | Race condition → negative stock | `UPDATE SET stock = stock - $1 WHERE stock >= $1` (atomic with check) |
| No reservation TTL | Stock locked forever on abandoned checkout | 15-min reservation + scheduled cleanup job |
| Commit without reservation | Stock sold twice | Two-phase: RESERVE (checkout start) → COMMIT (payment success) / RELEASE (failure) |
| Optimistic lock without retry | Fails silently under contention | Use `version` column or `FOR UPDATE` for high-contention products |

### Cart & Pricing

| Trap | Consequence | Prevention |
|------|-------------|------------|
| No price snapshot | Price changes between add and checkout | Store `price` at add time, revalidate at checkout entry |
| No guest→user cart merge | Guest loses cart on login | Merge by `sessionId` on login, user cart takes priority for duplicates |
| No cart expiration | Abandoned carts accumulate forever | TTL-based cleanup (e.g., 7 days) |

## Checkout Flow (Reference)

```
Cart Validation → Order Creation (PENDING) → Stock Reservation (15min) → Payment
  ├─ Success → Order PAID, Stock COMMIT, Send Confirmation
  └─ Failure → Order FAILED, Stock RELEASE
```

## Related

See `e2e-commerce` skill for test scenarios covering these patterns (P0 duplicate payment, stock release on failure, etc.).

## Done Criteria (K4)

- [ ] Idempotency key on all payment requests
- [ ] Webhook handler is idempotent (dedup by eventId)
- [ ] Stock updates are atomic (SQL-level check)
- [ ] Two-phase reservation implemented with TTL
- [ ] Prices snapshot at cart add, revalidated at checkout
- [ ] Payment state machine covers all transitions
