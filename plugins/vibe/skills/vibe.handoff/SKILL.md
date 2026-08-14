---
name: vibe.handoff
description: Compatibility alias for generating HANDOFF.md before session end. Use for handoff, handover, session cleanup, or context-save requests.
user-invocable: false
invocation: [auto]
tier: standard
triggers: [handoff, handover, session cleanup, session end, context save]
priority: 60
---

Load `vibe.continue` in handoff mode and preserve all arguments.
