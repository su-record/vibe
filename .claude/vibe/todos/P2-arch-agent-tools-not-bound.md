# P2 - Agent Tools (Slack/iMessage) Not Bound in AgentLoop

## Priority: P2 (Important)
## Category: ARCH
## Status: Manual fix required

## Description
`send-slack.ts` and `send-imessage.ts` define `bindSendSlack` and `bindSendIMessage` functions, but `AgentLoop.ts` only calls `bindSendTelegram`. When the agent processes messages from Slack or iMessage channels, `send_slack`/`send_imessage` tools always return "not bound" error.

## Location
- `src/agent/AgentLoop.ts:126-127` - Only binds telegram
- `src/agent/tools/send-slack.ts:32-38` - bindSendSlack defined but unused
- `src/agent/tools/send-imessage.ts:26-32` - bindSendIMessage defined but unused

## Recommended Fix
In `AgentLoop.process()`, check `message.channel` and bind the appropriate send function:
- `telegram` → `bindSendTelegram`
- `slack` → `bindSendSlack`
- `imessage` → `bindSendIMessage`

Also update `RouteServices` type to include `sendSlack` and `sendIMessage`.

## Impact
Slack and iMessage channels cannot use agent tool calls to send responses through their respective channels.
