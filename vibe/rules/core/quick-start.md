# Quick Start - Immediately Applicable Principles

## 5 Core Principles

```
✅ 📉 Less code means less technical debt
✅ 🚫 DRY - Don't Repeat Yourself
✅ 🎯 Single Responsibility Principle (SRP)
✅ 🙏 YAGNI - You Aren't Gonna Need It
✅ 🔒 Security first
```

## Language Configuration

Language settings can be configured in `.sutory/config.json`:

```json
{
  "language": "en"  // Options: "en", "ko"
}
```

## Checkpoints

### Before Adding New Packages

- [ ] Can it be solved with existing packages?
- [ ] Is it really necessary?
- [ ] What is the bundle size impact?

### When Creating Files

- [ ] Verify where it will be used
- [ ] Add imports immediately
- [ ] Check for circular dependencies

## Top Priority: Surgical Precision

> **⚠️ This is the first principle that precedes all work.**
>
> **Never modify/delete code that wasn't requested.**

- **Strict scope adherence**: Only modify files and code blocks explicitly requested by the user
- **Preserve existing code**: Do not arbitrarily refactor or remove working code
- **Respect style**: Maintain existing naming, formatting, and comment styles

## Pre-Work Checklist

```
[x] Follow top priority: Never modify outside request scope
[ ] Respect existing code: Maintain existing style and structure
[ ] Follow documentation rules: Adhere to naming, structure guidelines
```

## Golden Rules

- **Simplicity aesthetics**: Less code is better code
- **DRY principle**: Don't repeat, reuse
- **Single responsibility**: One function serves one purpose
- **Pragmatism**: Practical over perfect, YAGNI spirit

## Code Examples

### Good Example

```python
# User authentication middleware
async def authenticate_user(token: str) -> User:
    """
    Verify JWT token and return user.

    Args:
        token: JWT authentication token

    Returns:
        Authenticated user object

    Raises:
        HTTPException: When token is invalid
    """
    # Verify token
    payload = decode_jwt(token)

    # Get user
    user = await get_user(payload["sub"])
    if not user:
        raise HTTPException(401, detail="Authentication failed")

    return user
```

### Bad Example

```python
# No comments, unclear purpose
async def auth(t):
    p = decode_jwt(t)
    u = await get_user(p["sub"])
    if not u:
        raise HTTPException(401)
    return u
```
