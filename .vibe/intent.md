# vibe 4 · 4.1.17 — the reader's and the reviewer's model are the project's to set

## Why
The reader runs Claude at `haiku` and Codex at `model_reasoning_effort=low`; the reviewers run the client's default model. Those are aliases on purpose — vibe carries no model catalogue, because a catalogue goes stale with every provider release (this month: `none` and `minimal` effort gone on GPT-6 Astra, new Sol · Terra · Luna tiers). What a project cannot do today is choose: read with `gpt-5.6-luna` on Codex, review with a named Claude model, raise the reader's effort for a hard corpus. The only lever is `VIBE_READER_CMD`, which replaces the whole driver and loses sessions, cache and usage. Two small settings give the choice without vibe knowing any model name.

## What counts as success
- `.vibe/config.json` accepts `reader: { model?, effort? }` and `reviewer: { model?, effort? }`. `model` is passed as `--model <model>` to Claude and `-m <model>` to Codex; `effort` as `--effort <effort>` to Claude and `-c model_reasoning_effort=<effort>` to Codex. Unset keeps today's defaults (reader: Claude `haiku`, Codex effort `low`; reviewer: the client's default model, default effort). The existing string form `reader: "<command>"` keeps meaning a stateless custom command.
- `VIBE_READER_MODEL`, `VIBE_READER_EFFORT`, `VIBE_REVIEWER_MODEL`, `VIBE_REVIEWER_EFFORT` override the config for one run.
- `vibe read --ask` reports the model the driver answered with when the CLI names it; the `usage` ledger event carries it, as today.
- A session key includes the model and effort, so changing them starts a new reader session instead of resuming one made by another model.
- `vibe tokens`-style setting is not added: the config file is edited directly; README documents the two objects and the four variables, and says why vibe carries no model list.
- Tests: with a fake `claude` and a fake `codex` on PATH, the reader and a review stage receive the configured model and effort flags, the env override wins over config, an unset config keeps the defaults, and a changed model does not resume the old session.
- Earlier gates still hold: build, tests, card ≤ 1KB, file 400 / function 50, skill names, packs, report voice, no placeholders, plugin tree current for 4.1.17, README status line carries `4.1.17`.

## Constraints
- No model name inside vibe beyond the two aliases it already uses (`haiku`, `low`).
- Every record is English; the model talks to the user in the user's language.
