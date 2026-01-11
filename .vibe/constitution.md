# Project Constitution

이 문서는 프로젝트의 핵심 원칙과 코딩 표준을 정의합니다.

---

## 언어 설정

**기본 언어**: 한국어 (ko)

변경하려면 `.sutory/config.json`에서 수정:
```json
{
  "language": "ko"  // "en"으로 변경 가능
}
```

---

## 1. 프로젝트 원칙

### 가치 (Values)
1. **사용자 중심**: 사용자 경험을 최우선으로
2. **품질**: 빠른 것보다 올바른 것
3. **간결함**: 복잡함보다 단순함
4. **협업**: 개인보다 팀

### 의사결정 기준
1. 보안 > 성능 > 편의성
2. 명확함 > 영리함
3. 테스트 가능 > 추상적 설계

---

## 2. 코딩 표준

### 공통 원칙
- **DRY**: Don't Repeat Yourself
- **SRP**: Single Responsibility Principle
- **YAGNI**: You Aren't Gonna Need It
- **함수 ≤30줄** (권장), ≤50줄 (허용)
- **Cyclomatic Complexity ≤10**
- **Cognitive Complexity ≤15**

### 네이밍 규칙
- 변수: 명사 (`userData`, `userList`)
- 함수: 동사+명사 (`fetchData`, `updateUser`)
- Boolean: `is/has/can` (`isLoading`, `hasError`)
- 상수: `UPPER_SNAKE_CASE` (`MAX_RETRY_COUNT`)

---

## 3. 품질 기준 (TRUST 5)

### T - Test-first
- ✅ Contract Testing (최우선)
- ✅ Integration Testing (70%+ 커버리지)
- 🔵 Unit Testing (순수 함수만)

### R - Readable
- 한국어 주석 및 docstring
- 명확한 변수명
- 복잡한 로직은 주석으로 설명

### U - Unified
- 일관된 코딩 스타일
- 프로젝트 전체 동일한 패턴

### S - Secured
- SQL Injection 방지
- XSS 방지
- 민감 정보 환경 변수로 관리

### T - Trackable
- Git commit 메시지 명확히
- TODO/FIXME 주석 활용
- 중요 결정사항 문서화

---

## 4. 기술 스택

### Backend
- Language: TypeScript/Node.js
- Framework: Express/Fastify
- Database: SQLite

### Frontend
- Framework: {Flutter / React / etc.}
- State Management: (프로젝트에 맞게 설정)

### Infrastructure
- Hosting: (프로젝트에 맞게 설정)
- CI/CD: (프로젝트에 맞게 설정)

---

## 5. Git 워크플로우

### 브랜치 전략
- `main`: 프로덕션
- `develop`: 개발 (기본 브랜치)
- `feature/{기능명}`: 새 기능
- `fix/{버그명}`: 버그 수정

### Commit 메시지 규칙
```
feat: 새 기능 추가
fix: 버그 수정
docs: 문서 수정
refactor: 리팩토링
test: 테스트 추가/수정
chore: 빌드, 설정 변경
```

### PR 규칙
1. SPEC 기반 개발
2. 코드 리뷰 필수
3. 테스트 통과 확인
4. SPEC 검증 완료

---

## 6. 코드 리뷰 기준

### 필수 체크
- [ ] SPEC 요구사항 충족
- [ ] TRUST 5 준수
- [ ] 테스트 작성 및 통과
- [ ] 문서화 완료
- [ ] 보안 이슈 없음

### 권장 사항
- [ ] 성능 최적화 고려
- [ ] 확장성 고려
- [ ] 에러 처리 완비

---

## 7. 문서화 규칙

### 코드 주석
- 모든 함수: 한국어 docstring
- 복잡한 로직: 인라인 주석
- TODO/FIXME: 이슈 번호 포함

### API 문서
- OpenAPI (Swagger) 자동 생성
- 예시 Request/Response 포함

### README
- 프로젝트 개요
- 설치 및 실행 방법
- 주요 기능 설명

---

## 8. 보안 정책

### 인증
- JWT 기반 인증
- Refresh 토큰 사용

### 권한
- Role-based Access Control
- 최소 권한 원칙

### 데이터 보호
- 개인정보 암호화
- HTTPS 필수
- 환경 변수로 비밀 관리

---

## 9. 성능 목표

### 응답 시간
- API: P95 < 500ms
- 웹페이지: FCP < 1.5s

### 가용성
- Uptime: 99.9%
- RTO: 1시간
- RPO: 15분
