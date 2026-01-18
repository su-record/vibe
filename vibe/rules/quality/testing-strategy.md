# Testing Strategy for the AI Era

## Core Principles

```markdown
✅ Single Responsibility (SRP)
✅ Don't Repeat Yourself (DRY)
✅ Reusability
✅ Low Complexity
✅ Contract-First Design
```

## Test Priorities in AI-Driven Development

### 1. Contract Testing (Highest Priority) ⭐⭐⭐

**Concept**: **Define contracts with types/schemas** before writing code

**Reason**: Since AI implements following contracts, type safety is automatically guaranteed

#### Python (Pydantic)

```python
# Contract definition (AI implements following this)
from pydantic import BaseModel, Field, EmailStr

class CreateUserRequest(BaseModel):
    """User creation contract"""
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8)
    age: int = Field(ge=0, le=150)

class UserResponse(BaseModel):
    """User response contract"""
    id: str
    email: str
    username: str
    created_at: str

# AI cannot violate this contract (auto-validated)
```

#### TypeScript

```typescript
// Contract definition
interface CreateUserRequest {
  email: string;
  username: string; // 3-50 chars
  password: string; // min 8 chars
  age: number; // 0-150
}

interface UserResponse {
  id: string;
  email: string;
  username: string;
  createdAt: string;
}

// Runtime validation with Zod
import { z } from 'zod';

const createUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50),
  password: z.string().min(8),
  age: z.number().min(0).max(150),
});
```

#### Dart (Flutter)

```dart
// Contract definition
class CreateUserRequest {
  const CreateUserRequest({
    required this.email,
    required this.username,
    required this.password,
    required this.age,
  });

  final String email;
  final String username; // 3-50 chars
  final String password; // min 8 chars
  final int age; // 0-150

  // JSON serialization (contract enforcement)
  Map<String, dynamic> toJson() => {
    'email': email,
    'username': username,
    'password': password,
    'age': age,
  };
}
```

### 2. Integration Testing (High) ⭐⭐⭐

**Concept**: **Test real scenarios** where multiple modules work together

**Reason**: Discovers module interaction errors that AI may have missed

```python
# ✅ Integration test: Real business flow
@pytest.mark.asyncio
async def test_user_registration_flow():
    """
    Scenario: New user registration
    1. Check email duplication
    2. Create user
    3. Send welcome email
    4. Create default settings
    """
    # Given: New user information
    request = CreateUserRequest(
        email="new@example.com",
        username="newuser",
        password="password123",
        age=25,
    )

    # When: Call registration API
    response = await client.post("/api/users", json=request.dict())

    # Then: User creation succeeds
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "new@example.com"

    # And: Welcome email sent
    assert email_service.sent_count == 1

    # And: Default settings created
    settings = await get_user_settings(data["id"])
    assert settings is not None
```

```typescript
// ✅ Integration test: React component + API
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserRegistration } from './UserRegistration';

test('user can register successfully', async () => {
  // Given: Render registration form
  render(<UserRegistration />);

  // When: User fills form
  await userEvent.type(screen.getByLabelText('Email'), 'new@example.com');
  await userEvent.type(screen.getByLabelText('Username'), 'newuser');
  await userEvent.type(screen.getByLabelText('Password'), 'password123');
  await userEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

  // Then: Success message displayed
  await waitFor(() => {
    expect(screen.getByText('Welcome!')).toBeInTheDocument();
  });
});
```

### 3. Property-Based Testing (Medium) ⭐⭐

**Concept**: **Automatically generate inputs** across entire input range to test

**Reason**: Automatically discovers edge cases AI didn't think of

```python
# ✅ Property-based testing (Hypothesis)
from hypothesis import given, strategies as st

@given(
    age=st.integers(min_value=0, max_value=150),
    email=st.emails(),
    username=st.text(min_size=3, max_size=50),
)
def test_user_creation_with_any_valid_input(age, email, username):
    """User creation possible with any valid input"""
    user = create_user(email=email, username=username, age=age)
    assert user.age == age
    assert user.email == email
```

```typescript
// ✅ Property-based testing (fast-check)
import fc from 'fast-check';

test('discount calculation always returns valid percentage', () => {
  fc.assert(
    fc.property(
      fc.float({ min: 0, max: 10000 }), // price
      fc.float({ min: 0, max: 1 }), // discount rate
      (price, rate) => {
        const discount = calculateDiscount(price, rate);
        return discount >= 0 && discount <= price;
      }
    )
  );
});
```

### 4. Unit Testing (Low, Selective) ⭐

**Concept**: Test individual functions/methods

**When to write**: **Only for complex business logic** selectively

```python
# ✅ Unit Test: Complex business rules
def test_tier_selection_score_calculation():
    """
    Selection score calculation (complex weights)
    - Feed ×1.15
    - OCR ×1.2
    - Likes ×1.0
    - Bookmarks ×1.0
    - Partnerships ×1.5
    """
    score = calculate_selection_score(
        feeds=10,      # 10 × 1.15 = 11.5
        ocr_count=5,   # 5 × 1.2 = 6
        likes=20,      # 20 × 1.0 = 20
        bookmarks=8,   # 8 × 1.0 = 8
        partnerships=2, # 2 × 1.5 = 3
    )
    assert score == 48.5

# ❌ Unnecessary Unit Test: Simple CRUD
def test_get_user_by_id():
    """Integration Test is sufficient"""
    user = get_user("user-123")
    assert user.id == "user-123"  # Meaningless
```

### 5. E2E Testing (Scenario Verification) ⭐⭐

**Concept**: Test complete scenarios from user perspective

**When**: Only selectively for major user flows

```typescript
// ✅ E2E Test: Playwright/Cypress
test('user can complete full registration flow', async ({ page }) => {
  // 1. Visit homepage
  await page.goto('https://app.example.com');

  // 2. Click sign up
  await page.click('text=Sign Up');

  // 3. Fill form
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="username"]', 'testuser');
  await page.fill('input[name="password"]', 'password123');

  // 4. Submit
  await page.click('button[type="submit"]');

  // 5. Verify redirect to dashboard
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('h1')).toContainText('Welcome, testuser!');
});
```

## Test Priority Decision Tree

```
When developing new features:

1. Did you define contracts?
   No → Write contracts first (Pydantic/Zod/Dart class)
   Yes → ⬇️

2. Do multiple modules collaborate?
   Yes → Write Integration Test ⭐⭐⭐
   No → ⬇️

3. Is it complex business logic? (complexity > 10)
   Yes → Write Unit Test ⭐
   No → ⬇️

4. Is it a core user flow?
   Yes → Write E2E Test ⭐⭐
   No → Done ✅
```

## TDD Alternative for AI Era: ATDD (AI-Test-Driven Development)

```markdown
# New development flow

1. **Clarify requirements** (Developer)
   "Premium users get 10% discount"

2. **Define contracts** (Developer)
   interface DiscountRequest {
     userId: string;
     orderTotal: number;
   }

   interface DiscountResponse {
     originalPrice: number;
     discountedPrice: number;
     discountRate: number;
   }

3. **Write test scenarios** (Developer or AI)
   test('premium user gets 10% discount', () => {
     // Given: Premium user, 100 order
     // When: Calculate discount
     // Then: 90 (10% discount)
   })

4. **AI implements** (AI)
   - Generate code following contracts
   - Write code that passes tests

5. **Integration test** (Automated)
   - Verify complete scenarios in CI/CD

6. **Refactoring** (AI + Developer)
   - Remove complexity, duplication
   - Verify SRP compliance
```

## Language-specific Tools

### Python

```bash
# Contract Testing
pip install pydantic

# Integration Testing
pip install pytest pytest-asyncio httpx

# Property-Based Testing
pip install hypothesis

# Coverage
pip install pytest-cov
```

### TypeScript/JavaScript

```bash
# Contract Testing
npm install zod

# Integration Testing
npm install @testing-library/react @testing-library/user-event

# Property-Based Testing
npm install fast-check

# E2E Testing
npm install playwright
```

### Dart/Flutter

```bash
# Integration Testing
flutter pub add integration_test

# Widget Testing
flutter test

# E2E Testing (Flutter Driver)
flutter drive --target=test_driver/app.dart
```

## Anti-patterns

```python
# ❌ Testing implementation details (fragile)
def test_internal_cache_structure():
    service = UserService()
    assert service._cache == {}  # Depends on internal implementation

# ✅ Testing public API (robust)
def test_user_data_is_cached_after_first_call():
    service = UserService()
    user1 = service.get_user("123")
    user2 = service.get_user("123")
    assert user1 is user2  # Only verify behavior
```

```typescript
// ❌ Unit tests for every function (excessive)
test('add function adds two numbers', () => {
  expect(add(1, 2)).toBe(3);  // Meaningless
});

// ✅ Only test complex logic
test('calculate shipping cost with multiple conditions', () => {
  const cost = calculateShipping({
    weight: 10,
    distance: 500,
    isPremium: true,
    isExpress: false,
  });
  expect(cost).toBe(45);  // Verify complex rules
});
```

## Test Coverage Goals

```markdown
# Realistic goals

- Contract Coverage: 100% (All APIs have schema definitions)
- Integration Coverage: 80% (Major business flows)
- Unit Coverage: Selective (Complex logic only)
- E2E Coverage: 20-30% (Core user flows)

# ❌ Avoid
- 100% Unit Test Coverage (waste of time)
- Unit Tests for simple CRUD (Integration is sufficient)
- Manual testing all edge cases (use Property-based)
```

## Key Summary

```markdown
AI Era Testing Strategy:

1. ✅ Contract-First (types/schemas first)
2. ✅ Integration Testing (real scenarios)
3. ⚠️ Unit Testing (complex logic only)
4. ❌ Traditional TDD (inefficient in AI era)

Goals:
- Single Responsibility (SRP)
- No Duplication (DRY)
- Reusability
- Low Complexity
- Fast Feedback
```
