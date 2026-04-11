---
description: Generate project documentation — README, architecture docs, user guide, release notes
argument-hint: "readme, guide, arch, or release"
---

# /vibe.docs

Generate or update project documentation by analyzing the actual codebase.

## Usage

```
/vibe.docs readme     # README.md 생성/갱신
/vibe.docs guide      # 사용자 가이드 (docs/GUIDE.md)
/vibe.docs arch       # 아키텍처 문서 + Mermaid 다이어그램 (docs/ARCHITECTURE.md)
/vibe.docs release    # 릴리즈 노트 (git history 기반)
```

## Pipeline Position

```
/vibe.spec    → Design (what to build)
/vibe.run     → Implement (build it)
/vibe.trace   → Verify (prove it works)
/vibe.docs    → Document (explain it)
```

---

Load skill `vibe-docs` — subcommand에 따라 해당 섹션 실행

ARGUMENTS: $ARGUMENTS
