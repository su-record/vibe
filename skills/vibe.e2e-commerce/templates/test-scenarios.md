# E2E Commerce Test Scenario Template

## Setup

```typescript
// {{TEST_FILE}}.spec.ts
import { test, expect } from "@playwright/test";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

// Seed test data once per suite — clean up in afterAll
test.beforeAll(async ({ request }) => {
  await request.post("/api/test/seed", {
    data: {
      product: { id: "{{PRODUCT_ID}}", stock: 10, price: {{PRICE}} },
      user: { email: "{{TEST_USER_EMAIL}}", password: "{{TEST_USER_PASSWORD}}" },
      coupon: { code: "{{COUPON_CODE}}", type: "percentage", value: 10 },
    },
  });
});

test.afterAll(async ({ request }) => {
  await request.post("/api/test/cleanup", { data: { scope: "{{TEST_SUITE_ID}}" } });
});
```

## P0 — Happy Path Checkout

```typescript
test("happy path: cart → checkout → payment → confirmation", async ({ page }) => {
  // 1. Add to cart
  await page.goto("/products/{{PRODUCT_SLUG}}");
  await page.getByRole("button", { name: "Add to Cart" }).click();
  await page.getByRole("link", { name: "View Cart" }).click();

  // 2. Proceed to checkout
  await expect(page.getByText("{{PRODUCT_NAME}}")).toBeVisible();
  await page.getByRole("button", { name: "Checkout" }).click();

  // 3. Fill shipping
  await page.fill('[name="address"]', "{{TEST_ADDRESS}}");
  await page.fill('[name="city"]', "{{TEST_CITY}}");
  await page.getByRole("button", { name: "Continue to Payment" }).click();

  // 4. Pay (use PG sandbox card)
  await page.fill('[name="cardNumber"]', "{{SANDBOX_CARD_NUMBER}}");
  await page.fill('[name="expiry"]', "{{SANDBOX_CARD_EXPIRY}}");
  await page.fill('[name="cvv"]', "{{SANDBOX_CARD_CVV}}");
  await page.getByRole("button", { name: "Place Order" }).click();

  // 5. Confirm — verify order status text, not just URL
  await page.waitForURL("**/order-confirmation/**");
  await expect(page.getByText("Order Confirmed")).toBeVisible();
  await expect(page.getByTestId("order-id")).not.toBeEmpty();
});
```

## P0 — Payment Failure + Stock Release

```typescript
test("payment failure releases reserved stock", async ({ page, request }) => {
  const stockBefore = await request
    .get("/api/products/{{PRODUCT_ID}}/stock")
    .then((r) => r.json());

  await page.goto("/products/{{PRODUCT_SLUG}}");
  await page.getByRole("button", { name: "Add to Cart" }).click();
  await page.goto("/checkout");
  await page.fill('[name="cardNumber"]', "4000000000000002"); // Decline card

  await page.getByRole("button", { name: "Place Order" }).click();
  await expect(page.getByText(/payment failed|declined/i)).toBeVisible();

  // Verify stock is released — not just error shown
  const stockAfter = await request
    .get("/api/products/{{PRODUCT_ID}}/stock")
    .then((r) => r.json());
  expect(stockAfter.available).toBe(stockBefore.available);
});
```

## P0 — Duplicate Payment Prevention

```typescript
test("double-click does not create duplicate order", async ({ page, request }) => {
  await page.goto("/checkout?prefilled=true");
  const submitBtn = page.getByRole("button", { name: "Place Order" });

  // Simulate double-click simultaneously
  await Promise.all([submitBtn.click(), submitBtn.click()]);
  await page.waitForURL("**/order-confirmation/**");

  const orderId = await page.getByTestId("order-id").textContent();

  // Verify only one order was created via API
  const orders = await request
    .get(`/api/orders?reference={{TEST_IDEMPOTENCY_KEY}}`)
    .then((r) => r.json());
  expect(orders.total).toBe(1);
});
```

## P0 — Out-of-Stock Blocks Checkout

```typescript
test("out-of-stock product blocks checkout with clear message", async ({ page, request }) => {
  // Deplete stock via test API
  await request.post("/api/test/deplete-stock", { data: { productId: "{{PRODUCT_ID}}" } });

  await page.goto("/checkout?prefilled=true");
  await page.getByRole("button", { name: "Place Order" }).click();

  await expect(page.getByText(/out of stock|unavailable/i)).toBeVisible();
  await expect(page).not.toHaveURL("**/order-confirmation/**");
});
```

## P1 — Coupon Calculation

```typescript
test("percentage coupon applies correct discount", async ({ page }) => {
  await page.goto("/cart");
  await page.fill('[name="couponCode"]', "{{COUPON_CODE}}");
  await page.getByRole("button", { name: "Apply" }).click();

  const total = await page.getByTestId("cart-total").textContent();
  // {{PRICE}} * (1 - 0.10) = expected total
  await expect(page.getByTestId("discount-amount")).toContainText("{{EXPECTED_DISCOUNT}}");
});
```

## P1 — Cart Merge on Login

```typescript
test("guest cart merges into user cart on login", async ({ page }) => {
  // Add item as guest
  await page.goto("/products/{{PRODUCT_SLUG}}");
  await page.getByRole("button", { name: "Add to Cart" }).click();

  // Login
  await page.goto("/login");
  await page.fill('[name="email"]', "{{TEST_USER_EMAIL}}");
  await page.fill('[name="password"]', "{{TEST_USER_PASSWORD}}");
  await page.getByRole("button", { name: "Sign In" }).click();

  // Guest cart item should appear in user cart
  await page.goto("/cart");
  await expect(page.getByText("{{PRODUCT_NAME}}")).toBeVisible();
});
```

## MSW Mock PG Server (CI)

```typescript
// mocks/pg-server.ts
export const pgHandlers = [
  http.post("{{PG_ENDPOINT}}", async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const card = body.cardNumber as string;

    if (card === "4000000000000002") {
      return HttpResponse.json({ status: "FAILED", code: "CARD_DECLINED" }, { status: 400 });
    }
    return HttpResponse.json({
      status: "APPROVED",
      transactionId: `mock_${Date.now()}`,
    });
  }),
];
```
