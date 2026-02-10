---
name: commerce-patterns
description: "E-commerce domain patterns - cart, payment, inventory with transaction safety"
triggers: [commerce, ecommerce, cart, payment, checkout, inventory, stock, order, pg, toss, stripe]
priority: 70
---
# Commerce Patterns Skill

E-commerce domain patterns for reliable transactions.

## When to Use

- Shopping cart implementation
- Payment integration (PG, Stripe, Toss)
- Inventory/stock management
- Order processing systems

## Core Patterns

### 1. Cart (Shopping Cart)

#### State Model
```typescript
interface CartItem {
  productId: string;
  variantId?: string;
  quantity: number;
  price: number;           // Snapshot at add time
  originalPrice: number;   // For comparison
  addedAt: Date;
}

interface Cart {
  id: string;
  userId?: string;         // null for guest
  sessionId: string;       // For guest merge
  items: CartItem[];
  couponCode?: string;
  updatedAt: Date;
  expiresAt: Date;         // Cart expiration
}
```

#### Key Patterns

| Pattern | Description |
|---------|-------------|
| **Guest → User Merge** | Merge localStorage cart on login |
| **Price Snapshot** | Store price at add time, revalidate at checkout |
| **Expiration** | Clear abandoned carts after N days |
| **Validation** | Check stock/price at checkout entry |

#### Implementation
```typescript
class CartService {
  async addItem(cartId: string, item: AddItemRequest): Promise<Cart> {
    // 1. Validate product exists and in stock
    const product = await this.productService.get(item.productId);
    if (!product || product.stock < item.quantity) {
      throw new OutOfStockError();
    }

    // 2. Snapshot current price
    const cartItem: CartItem = {
      ...item,
      price: product.currentPrice,
      originalPrice: product.originalPrice,
      addedAt: new Date(),
    };

    // 3. Add or update quantity
    return this.cartRepository.upsertItem(cartId, cartItem);
  }

  async mergeGuestCart(userId: string, sessionId: string): Promise<Cart> {
    const guestCart = await this.cartRepository.findBySession(sessionId);
    const userCart = await this.cartRepository.findByUser(userId);

    if (!guestCart) return userCart;

    // Merge: user cart takes priority for duplicates
    const merged = this.mergeItems(userCart.items, guestCart.items);
    await this.cartRepository.delete(guestCart.id);

    return this.cartRepository.update(userCart.id, { items: merged });
  }
}
```

### 2. Payment

#### State Machine
```
PENDING → PROCESSING → AUTHORIZED → CAPTURED → COMPLETED
                    ↘ FAILED
                    ↘ CANCELED
COMPLETED → REFUND_REQUESTED → REFUNDED (partial/full)
```

#### Idempotency Pattern (Critical)
```typescript
interface PaymentRequest {
  orderId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;  // REQUIRED: `order_${orderId}_${timestamp}`
  paymentMethod: PaymentMethod;
}

class PaymentService {
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    // 1. Check idempotency - prevent duplicate charges
    const existing = await this.paymentRepository.findByIdempotencyKey(
      request.idempotencyKey
    );
    if (existing) {
      return existing.result;  // Return cached result
    }

    // 2. Create payment record (PENDING)
    const payment = await this.paymentRepository.create({
      ...request,
      status: 'PENDING',
    });

    try {
      // 3. Call PG adapter
      const pgResult = await this.pgAdapter.authorize(request);

      // 4. Update status
      return this.paymentRepository.update(payment.id, {
        status: pgResult.success ? 'AUTHORIZED' : 'FAILED',
        pgTransactionId: pgResult.transactionId,
        result: pgResult,
      });
    } catch (error) {
      await this.paymentRepository.update(payment.id, {
        status: 'FAILED',
        error: error.message,
      });
      throw error;
    }
  }
}
```

#### PG Adapter Pattern
```typescript
interface PGAdapter {
  authorize(request: PaymentRequest): Promise<PGResult>;
  capture(transactionId: string): Promise<PGResult>;
  cancel(transactionId: string): Promise<PGResult>;
  refund(transactionId: string, amount?: number): Promise<PGResult>;
}

// Implementations
class TossPaymentsAdapter implements PGAdapter { /* ... */ }
class StripeAdapter implements PGAdapter { /* ... */ }
class PortOneAdapter implements PGAdapter { /* ... */ }
```

#### Webhook Handling
```typescript
class PaymentWebhookHandler {
  async handle(event: WebhookEvent): Promise<void> {
    // 1. Verify signature
    if (!this.verifySignature(event)) {
      throw new UnauthorizedError();
    }

    // 2. Idempotency check - process each event only once
    const processed = await this.eventStore.find(event.id);
    if (processed) {
      return;  // Already processed
    }

    // 3. Process event
    await this.processEvent(event);

    // 4. Mark as processed
    await this.eventStore.save({
      eventId: event.id,
      processedAt: new Date(),
    });
  }
}
```

### 3. Inventory (Stock Management)

#### Reservation Pattern (Two-Phase)
```typescript
interface StockReservation {
  id: string;
  productId: string;
  quantity: number;
  orderId: string;
  status: 'RESERVED' | 'COMMITTED' | 'RELEASED';
  expiresAt: Date;         // Auto-release if not committed
  createdAt: Date;
}

class InventoryService {
  // Phase 1: Reserve stock (at checkout start)
  async reserve(orderId: string, items: OrderItem[]): Promise<void> {
    for (const item of items) {
      // Atomic decrement with check
      const result = await this.db.query(`
        UPDATE products
        SET reserved_stock = reserved_stock + $1
        WHERE id = $2
          AND (available_stock - reserved_stock) >= $1
        RETURNING *
      `, [item.quantity, item.productId]);

      if (result.rowCount === 0) {
        // Rollback previous reservations
        await this.releaseAll(orderId);
        throw new InsufficientStockError(item.productId);
      }

      await this.reservationRepository.create({
        orderId,
        productId: item.productId,
        quantity: item.quantity,
        status: 'RESERVED',
        expiresAt: addMinutes(new Date(), 15),  // 15min hold
      });
    }
  }

  // Phase 2: Commit stock (after payment success)
  async commit(orderId: string): Promise<void> {
    const reservations = await this.reservationRepository.findByOrder(orderId);

    for (const reservation of reservations) {
      await this.db.query(`
        UPDATE products
        SET
          available_stock = available_stock - $1,
          reserved_stock = reserved_stock - $1
        WHERE id = $2
      `, [reservation.quantity, reservation.productId]);

      await this.reservationRepository.update(reservation.id, {
        status: 'COMMITTED',
      });
    }
  }

  // Rollback: Release stock (payment failed or timeout)
  async release(orderId: string): Promise<void> {
    const reservations = await this.reservationRepository.findByOrder(orderId);

    for (const reservation of reservations) {
      if (reservation.status === 'RESERVED') {
        await this.db.query(`
          UPDATE products
          SET reserved_stock = reserved_stock - $1
          WHERE id = $2
        `, [reservation.quantity, reservation.productId]);

        await this.reservationRepository.update(reservation.id, {
          status: 'RELEASED',
        });
      }
    }
  }
}
```

#### Concurrency Control
```typescript
// Option 1: Optimistic Locking
await db.query(`
  UPDATE products
  SET stock = stock - $1, version = version + 1
  WHERE id = $2 AND version = $3 AND stock >= $1
`, [quantity, productId, expectedVersion]);

// Option 2: Pessimistic Locking (for high contention)
await db.query(`
  SELECT * FROM products WHERE id = $1 FOR UPDATE
`, [productId]);

// Option 3: Redis Distributed Lock
const lock = await redlock.lock(`stock:${productId}`, 5000);
try {
  // Update stock
} finally {
  await lock.unlock();
}
```

## Order Flow (Complete)

```
┌─────────────────────────────────────────────────────────────┐
│  CHECKOUT FLOW                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Cart Validation                                         │
│     └─ Revalidate prices, check stock availability          │
│                                                             │
│  2. Order Creation (PENDING)                                │
│     └─ Generate orderId, snapshot cart                      │
│                                                             │
│  3. Stock Reservation                                       │
│     └─ Reserve inventory (15min hold)                       │
│                                                             │
│  4. Payment Processing                                      │
│     ├─ Success → Order PAID, Stock COMMIT                   │
│     └─ Failure → Order FAILED, Stock RELEASE                │
│                                                             │
│  5. Order Confirmation                                      │
│     └─ Send notification, trigger fulfillment               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Common Bugs & Prevention

| Bug | Cause | Prevention |
|-----|-------|------------|
| **Duplicate payment** | User double-click, webhook retry | Idempotency key |
| **Negative stock** | Race condition | Atomic update with check |
| **Price mismatch** | Price changed during checkout | Snapshot + revalidation |
| **Orphan reservation** | Payment timeout without release | TTL + scheduled cleanup |
| **Lost webhook** | Network failure | Retry + idempotent handler |
| **Order state corruption** | Concurrent updates | State machine + versioning |

## Integration with /vibe.run

During commerce feature implementation:

1. **Phase 1**: Define domain models (Cart, Order, Payment, Inventory)
2. **Phase 2**: Implement core services with patterns above
3. **Phase 3**: Add PG adapter and webhook handlers
4. **Phase 4**: Implement compensating transactions (Saga)
5. **Phase 5**: E2E test critical flows

## Checklist

### Cart
- [ ] Guest/user cart merge on login
- [ ] Price snapshot at add time
- [ ] Stock validation at checkout
- [ ] Cart expiration cleanup

### Payment
- [ ] Idempotency key on all requests
- [ ] Webhook signature verification
- [ ] Duplicate event handling
- [ ] Timeout/retry strategy
- [ ] Refund flow tested

### Inventory
- [ ] Two-phase reservation (reserve → commit/release)
- [ ] Atomic stock updates
- [ ] Reservation TTL and cleanup job
- [ ] Concurrency control tested
