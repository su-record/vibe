Every week an order export arrives as `orders.csv` in this directory. Turn it into a settlement sheet for accounting.

Write `out/settlement.csv` with the columns `seller,orders,total` (one row per seller, sorted by seller) and `out/summary.json` with `{ "sellers", "orders", "total", "duplicatesSkipped", "needsHuman" }`.

Rules:
- An order id that appears twice is counted once.
- Only orders with status `paid` are settled.
- A row without an amount is never guessed: list its order id in `needsHuman` and leave it out of the totals.
- Amounts may carry thousands separators.

Use any language available here (node is installed). When you are done, the files must exist on disk.
