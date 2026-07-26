# Loop Install Adapters

Load only for `vibe.loop install`. Never register a schedule without the user's decision.

| 환경 | 명령 |
|------|------|
| Claude Code (세션 루프) | `/loop <interval> "/vibe.loop run <name>"` |
| Claude Code (클라우드 루틴) | `/schedule`로 cron `<schedule>` + prompt `/vibe.loop run <name>` 등록 |
| OS cron fallback | `<schedule> cd <project> && claude -p "/vibe.loop run <name>" --permission-mode acceptEdits` |
| Codex | Automations에 `<schedule>` + `$vibe.loop run <name>` 등록 |
