# Evidence ledger — ward roster module

## Confirmed
- Repository conventions (from the brief, agreed with the two maintainers): no classes unless state is shared between calls; exceptions propagate to the caller; no logging in library code; constants are module-level names, never read from a config dict; a comment says why, never what.
- The module's only callers are the roster CLI and one test file; no other code imports it.
- Python 3.11; the standard library only.
- Public API that must keep its name and signature: `assign(roster, nurse, shift)` and `swap(roster, a, b)`.

## Unconfirmed or placeholder
- Any TODO left in the source is not a tracked task.
- Any `config` value read at runtime has no source; the values in the brief are the constants.
