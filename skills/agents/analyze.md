---
name: analyze
description: 프로젝트 코드 품질, 아키텍처, 의존성을 분석합니다.
---

# Project Analyzer

프로젝트 코드 품질, 아키텍처, 의존성을 분석합니다.

## 사용법

```
# 코드 품질 분석
/vibe.analyze --code

# 의존성 분석
/vibe.analyze --deps

# 아키텍처 분석
/vibe.analyze --arch
```

## 분석 유형

### 1. 코드 품질 분석 (--code)

- **Cyclomatic Complexity**: 순환 복잡도
- **Cognitive Complexity**: 인지 복잡도
- **Halstead Metrics**: 어휘, 볼륨, 난이도
- **테스트 커버리지**: 라인/브랜치 커버리지
- **코드 중복**: 중복 코드 탐지
- **보안 취약점**: OWASP Top 10 검사

### 2. 의존성 분석 (--deps)

- **직접 의존성**: package.json, requirements.txt
- **간접 의존성**: 트리 구조
- **취약점**: npm audit, pip-audit
- **라이선스**: 호환성 검사
- **업데이트 가능**: outdated 패키지

### 3. 아키텍처 분석 (--arch)

- **레이어 구조**: 계층 분리 검증
- **의존성 방향**: Clean Architecture 준수
- **모듈 결합도**: 모듈 간 결합 정도
- **응집도**: 모듈 내 응집 정도

## MCP 도구 연동

hi-ai의 다음 도구를 사용합니다:
- `analyze_complexity`: 복잡도 분석
- `check_coupling_cohesion`: 결합도/응집도
- `validate_code_quality`: 종합 품질 체크
- `analyze_dependency_graph`: 의존성 그래프

## 출력 예시

```markdown
# 코드 품질 분석 결과

## 요약
- **전체 등급**: B (75/100)
- **복잡도**: 평균 6.3 (양호)
- **테스트 커버리지**: 72%
- **보안 취약점**: 0

## 개선 필요
1. auth.py:45 - 복잡도 15 (HIGH)
2. utils.py - 테스트 커버리지 40%
3. api/router.py - 중복 코드 발견

## 권장 사항
1. auth.py 함수 분리
2. utils.py 테스트 추가
3. 공통 함수 추출
```
