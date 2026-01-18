# Python + FastAPI Quality Rules

## Core Principles (inherited from core)

```markdown
# Core Principles (inherited from core)
Single Responsibility (SRP)
No Duplication (DRY)
Reusability
Low Complexity
Function <= 30 lines (recommended), <= 50 lines (allowed)
Nesting <= 3 levels
Cyclomatic complexity <= 10
```

## Python Specific Rules

### 1. 100% Type Hints Required

```python
# Bad: No type hints
def get_user(user_id):
    return db.get(user_id)

# Good: Complete type hints
async def get_user(user_id: str, db: AsyncSession) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
```

### 2. Define Contract with Pydantic

```python
from pydantic import BaseModel, Field, EmailStr, field_validator

class CreateUserRequest(BaseModel):
    """User creation request schema"""
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8)
    age: int = Field(ge=0, le=150)

    @field_validator("username")
    def validate_username(cls, v: str) -> str:
        if not v.isalnum():
            raise ValueError("Username must be alphanumeric")
        return v.lower()

    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "username": "johndoe",
                "password": "securepass123",
                "age": 25,
            }
        }

class UserResponse(BaseModel):
    """User response schema"""
    id: str
    email: str
    username: str
    created_at: datetime

    class Config:
        from_attributes = True  # SQLAlchemy compatible
```

### 3. async/await Pattern

```python
# Good: Async I/O (database, API calls)
async def get_user_with_posts(
    user_id: str,
    db: AsyncSession
) -> tuple[User, list[Post]]:
    # Parallel execution
    user_task = db.execute(select(User).where(User.id == user_id))
    posts_task = db.execute(select(Post).where(Post.user_id == user_id))

    user_result, posts_result = await asyncio.gather(user_task, posts_task)

    user = user_result.scalar_one_or_none()
    posts = list(posts_result.scalars().all())

    return user, posts

# Bad: Synchronous function (blocking)
def get_user(user_id: str):
    return requests.get(f"/users/{user_id}")  # Blocking!
```

### 4. Prefer Early Return

```python
# Bad: Nested if statements
async def process_order(order_id: str, db: AsyncSession):
    order = await get_order(order_id, db)
    if order:
        if order.is_valid:
            if order.items:
                if order.user.is_active:
                    return await process_items(order.items)
    return None

# Good: Early return
async def process_order(order_id: str, db: AsyncSession) -> ProcessResult | None:
    order = await get_order(order_id, db)
    if not order:
        return None
    if not order.is_valid:
        return None
    if not order.items:
        return None
    if not order.user.is_active:
        return None

    return await process_items(order.items)
```

### 5. Repository Pattern (Separate Data Access)

```python
# Good: Repository layer
class UserRepository:
    """Handles data access only"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: str) -> User | None:
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def create(self, user: User) -> User:
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()

# Good: Service layer (business logic)
class UserService:
    """Handles business logic only"""

    def __init__(self, repository: UserRepository):
        self.repository = repository

    async def create_user(
        self, request: CreateUserRequest
    ) -> UserResponse:
        # Business rule: Check email duplication
        existing = await self.repository.get_by_email(request.email)
        if existing:
            raise HTTPException(409, detail="Email already exists")

        # Business rule: Hash password
        hashed_password = hash_password(request.password)

        # Create
        user = User(
            email=request.email,
            username=request.username,
            password_hash=hashed_password,
        )
        user = await self.repository.create(user)

        return UserResponse.model_validate(user)
```

### 6. Dependency Injection (FastAPI Depends)

```python
# app/core/deps.py
from sqlalchemy.ext.asyncio import AsyncSession

async def get_db() -> AsyncSession:
    """Database session dependency"""
    async with async_session_maker() as session:
        yield session

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Current user dependency"""
    payload = decode_jwt(token)
    user = await get_user_by_id(payload["sub"], db)
    if not user:
        raise HTTPException(401, detail="Invalid credentials")
    return user

# app/api/v1/users.py
@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_user)
):
    """Get current user profile"""
    return UserResponse.model_validate(current_user)
```

### 7. Error Handling Standard

```python
from fastapi import HTTPException

# Good: Clear error messages
async def get_user(user_id: str, db: AsyncSession) -> User:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail=f"User {user_id} not found"
        )
    return user

# Good: Custom exception
class UserNotFoundError(Exception):
    def __init__(self, user_id: str):
        self.user_id = user_id
        super().__init__(f"User {user_id} not found")

# Global exception handler
@app.exception_handler(UserNotFoundError)
async def user_not_found_handler(request: Request, exc: UserNotFoundError):
    return JSONResponse(
        status_code=404,
        content={"detail": str(exc)}
    )
```

### 8. SQLAlchemy 2.0 Style

```python
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

# Good: 2.0 style (async + select)
async def get_users_with_posts(db: AsyncSession) -> list[User]:
    result = await db.execute(
        select(User)
        .options(selectinload(User.posts))  # Eager loading
        .where(User.is_active == True)
        .order_by(User.created_at.desc())
        .limit(20)
    )
    return list(result.scalars().all())

# Bad: 1.x style (legacy)
def get_users():
    return session.query(User).filter_by(is_active=True).all()
```

### 9. Python Idioms

```python
# Good: List comprehension
active_users = [u for u in users if u.is_active]

# Good: Dictionary comprehension
user_dict = {u.id: u.name for u in users}

# Good: Generator expression (memory efficient)
total = sum(u.age for u in users)

# Good: Context manager
async with db.begin():
    user = User(...)
    db.add(user)
    # Auto commit/rollback

# Good: Dataclass (simple data structure)
from dataclasses import dataclass

@dataclass(frozen=True)  # Immutable
class Point:
    x: float
    y: float
```

### 10. Logging Standard

```python
import structlog

logger = structlog.get_logger()

# Good: Structured logging
async def create_user(request: CreateUserRequest):
    logger.info(
        "user_creation_started",
        email=request.email,
        username=request.username
    )

    try:
        user = await user_service.create(request)
        logger.info(
            "user_creation_succeeded",
            user_id=user.id,
            email=user.email
        )
        return user
    except Exception as e:
        logger.error(
            "user_creation_failed",
            email=request.email,
            error=str(e),
            exc_info=True
        )
        raise
```

## Anti-patterns

```python
# Bad: any type
def process_data(data: any):  # Type safety lost
    return data

# Bad: Blocking I/O in async function
async def bad_example():
    data = requests.get("https://api.example.com")  # Blocking!
    return data

# Bad: Ignoring exceptions
try:
    risky_operation()
except:
    pass  # Dangerous!

# Bad: Mutable default argument
def append_to_list(item, my_list=[]):  # Bug!
    my_list.append(item)
    return my_list

# Good: Correct way
def append_to_list(item, my_list: list | None = None):
    if my_list is None:
        my_list = []
    my_list.append(item)
    return my_list
```

## Code Quality Tools

```bash
# Formatting
black .
isort .

# Linting
flake8 .
ruff check .

# Type check
mypy app/ --strict

# Testing
pytest tests/ -v --cov=app

# Security check
bandit -r app/
```

## Checklist

When writing Python/FastAPI code:

- [ ] 100% type hints (function signatures, variables)
- [ ] Define contract with Pydantic schema
- [ ] Use async/await (I/O operations)
- [ ] Early return pattern
- [ ] Repository + Service layer separation
- [ ] Dependency injection (Depends)
- [ ] Clear error messages
- [ ] Structured logging
- [ ] Function <= 30 lines (SRP)
- [ ] Complexity <= 10
