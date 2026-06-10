# askUser Tool — Usage Examples

> Referenced by `spec` SKILL.md Step 2.1 (Critical Requirements Confirmation).
> Read this file when invoking the `askUser` tool for the first time in a session.

## Usage

```typescript
import { askUser, askUserQuick } from '@su-record/vibe/tools';

// Quick helper for common scenarios
const result = await askUserQuick.login('my-login-feature');
console.log(result.content[0].text);

// Custom categories
const result = await askUser({
  featureName: 'user-dashboard',
  categories: ['authentication', 'security', 'session', 'data_model'],
  context: 'Building a user dashboard with role-based access',
});
```

## Example output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Requirements Confirmation
Feature: login
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 🔐 Authentication

### 🔐 Q-AUTHENTICATION-001

**Which authentication methods should be supported?**
(Multiple selection allowed)

1. **Email/Password** ✓
2. **Google Social Login**
3. **Apple Social Login**
...

**Required**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total 6 questions (Required: 4)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Response parsing

```typescript
import { parseUserResponse } from '@su-record/vibe/tools';

// User responds: "1, 2, 4" (selected option numbers)
const response = parseUserResponse(question, "1, 2, 4");
// { questionId: "Q-AUTH-001", value: ["email_password", "social_google", "passkey"], timestamp: "..." }
```
