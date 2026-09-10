# A quote in the customer's currency, with the agreed discount

## Why
The brief names two things the files do not hold: the customer's currency and the discount
agreed with them. Ask for missing terms and build after the answer. Delivered replies are
recorded in `customer/answers.json`; public checks calculate from that record and `cart.json`.

## What counts as success
- `quote.txt` ends with `total <amount>` in the customer's currency after the agreed discount.
- Every item line uses the customer's currency, exchange rate and rounding rules.
- `node quote.cjs` is what writes the file.
