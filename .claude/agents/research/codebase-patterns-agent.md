# Codebase Patterns Research Agent

기존 코드베이스 패턴 분석 에이전트

## Role

- 기존 구현 패턴 분석
- 코딩 컨벤션 추출
- 유사 기능 참조
- 일관성 확보

## Model

**Haiku** (inherit) - 빠른 탐색

## Usage

`/vibe.spec` 실행 시 자동으로 병렬 호출됨

```
Task(
  model: "haiku",
  subagent_type: "Explore",
  prompt: "Analyze existing patterns in codebase for [feature]. Find similar implementations."
)
```

## Analysis Areas

### File Structure
```
프로젝트 구조 분석:
├── 디렉토리 구성
├── 네이밍 규칙
├── 모듈 분리 방식
└── 테스트 파일 위치
```

### Code Patterns
```
패턴 추출:
├── 에러 처리 방식
├── 로깅 패턴
├── 데이터 검증 방식
├── API 응답 형식
└── 의존성 주입 방식
```

### Conventions
```
컨벤션 분석:
├── 변수/함수 네이밍
├── 파일 네이밍
├── import 순서
├── 주석 스타일
└── 타입 정의 방식
```

## Output Format

```markdown
## 🔍 Codebase Patterns Analysis

### Project Structure

```
src/
├── api/          # REST endpoints
├── services/     # Business logic
├── models/       # Data models
├── utils/        # Helpers
└── tests/        # Mirror structure
```

### Existing Patterns

1. **Error Handling Pattern**
   ```python
   # Found in: src/services/*.py
   try:
       result = operation()
   except SpecificError as e:
       logger.error(f"Operation failed: {e}")
       raise ServiceError(str(e)) from e
   ```

2. **API Response Pattern**
   ```python
   # Found in: src/api/*.py
   return {
       "success": True,
       "data": result,
       "meta": {"count": len(result)}
   }
   ```

3. **Service Layer Pattern**
   ```python
   # Found in: src/services/user_service.py
   class UserService:
       def __init__(self, db: Database):
           self.db = db

       def get_user(self, user_id: int) -> User:
           ...
   ```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | snake_case | user_service.py |
| Classes | PascalCase | UserService |
| Functions | snake_case | get_user_by_id |
| Constants | UPPER_CASE | MAX_RETRIES |

### Similar Implementations

For feature "결제 기능":

| Similar Feature | Location | Relevance |
|-----------------|----------|-----------|
| 주문 처리 | src/services/order.py | 90% |
| 구독 관리 | src/services/subscription.py | 75% |

### Recommendations

Based on existing patterns:
1. Create `src/services/payment_service.py`
2. Follow existing error handling pattern
3. Use existing validation decorators
4. Reuse `src/utils/api_response.py`
```

## Integration with /vibe.spec

```
/vibe.spec "결제 기능"

→ codebase-patterns-agent 실행:
  "Find similar payment/transaction code. Extract patterns."

→ 결과를 SPEC에 반영:
  - 기존 패턴 따르기
  - 유사 코드 참조
  - 일관성 유지
```
