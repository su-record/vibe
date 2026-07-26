# /vibe.docs arch — Architecture Documentation

> vibe.docs SKILL.md 의 서브커맨드 표에서 **`arch` 가 선택됐을 때만** 로드한다.

### `/vibe.docs arch` — Architecture Documentation

Generate architecture overview with diagrams:

1. **Module map**: Directory structure → responsibility mapping
2. **Dependency graph**: Import analysis → Mermaid diagram
3. **Data flow**: Entry points → processing → output
4. **Key decisions**: Extract from CLAUDE.md and code comments

Output: `docs/ARCHITECTURE.md`

**Mermaid diagram generation:**
```
File-pattern search: src/**/ → module list
Text search: pattern="^import .+ from" → dependency edges
Full-file reading: CLAUDE.md → architecture notes

Generate:
graph TD
    CLI[CLI Commands] --> Core[Core Logic]
    Core --> Infra[Infrastructure]
    Infra --> DB[(Database)]
    Infra --> API[External APIs]
```
