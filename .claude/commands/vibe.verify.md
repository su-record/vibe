---
description: Verify implementation against SPEC requirements
argument-hint: "feature name"
---

# /vibe.verify

Feature 시나리오 기반으로 구현을 검증합니다.

## Usage

```
/vibe.verify "기능명"
```

## Rules Reference

**반드시 `.vibe/rules/` 규칙을 따릅니다:**
- `quality/checklist.md` - 코드 품질 체크리스트
- `standards/complexity-metrics.md` - 복잡도 기준

## Process

### 1. Feature 파일 로드

`.vibe/features/{기능명}.feature` 읽기

### 2. 시나리오별 검증

각 Scenario에 대해:

1. **Given** (전제 조건) - 상태 확인
2. **When** (행동) - 기능 실행
3. **Then** (결과) - 예상 결과 검증

### 3. 검증 방법

**코드 검증:**
- 해당 기능이 구현되어 있는지 확인
- Given/When/Then 각 단계가 동작하는지 확인

**테스트 실행 (있는 경우):**
- `npm test`, `pytest`, `flutter test` 등 실행
- BDD 테스트 프레임워크 결과 확인

**수동 검증:**
- 테스트 코드가 없으면 코드 리뷰로 검증
- 각 시나리오의 로직이 구현되었는지 확인

### 4. 결과 리포트

```markdown
# Verification Report: {기능명}

## Summary
- **총 시나리오**: N개
- **통과**: N개 ✅
- **실패**: N개 ❌
- **품질 점수**: XX/100

## Scenario Results

### ✅ Scenario 1: {제목}
- Given: 확인됨
- When: 구현됨
- Then: 동작함
- **검증**: AC-1 충족

### ❌ Scenario 2: {제목}
- Given: 확인됨
- When: 구현됨
- Then: **실패** - {이유}
- **수정 필요**: {구체적 내용}

## Code Quality
- 복잡도: ✅ 적정
- 테스트 커버리지: XX%
- 에러 처리: ✅

## Next Steps
- {실패한 시나리오 수정 방법}
```

## Input

- `.vibe/features/{기능명}.feature` - BDD 시나리오
- `.vibe/specs/{기능명}.md` - SPEC 문서 (참조)
- 구현된 소스 코드

## Output

- 검증 결과 리포트 (터미널 출력)
- 통과/실패 시나리오 목록
- 수정이 필요한 항목

## Example

```
User: /vibe.verify "로그인"

Claude:
# Verification Report: 로그인

## Summary
- **총 시나리오**: 4개
- **통과**: 3개 ✅
- **실패**: 1개 ❌
- **품질 점수**: 85/100

## Scenario Results

### ✅ Scenario 1: 유효한 자격증명으로 로그인
- Given: 사용자가 로그인 페이지에 있다 → ✅ LoginPage 컴포넌트 존재
- When: 유효한 이메일/비밀번호 입력 → ✅ handleSubmit 구현됨
- Then: 대시보드로 이동 → ✅ router.push('/dashboard')

### ✅ Scenario 2: 잘못된 비밀번호로 로그인 시도
- Given: 로그인 페이지 → ✅
- When: 잘못된 비밀번호 → ✅
- Then: 에러 메시지 표시 → ✅ "비밀번호가 일치하지 않습니다"

### ✅ Scenario 3: 이메일 형식 검증
- Given: 로그인 페이지 → ✅
- When: 잘못된 이메일 형식 → ✅
- Then: 유효성 에러 → ✅ zod validation

### ❌ Scenario 4: 비밀번호 찾기 링크
- Given: 로그인 페이지 → ✅
- When: "비밀번호 찾기" 클릭 → ❌ 링크 없음
- Then: 비밀번호 찾기 페이지로 이동 → ❌

## Next Steps
Scenario 4 수정 필요:
- LoginPage에 "비밀번호 찾기" 링크 추가
- /forgot-password 라우트 구현
```

## Next Step

검증 통과 시:
```
완료! 다음 기능을 진행하세요.
```

검증 실패 시:
```
/vibe.run "기능명" --fix  # 실패한 시나리오 수정
```
