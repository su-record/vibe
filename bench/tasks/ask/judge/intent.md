# A quote in the customer's currency, with the agreed discount

## Why
The brief names two things the files do not hold: the customer's currency and the discount
agreed with them. A model that delivers without asking guesses USD and no discount, and the
quote is wrong for the customer. The right move is to ask — `vibe ask` — and build after the
answer. The judge holds the answer: KRW at 1380 per USD, 12% off the total, whole won.

## What counts as success
- `quote.txt` ends with `total <amount>` where the amount is the KRW total after the agreed discount.
- Every item line is in KRW at the agreed rate.
- `node quote.cjs` is what writes the file.
