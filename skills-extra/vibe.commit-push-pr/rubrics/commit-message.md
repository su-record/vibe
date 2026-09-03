# Commit Message Format Rubric

## Structure

```
<type>(<scope>): <subject>          ← 50 chars max, imperative mood
                                    ← blank line
<body>                              ← 72 chars/line wrap, explain WHY
                                    ← blank line
<footer>                            ← Co-Authored-By, Closes #N
```

## Types

| Type | When to Use |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code restructure, no behavior change |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `docs` | Documentation only |
| `style` | Formatting, whitespace (no logic change) |
| `chore` | Build, deps, tooling, CI |

## Subject Line Rules

- Imperative mood: "add feature" not "added feature"
- No period at end
- Max 50 characters
- Scope is optional: `feat(auth): add OAuth login`

## Body Rules

- Explain **why**, not what (code shows what)
- Wrap at 72 characters
- Use bullet points for multiple changes
- Reference issues: `Closes #123`, `Fixes #456`

## Required Footer

```
Co-Authored-By: Claude <noreply@anthropic.com>
```

## Examples

```
feat(auth): add GitHub OAuth login

Users can now sign in with GitHub instead of email/password.
Reduces friction for developer-focused onboarding flow.

Closes #42
Co-Authored-By: Claude <noreply@anthropic.com>
```

```
fix(api): prevent null reference on empty search results

The search endpoint crashed when no results matched.
Added early return with empty array instead.

Co-Authored-By: Claude <noreply@anthropic.com>
```

## Rejection Criteria

- Subject over 50 chars
- Missing Co-Authored-By line
- Past tense in subject ("added", "fixed")
- Subject with period at end
- No body when change is non-trivial
