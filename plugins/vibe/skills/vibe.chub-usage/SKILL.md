---
name: vibe.chub-usage
description: Compatibility alias for chub-based current API documentation lookup. Use when callers invoke vibe.chub-usage directly.
invocation: [auto]
tier: optional
triggers: [chub, context hub, API docs, latest API, deprecated API, SDK documentation, api reference, 최신 문서]
priority: 60
user-invocable: true
---

Load `vibe.documentation-provider` and force the chub provider while preserving all arguments.
