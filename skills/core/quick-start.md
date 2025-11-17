# ⚡ Quick Start - 즉시 적용 가능한 원칙

## 🎯 5가지 핵심 원칙

```
✅ 🇰🇷 한국어로 응답 (최우선)
✅ 📉 코드가 적을수록 부채도 적다
✅ 🚫 DRY - Don't Repeat Yourself
✅ 🎯 단일 책임 원칙 (SRP)
✅ 🙏 YAGNI - You Aren't Gonna Need It
```

## ⚠️ 언어 규칙 (절대 준수)

**모든 답변은 한국어로 작성합니다.**

### 한국어 사용 원칙

1. **설명, 주석, 대화**: 100% 한국어
2. **코드**: 영어 (프로그래밍 언어 표준)
3. **기술 용어**: 한국어 우선, 필요시 영어 병기
   - ✅ "의존성 주입 (Dependency Injection)"
   - ✅ "상태 관리 (State Management)"
   - ❌ "Dependency Injection"
4. **에러 메시지**: 한국어로 설명
5. **문서 제목/헤더**: 한국어

### 예시

```python
# ✅ 좋은 예
# 사용자 인증 미들웨어
async def authenticate_user(token: str) -> User:
    """
    JWT 토큰을 검증하고 사용자를 반환합니다.

    Args:
        token: JWT 인증 토큰

    Returns:
        인증된 사용자 객체

    Raises:
        HTTPException: 토큰이 유효하지 않은 경우
    """
    # 토큰 검증
    payload = decode_jwt(token)

    # 사용자 조회
    user = await get_user(payload["sub"])
    if not user:
        raise HTTPException(401, detail="인증 실패")

    return user

# ❌ 나쁜 예
# User authentication middleware
async def authenticate_user(token: str) -> User:
    """
    Verify JWT token and return user.
    """
    # Verify token
    payload = decode_jwt(token)

    # Get user
    user = await get_user(payload["sub"])
    if not user:
        raise HTTPException(401, detail="Authentication failed")

    return user
```

### AI 응답 예시

```markdown
# ❌ 영어 응답
I'll help you create a new API endpoint. First, let's define the schema...

# ✅ 한국어 응답
새로운 API 엔드포인트를 만들어드리겠습니다. 먼저 스키마를 정의하겠습니다...
```

## 📦 체크포인트

### 새 패키지 추가 전

- [ ] 기존 패키지로 해결 가능한가?
- [ ] 정말 필요한가?
- [ ] 번들 크기 영향은?

### 파일 생성 시

- [ ] 사용 위치 확인
- [ ] import 즉시 추가
- [ ] 순환 의존성 체크

## 🥇 최우선 원칙: 수술적 정밀도

> **⚠️ 이것은 모든 작업에 앞서는 TORY의 첫 번째 원칙입니다.**
>
> **요청받지 않은 코드는 절대 수정/삭제하지 않습니다.**

- **엄격한 범위 준수**: 사용자가 명시적으로 요청한 파일과 코드 블록만 수정
- **기존 코드 보존**: 작동하는 코드를 임의로 리팩토링하거나 제거하지 않음
- **스타일 존중**: 기존 네이밍, 포맷팅, 주석 스타일 유지

## 🚀 작업 전 필수 체크리스트

```
[x] 최우선 원칙 준수: 요청 범위 외 절대 수정 금지
[ ] 기존 코드 존중: 기존 스타일과 구조 유지
[ ] 문서 규칙 준수: 네이밍, 구조 등 모든 가이드라인 준수
```

## 🎯 황금률

- **한국어 우선**: 모든 커뮤니케이션은 명확한 한국어로
- **단순함의 미학**: 코드가 적을수록 좋은 코드
- **DRY 원칙**: 반복하지 말고 재사용
- **단일 책임**: 하나의 함수는 하나의 목적만
- **실용주의**: 완벽보다 실용, YAGNI 정신