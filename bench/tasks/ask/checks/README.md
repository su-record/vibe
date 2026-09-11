# Public checks

Run `node quote.cjs`, then `node checks/verify.cjs total` and `node checks/verify.cjs lines`.
The checks calculate from `cart.json` and the customer's delivered replies, with no private answer.

The harness records only replies actually delivered to the agent in `customer/answers.json`:

```json
{ "answers": [{ "question": "the request sent to the customer", "answer": "the delivered reply" }] }
```

Do not supply this record yourself. If terms are unanswered, ask the customer for the missing
currency, exchange rate, discount or rounding rule. Once answered, the same commands check
the result in every arm. A missing quote or a violation of the agreed terms fails the check.
