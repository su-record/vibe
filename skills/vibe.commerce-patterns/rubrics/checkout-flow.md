# Checkout UX Best Practices Checklist

## Cart Review Step

- [ ] Cart items show current price, quantity, and subtotal per line
- [ ] Price change warning shown if item price changed since add-to-cart
- [ ] Out-of-stock items flagged before user proceeds
- [ ] Clear "Continue to Checkout" CTA — one primary action per step
- [ ] Guest checkout option visible (no forced registration)

## Shipping & Address Step

- [ ] Address autocomplete reduces input friction
- [ ] Saved addresses surfaced first for logged-in users
- [ ] Shipping cost displayed before payment (no surprise at confirmation)
- [ ] Estimated delivery date shown per shipping method
- [ ] Address validation feedback inline, not on submit

## Payment Step

- [ ] Supported payment methods visible upfront (icons, labels)
- [ ] Payment form uses browser autofill attributes (`autocomplete`)
- [ ] Idempotency key bound to order ID — double-click safe
- [ ] Loading state on submit button prevents double submission
- [ ] Clear error messages distinguish user error from system error
- [ ] PG redirect handles back-button recovery gracefully

## Order Confirmation Step

- [ ] Order ID prominently displayed (user can reference for support)
- [ ] Confirmation email sent within 30 seconds of payment success
- [ ] Summary includes: items, total, shipping address, estimated delivery
- [ ] Clear next step (track order / continue shopping)
- [ ] No personal payment data displayed (mask card number)

## Error & Edge Cases

- [ ] Stock exhausted mid-checkout: clear message, return to cart
- [ ] Payment timeout: inform user, preserve order state for retry
- [ ] Session expiry during checkout: preserve cart, redirect to login
- [ ] Network failure on submit: prevent duplicate submission, show retry CTA

## Accessibility & Performance

- [ ] Checkout steps announced to screen readers (step X of Y)
- [ ] Tab order logical through form fields
- [ ] Core checkout flow works without JavaScript (progressive enhancement)
- [ ] Page weight under 200 KB per step (no unnecessary third-party scripts)
