---
name: verify
description: SPEC 요구사항 대비 구현 완료 여부를 검증합니다. BDD 테스트 및 Contract 검증 포함.
---

# Quality Reviewer

SPEC 요구사항 대비 구현 완료 여부를 검증합니다.

## 프로세스

1. **SPEC 문서 읽기**: `.vibe/specs/{기능명}.md`
2. **Feature 파일 읽기**: `.vibe/features/{기능명}.feature`
3. **구현 코드 분석**
4. **검증 수행**:
   - 요구사항 커버리지
   - Acceptance Criteria 충족
   - BDD 시나리오 통과
   - Contract 테스트 통과
5. **보고서 생성**

## 검증 항목

### 1. 요구사항 커버리지

```markdown
| REQ ID | 요구사항 | 구현 파일 | 상태 |
|--------|----------|-----------|------|
| REQ-001 | 로그인 | auth.py:45 | ✅ |
| REQ-002 | 알림 | notification.py:23 | ✅ |
| REQ-003 | 설정 | - | ❌ 미구현 |
```

### 2. Acceptance Criteria

```markdown
### REQ-001 Acceptance Criteria
- [x] JWT 토큰 발급
- [x] 토큰 만료 처리
- [ ] 리프레시 토큰 (미구현)
```

### 3. BDD 시나리오

```markdown
## Feature: 사용자 인증
- ✅ Scenario: 성공적인 로그인
- ✅ Scenario: 잘못된 비밀번호
- ❌ Scenario: 계정 잠금 (미구현)
```

### 4. Contract 테스트

```markdown
## API Contracts
- ✅ POST /auth/login: Provider verified
- ✅ GET /users/me: Consumer verified
- ⚠️ PUT /users/settings: Schema mismatch
```

## 품질 메트릭

- **테스트 커버리지**: 80%+
- **코드 복잡도**: Cyclomatic < 10
- **린트 오류**: 0
- **보안 취약점**: 0

## 출력

```markdown
# 검증 보고서: {기능명}

## 요약
- **전체 요구사항**: 10개
- **구현 완료**: 8개 (80%)
- **BDD 시나리오**: 15/18 통과
- **Contract 테스트**: 5/5 통과

## 미완료 항목
1. REQ-003: 설정 페이지
2. Scenario: 계정 잠금

## 권장 사항
1. REQ-003 구현 필요
2. 테스트 커버리지 75% → 80% 개선 필요

## 결론
**상태**: 🟡 부분 완료
**다음 단계**: 미완료 항목 구현 후 재검증
```

## 다음 단계

- 검증 통과 → 배포 준비
- 미완료 항목 → `/vibe.run`으로 추가 구현
