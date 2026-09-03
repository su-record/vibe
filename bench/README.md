# Bench — does the harness change anything?

Same task, same judge, different arms. Nothing here is a claim; the verdict comes from `vibe ledger compare`.

```bash
node bench/run.js --client claude --harness on  --runs 5
node bench/run.js --client claude --harness off --runs 5
node bench/run.js --client codex  --harness on  --runs 5
node bench/run.js --client codex  --harness off --runs 5
vibe ledger compare --by harness --metric checks --ledger bench/ledger.jsonl
vibe ledger compare --by client  --metric checks --ledger bench/ledger.jsonl
```

`on` means the agent worked in a workspace with the vibe card, skills and an approved intent, so it could run `vibe check` itself. `off` means a bare workspace with only the task. The bench installs the card, skills and hook into the workspace itself for the `on` arm and sets `VIBE_SKIP_SETUP`, so the run never touches or repairs `~/.claude`. A vibe already installed in the operator's home is still visible to the `off` arm — run the bench under a user without it, or `vibe uninstall` first. In both arms the judge is the same: after the agent stops, the task's scenarios run through `vibe check --all` and one line per run lands in `bench/ledger.jsonl` with client, model, harness, turns and cost (cost only where the client reports it).
