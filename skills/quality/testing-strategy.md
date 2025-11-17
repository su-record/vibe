# 🧪 AI 시대 테스트 전략

## 핵심 원칙

```markdown
✅ 단일 책임 (SRP)
✅ 중복 코드 제거 (DRY)
✅ 재사용성 (Reusability)
✅ 낮은 복잡도 (Low Complexity)
✅ 계약 우선 설계 (Contract-First)
```

## AI 주도 개발에서의 테스트 우선순위

### 1. Contract Testing (최우선) ⭐⭐⭐

**개념**: 코드 작성 전에 **타입/스키마로 계약을 정의**

**이유**: AI가 계약을 따라 구현하므로, 타입 안전성이 자동 보장됨

#### Python (Pydantic)

```python
# 계약 정의 (AI가 이를 따라 구현)
from pydantic import BaseModel, Field, EmailStr

class CreateUserRequest(BaseModel):
    """사용자 생성 계약"""
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8)
    age: int = Field(ge=0, le=150)

class UserResponse(BaseModel):
    """사용자 응답 계약"""
    id: str
    email: str
    username: str
    created_at: str

# AI가 이 계약을 위반할 수 없음 (자동 검증)
```

#### TypeScript

```typescript
// 계약 정의
interface CreateUserRequest {
  email: string;
  username: string; // 3-50자
  password: string; // 최소 8자
  age: number; // 0-150
}

interface UserResponse {
  id: string;
  email: string;
  username: string;
  createdAt: string;
}

// Zod로 런타임 검증
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
// 계약 정의
class CreateUserRequest {
  const CreateUserRequest({
    required this.email,
    required this.username,
    required this.password,
    required this.age,
  });

  final String email;
  final String username; // 3-50자
  final String password; // 최소 8자
  final int age; // 0-150

  // JSON 직렬화 (계약 강제)
  Map<String, dynamic> toJson() => {
    'email': email,
    'username': username,
    'password': password,
    'age': age,
  };
}
```

### 2. Integration Testing (높음) ⭐⭐⭐

**개념**: 여러 모듈이 함께 작동하는 **실제 시나리오 테스트**

**이유**: AI가 놓친 모듈 간 상호작용 오류를 발견

```python
# ✅ 통합 테스트: 실제 비즈니스 흐름
@pytest.mark.asyncio
async def test_user_registration_flow():
    """
    시나리오: 신규 사용자 가입
    1. 이메일 중복 체크
    2. 사용자 생성
    3. 환영 이메일 발송
    4. 기본 설정 생성
    """
    # Given: 신규 사용자 정보
    request = CreateUserRequest(
        email="new@example.com",
        username="newuser",
        password="password123",
        age=25,
    )

    # When: 회원가입 API 호출
    response = await client.post("/api/users", json=request.dict())

    # Then: 사용자 생성 성공
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "new@example.com"

    # And: 환영 이메일 발송 확인
    assert email_service.sent_count == 1

    # And: 기본 설정 생성 확인
    settings = await get_user_settings(data["id"])
    assert settings is not None
```

```typescript
// ✅ 통합 테스트: React 컴포넌트 + API
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserRegistration } from './UserRegistration';

test('user can register successfully', async () => {
  // Given: 회원가입 폼 렌더링
  render(<UserRegistration />);

  // When: 사용자가 폼 입력
  await userEvent.type(screen.getByLabelText('Email'), 'new@example.com');
  await userEvent.type(screen.getByLabelText('Username'), 'newuser');
  await userEvent.type(screen.getByLabelText('Password'), 'password123');
  await userEvent.click(screen.getByRole('button', { name: 'Sign Up' }));

  // Then: 성공 메시지 표시
  await waitFor(() => {
    expect(screen.getByText('Welcome!')).toBeInTheDocument();
  });
});
```

### 3. Property-Based Testing (중간) ⭐⭐

**개념**: 입력 범위 전체를 **자동 생성하여 테스트**

**이유**: AI가 생각 못한 엣지 케이스를 자동으로 발견

```python
# ✅ Property-based testing (Hypothesis)
from hypothesis import given, strategies as st

@given(
    age=st.integers(min_value=0, max_value=150),
    email=st.emails(),
    username=st.text(min_size=3, max_size=50),
)
def test_user_creation_with_any_valid_input(age, email, username):
    """모든 유효한 입력으로 사용자 생성 가능"""
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
      fc.float({ min: 0, max: 10000 }), // 가격
      fc.float({ min: 0, max: 1 }), // 할인율
      (price, rate) => {
        const discount = calculateDiscount(price, rate);
        return discount >= 0 && discount <= price;
      }
    )
  );
});
```

### 4. Unit Testing (낮음, 선택적) ⭐

**개념**: 개별 함수/메서드 테스트

**언제 작성**: **복잡한 비즈니스 로직만** 선택적으로

```python
# ✅ Unit Test: 복잡한 비즈니스 규칙
def test_tier_selection_score_calculation():
    """
    대장금 선발 점수 계산 (복잡한 가중치)
    - 피드 ×1.15
    - OCR ×1.2
    - 좋아요 ×1.0
    - 북마크 ×1.0
    - 연계 ×1.5
    """
    score = calculate_selection_score(
        feeds=10,      # 10 × 1.15 = 11.5
        ocr_count=5,   # 5 × 1.2 = 6
        likes=20,      # 20 × 1.0 = 20
        bookmarks=8,   # 8 × 1.0 = 8
        partnerships=2, # 2 × 1.5 = 3
    )
    assert score == 48.5

# ❌ 불필요한 Unit Test: 단순 CRUD
def test_get_user_by_id():
    """Integration Test로 충분"""
    user = get_user("user-123")
    assert user.id == "user-123"  # 의미 없음
```

### 5. E2E Testing (시나리오 검증) ⭐⭐

**개념**: 사용자 관점의 전체 시나리오 테스트

**언제**: 주요 사용자 플로우만 선택적으로

```typescript
// ✅ E2E Test: Playwright/Cypress
test('user can complete full registration flow', async ({ page }) => {
  // 1. 홈페이지 접속
  await page.goto('https://app.example.com');

  // 2. 회원가입 클릭
  await page.click('text=Sign Up');

  // 3. 폼 입력
  await page.fill('input[name="email"]', 'test@example.com');
  await page.fill('input[name="username"]', 'testuser');
  await page.fill('input[name="password"]', 'password123');

  // 4. 제출
  await page.click('button[type="submit"]');

  // 5. 대시보드로 리다이렉트 확인
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('h1')).toContainText('Welcome, testuser!');
});
```

## 테스트 우선순위 결정 트리

```
새 기능 개발 시:

1. Contract 정의했는가?
   No → Contract 먼저 작성 (Pydantic/Zod/Dart class)
   Yes → ⬇️

2. 여러 모듈이 협력하는가?
   Yes → Integration Test 작성 ⭐⭐⭐
   No → ⬇️

3. 복잡한 비즈니스 로직인가? (복잡도 > 10)
   Yes → Unit Test 작성 ⭐
   No → ⬇️

4. 핵심 사용자 플로우인가?
   Yes → E2E Test 작성 ⭐⭐
   No → 완료 ✅
```

## AI 시대의 TDD 대안: ATDD (AI-Test-Driven Development)

```markdown
# 새로운 개발 흐름

1. **요구사항 명확화** (개발자)
   "프리미엄 사용자는 10% 할인을 받는다"

2. **Contract 정의** (개발자)
   interface DiscountRequest {
     userId: string;
     orderTotal: number;
   }

   interface DiscountResponse {
     originalPrice: number;
     discountedPrice: number;
     discountRate: number;
   }

3. **테스트 시나리오 작성** (개발자 or AI)
   test('premium user gets 10% discount', () => {
     // Given: 프리미엄 유저, 100원 주문
     // When: 할인 계산
     // Then: 90원 (10% 할인)
   })

4. **AI가 구현** (AI)
   - Contract를 따라 코드 생성
   - 테스트 통과하는 코드 작성

5. **통합 테스트** (자동)
   - CI/CD에서 전체 시나리오 검증

6. **리팩토링** (AI + 개발자)
   - 복잡도, 중복 제거
   - SRP 준수 확인
```

## 언어별 도구

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

## 안티패턴

```python
# ❌ 구현 세부사항 테스트 (깨지기 쉬움)
def test_internal_cache_structure():
    service = UserService()
    assert service._cache == {}  # 내부 구현에 의존

# ✅ 공개 API 테스트 (견고함)
def test_user_data_is_cached_after_first_call():
    service = UserService()
    user1 = service.get_user("123")
    user2 = service.get_user("123")
    assert user1 is user2  # 동작만 검증
```

```typescript
// ❌ 모든 함수에 Unit Test (과도함)
test('add function adds two numbers', () => {
  expect(add(1, 2)).toBe(3);  // 의미 없음
});

// ✅ 복잡한 로직만 테스트
test('calculate shipping cost with multiple conditions', () => {
  const cost = calculateShipping({
    weight: 10,
    distance: 500,
    isPremium: true,
    isExpress: false,
  });
  expect(cost).toBe(45);  // 복잡한 규칙 검증
});
```

## 테스트 커버리지 목표

```markdown
# 현실적인 목표

- Contract Coverage: 100% (모든 API는 스키마 정의)
- Integration Coverage: 80% (주요 비즈니스 흐름)
- Unit Coverage: 선택적 (복잡한 로직만)
- E2E Coverage: 20-30% (핵심 사용자 플로우)

# ❌ 피해야 할 것
- 100% Unit Test Coverage (시간 낭비)
- 단순 CRUD에 Unit Test (Integration으로 충분)
- 모든 엣지 케이스 수동 테스트 (Property-based 사용)
```

## 핵심 요약

```markdown
AI 시대 테스트 전략:

1. ✅ Contract-First (타입/스키마 먼저)
2. ✅ Integration Testing (실제 시나리오)
3. ⚠️ Unit Testing (복잡한 로직만)
4. ❌ 전통적 TDD (AI 시대엔 비효율)

목표:
- 단일 책임 (SRP)
- 중복 제거 (DRY)
- 재사용성
- 낮은 복잡도
- 빠른 피드백
```
