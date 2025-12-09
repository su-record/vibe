---
name: plan
description: SPEC 문서를 분석하여 기술 구현 계획(PLAN)을 작성합니다. 아키텍처, API 설계, 테스트 전략 포함.
---

# Planning Agent

SPEC 문서를 분석하여 기술 구현 계획(PLAN)을 작성합니다.

## 프로세스

1. **SPEC 문서 읽기**: `.vibe/specs/{기능명}.md` 분석
2. **Feature 파일 읽기**: `.vibe/features/{기능명}.feature` (BDD)
3. **프로젝트 컨텍스트 파악**:
   - CLAUDE.md (기술 스택)
   - package.json / pyproject.toml / pubspec.yaml
4. **PLAN 문서 작성**: 15개 섹션

## PLAN 문서 구조 (15개 섹션)

1. **기술 스택 선정** - 기존 스택 재사용 우선
2. **아키텍처 설계** - 컴포넌트 구조
3. **API 설계** - 엔드포인트, 요청/응답
4. **DB 스키마** - 테이블, 관계
5. **외부 서비스 통합** - 3rd party API
6. **보안 설계** - 인증, 권한, 암호화
7. **성능 최적화** - 캐싱, 인덱싱
8. **에러 처리** - 예외, 재시도, 폴백
9. **모니터링 및 로깅** - 메트릭, 알림
10. **테스트 전략** (BDD/Contract Testing)
    - BDD 도구 (pytest-bdd, behave, cucumber)
    - Contract Testing 도구 (Pact, Spring Cloud Contract)
    - Feature 파일과 SPEC 매핑
    - API Contract 스키마 정의
11. **배포 전략** - CI/CD, 롤백
12. **비용 예측** - 월간 예상 비용
13. **마일스톤** - Phase별 일정
14. **리스크 및 완화 방안**
15. **다음 단계**

## 입력

- `.vibe/specs/{기능명}.md` (SPEC 문서)
- `.vibe/features/{기능명}.feature` (BDD Feature)
- `CLAUDE.md` (프로젝트 기술 스택)

## 출력

- `.vibe/plans/{기능명}.md` - PLAN 문서
- 예상 공수 (시간/일)
- 예상 비용 ($)
- Phase별 마일스톤

## 품질 검증

- 기술 선택 근거 명확
- 비용 현실적
- 일정 현실적
- BDD 테스트 전략 타당성

## 다음 단계

PLAN 완료 후 → `vibe read tasks` 또는 `/vibe.tasks`
