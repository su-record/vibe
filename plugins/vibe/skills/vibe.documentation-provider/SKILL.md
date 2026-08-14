---
name: vibe.documentation-provider
description: Fetch current, authoritative library and API documentation through the best available provider. Use for external API/SDK implementation, migrations, version differences, official references, or deprecated API checks; routes between chub, Context7, and official web documentation.
user-invocable: true
---

# Documentation Provider

## Done Criteria

- [ ] 사용한 provider와 조회 대상 package/API가 기록되어 있다.
- [ ] 답변 또는 구현 근거에 문서 버전이나 조회 날짜가 포함되어 있다.
- [ ] fallback을 사용하면 앞선 provider 실패 이유가 기록되어 있다.

Select one provider and return only the documentation needed by the caller.

1. Prefer chub when curated API docs or reusable annotations are available. Read `references/chub.md`.
2. Otherwise use Context7 when its library documentation provider is available. Read `references/context7.md`.
3. Otherwise research the official vendor documentation on the web and cite the source.
4. Delegate retrieval through native collaboration when the result would bloat the coordinator context. Claude Code maps the worker to Task/Agent; Codex maps it to native collaboration. Inherit the session model.

Never implement from training data when current documentation is required. Preserve the caller's requested library, topic, language, and output shape.
