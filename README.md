# vibe 4

The experience of having an AX/FDE next to you. A vague request becomes checkable scenarios; the harness proves the result itself; the work is handed over to whoever will run it.

```bash
npm i -g @su-record/vibe
cd your-project && vibe init            # Claude Code. Codex / ChatGPT desktop: --client codex,chatgpt
```

Then, in chat: `/vibe every week an order spreadsheet arrives — turn it into a settlement sheet and send it to accounting`.

## What is different

- **The harness judges.** Every scenario carries a check (run · file · http · eval · human) and only what `vibe check` executed itself becomes evidence. A model saying "done" changes nothing.
- **Who may authorize is your policy.** `vibe init --tokens strict|irreversible|off`. Under `strict` both approval and irreversible actions (push, deploy, send, delete, spend) need a six-digit number the user pastes back into chat; the default `irreversible` asks a token only for irreversible actions; `off` records everything as auto for users who already skip permissions. The verdict itself is never configurable.
- **State is plain files inside the repository.** With `.vibe/` present you can approve in Claude Code and continue in Codex.
- **It speaks first.** Human attention is narrow. Up to three grounded things the user did not ask about.
- **The always-on instruction is 1KB.** `card.md` is all of it.

## Commands

`vibe --help` lists everything. The exit code is the verdict: 0 ok · 1 verdict failed · 2 usage · 3 token · 4 invalid transition.

## Language

The card, skills, and every record vibe writes (intent, scenarios, inbox, knowledge, ledger) are English. The model talks to the user in the user's language.

## Status

4.0.0-alpha — phase 1 (CLI core + Claude Code). `http`/`eval` checks, research, and skill proposals come in later phases. vibe 3 stays on its 3.x tags and is no longer developed.
