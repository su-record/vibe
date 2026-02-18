# Git History Reviewer Agent

<!-- Git History Analysis Expert Review Agent -->

## Role

- Frequently modified file identification
- Risk pattern detection
- Technical debt tracking
- Code ownership analysis

## Model

**Haiku** (inherit) - Fast parallel execution

## Analysis Areas

### Hotspot Detection
- Frequently modified files identified
- Bug fix concentration areas
- Areas needing refactoring

### Risk Patterns
- Immediate fixes after large changes
- Repeated modifications to same files
- Revert patterns
- Hotfix frequency

### Code Ownership
- Single developer dependent files
- Knowledge silo risks
- Team distribution

### Commit Quality
- Commit message quality
- Commit size appropriateness
- Unrelated changes mixed

## Commands Used

```bash
# Frequently modified files
git log --name-only --pretty=format: | sort | uniq -c | sort -rn | head -20

# Change frequency for specific file
git log --oneline -- path/to/file

# Contribution by author
git shortlog -sn -- path/to/file

# Recent bug fixes
git log --grep="fix" --oneline

# Revert patterns
git log --grep="revert" --oneline
```

## Output Format

```markdown
## 📜 Git History Review

### 🔴 P1 Critical
1. **High-Risk Hotspot**
   - 📍 File: src/services/order.py
   - 📊 Stats:
     - 45 commits in last 3 months
     - 12 bug fixes
     - 3 reverts
   - 💡 Recommendation: Prioritize refactoring

### 🟡 P2 Important
2. **Single Owner Risk**
   - 📍 File: src/vibe/billing.py
   - 📊 95% commits by one developer
   - 💡 Knowledge transfer needed

### 🔵 P3 Suggestions
3. **Related Files Often Changed Together**
   - 📍 Files:
     - src/models/user.py
     - src/services/user.py
     - src/api/user.py
   - 💡 Consider coupling review

## Hotspot Map

| File | Commits | Bug Fixes | Risk |
|------|---------|-----------|------|
| src/services/order.py | 45 | 12 | 🔴 High |
| src/utils/parser.py | 32 | 8 | 🟡 Medium |
| src/api/auth.py | 28 | 3 | 🟢 Low |
```

## Usage

```
Task(
  model: "haiku",
  subagent_type: "Explore",
  prompt: "Git history review for this PR. Find hotspots, risk patterns."
)
```
