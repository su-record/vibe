Implement `ledger.cjs`, a small command-line ledger kept in `ledger.json` in the current
directory. The tests under `tests/` are the specification — read them first. When you are done:

    node --test tests/*.test.cjs

must exit 0 with every case passing. Subcommands:

- `add <name> <amount>` — appends an entry; a non-numeric or missing amount exits 2 with a message on stderr
- `list` — one line per entry, `<name>\t<amount with two decimals>`, in insertion order
- `total` — prints `total: <sum with two decimals>`
- `export <file>` — writes a CSV with a `name,amount` header; names containing a comma or a quote are double-quoted with quotes doubled
