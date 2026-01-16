# 🐍 Python + FastAPI 품질 규칙

## 핵심 원칙 (core에서 상속)

```markdown
✅ 단일 책임 (SRP)
✅ 중복 제거 (DRY)
✅ 재사용성
✅ 낮은 복잡도
✅ 함수 ≤ 30줄 (권장), ≤ 50줄 (허용)
✅ 중첩 ≤ 3단계
✅ Cyclomatic complexity ≤ 10
```

## Python 특화 규칙

### 1. 타입 힌트 100% 필수

```python
# ❌ 타입 힌트 없음
def get_user(user_id):
    return db.get(user_id)

# ✅ 완전한 타입 힌트
async def get_user(user_id: str, db: AsyncSession) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
```

### 2. Pydantic으로 Contract 정의

```python
from pydantic import BaseModel, Field, EmailStr, field_validator

class CreateUserRequest(BaseModel):
    """사용자 생성 요청 스키마"""
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
    """사용자 응답 스키마"""
    id: str
    email: str
    username: str
    created_at: datetime

    class Config:
        from_attributes = True  # SQLAlchemy 호환
```

### 3. async/await 패턴

```python
# ✅ 비동기 I/O (데이터베이스, API 호출)
async def get_user_with_posts(
    user_id: str,
    db: AsyncSession
) -> tuple[User, list[Post]]:
    # 병렬 실행
    user_task = db.execute(select(User).where(User.id == user_id))
    posts_task = db.execute(select(Post).where(Post.user_id == user_id))

    user_result, posts_result = await asyncio.gather(user_task, posts_task)

    user = user_result.scalar_one_or_none()
    posts = list(posts_result.scalars().all())

    return user, posts

# ❌ 동기 함수 (블로킹)
def get_user(user_id: str):
    return requests.get(f"/users/{user_id}")  # 블로킹!
```

### 4. Early Return 선호

```python
# ❌ 중첩된 if문
async def process_order(order_id: str, db: AsyncSession):
    order = await get_order(order_id, db)
    if order:
        if order.is_valid:
            if order.items:
                if order.user.is_active:
                    return await process_items(order.items)
    return None

# ✅ Early return
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

### 5. Repository 패턴 (데이터 액세스 분리)

```python
# ✅ Repository 레이어
class UserRepository:
    """데이터 액세스만 담당"""

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

# ✅ Service 레이어 (비즈니스 로직)
class UserService:
    """비즈니스 로직만 담당"""

    def __init__(self, repository: UserRepository):
        self.repository = repository

    async def create_user(
        self, request: CreateUserRequest
    ) -> UserResponse:
        # 비즈니스 규칙: 이메일 중복 체크
        existing = await self.repository.get_by_email(request.email)
        if existing:
            raise HTTPException(409, detail="Email already exists")

        # 비즈니스 규칙: 비밀번호 해싱
        hashed_password = hash_password(request.password)

        # 생성
        user = User(
            email=request.email,
            username=request.username,
            password_hash=hashed_password,
        )
        user = await self.repository.create(user)

        return UserResponse.model_validate(user)
```

### 6. 의존성 주입 (FastAPI Depends)

```python
# app/core/deps.py
from sqlalchemy.ext.asyncio import AsyncSession

async def get_db() -> AsyncSession:
    """데이터베이스 세션 의존성"""
    async with async_session_maker() as session:
        yield session

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """현재 사용자 의존성"""
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
    """현재 사용자 프로필 조회"""
    return UserResponse.model_validate(current_user)
```

### 7. 에러 처리 표준

```python
from fastapi import HTTPException

# ✅ 명확한 에러 메시지
async def get_user(user_id: str, db: AsyncSession) -> User:
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail=f"User {user_id} not found"
        )
    return user

# ✅ 커스텀 예외
class UserNotFoundError(Exception):
    def __init__(self, user_id: str):
        self.user_id = user_id
        super().__init__(f"User {user_id} not found")

# 전역 예외 핸들러
@app.exception_handler(UserNotFoundError)
async def user_not_found_handler(request: Request, exc: UserNotFoundError):
    return JSONResponse(
        status_code=404,
        content={"detail": str(exc)}
    )
```

### 8. SQLAlchemy 2.0 스타일

```python
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

# ✅ 2.0 스타일 (async + select)
async def get_users_with_posts(db: AsyncSession) -> list[User]:
    result = await db.execute(
        select(User)
        .options(selectinload(User.posts))  # Eager loading
        .where(User.is_active == True)
        .order_by(User.created_at.desc())
        .limit(20)
    )
    return list(result.scalars().all())

# ❌ 1.x 스타일 (레거시)
def get_users():
    return session.query(User).filter_by(is_active=True).all()
```

### 9. Python 관용구 활용

```python
# ✅ List comprehension
active_users = [u for u in users if u.is_active]

# ✅ Dictionary comprehension
user_dict = {u.id: u.name for u in users}

# ✅ Generator expression (메모리 효율)
total = sum(u.age for u in users)

# ✅ Context manager
async with db.begin():
    user = User(...)
    db.add(user)
    # 자동 commit/rollback

# ✅ Dataclass (간단한 데이터 구조)
from dataclasses import dataclass

@dataclass(frozen=True)  # Immutable
class Point:
    x: float
    y: float
```

### 10. 로깅 표준

```python
import structlog

logger = structlog.get_logger()

# ✅ 구조화된 로깅
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

## 안티패턴

```python
# ❌ any 타입
def process_data(data: any):  # 타입 안전성 상실
    return data

# ❌ 블로킹 I/O in async 함수
async def bad_example():
    data = requests.get("https://api.example.com")  # 블로킹!
    return data

# ❌ 예외 무시
try:
    risky_operation()
except:
    pass  # 위험!

# ❌ Mutable default argument
def append_to_list(item, my_list=[]):  # 버그!
    my_list.append(item)
    return my_list

# ✅ 올바른 방법
def append_to_list(item, my_list: list | None = None):
    if my_list is None:
        my_list = []
    my_list.append(item)
    return my_list
```

## 코드 품질 도구

```bash
# 포맷팅
black .
isort .

# 린팅
flake8 .
ruff check .

# 타입 체크
mypy app/ --strict

# 테스트
pytest tests/ -v --cov=app

# 보안 체크
bandit -r app/
```

## 체크리스트

Python/FastAPI 코드 작성 시:

- [ ] 타입 힌트 100% (함수 시그니처, 변수)
- [ ] Pydantic 스키마로 Contract 정의
- [ ] async/await 사용 (I/O 작업)
- [ ] Early return 패턴
- [ ] Repository + Service 레이어 분리
- [ ] 의존성 주입 (Depends)
- [ ] 명확한 에러 메시지
- [ ] 구조화된 로깅
- [ ] 함수 ≤ 30줄 (SRP 준수)
- [ ] 복잡도 ≤ 10
