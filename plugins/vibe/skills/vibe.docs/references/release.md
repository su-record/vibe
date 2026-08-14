# /vibe.docs release — Release Notes

> vibe.docs SKILL.md 의 서브커맨드 표에서 **`release` 가 선택됐을 때만** 로드한다.

### `/vibe.docs release` — Release Notes

Generate release notes from git history:

1. **Collect**: `git log` since last tag
2. **Classify**: feat/fix/refactor/docs/chore from commit messages
3. **Group**: By category with breaking changes highlighted
4. **Format**: Semantic versioning suggestion

Output: `RELEASE_NOTES.md` or append to `CHANGELOG.md`

**Output format:**
```markdown
## [x.y.z] - YYYY-MM-DD

### Breaking Changes
- ...

### Features
- feat: description (#PR)

### Bug Fixes
- fix: description (#PR)

### Other
- refactor/docs/chore items
```
