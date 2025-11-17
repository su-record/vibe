# /vide.analyze

프로젝트를 분석합니다 (코드 품질, 아키텍처, 의존성).

## Usage

```
/vide.analyze
/vide.analyze --code
/vide.analyze --deps
/vide.analyze --arch
```

## Process

### 1. 분석 범위 확인

사용자가 지정한 옵션에 따라 분석 범위를 결정합니다:

- **기본** (`/vide.analyze`): 전체 분석 (코드 + 의존성 + 아키텍처)
- **--code**: 코드 품질 분석만
- **--deps**: 의존성 분석만
- **--arch**: 아키텍처 분석만

### 2. MCP 도구 사용

다음 MCP 도구를 사용합니다 (`@su-record/hi-ai` 기반):

#### 코드 품질 분석 (--code)
- `mcp__su-record-hi-ai__analyze_complexity`: 복잡도 분석
- `mcp__su-record-hi-ai__validate_code_quality`: 코드 품질 검증
- `mcp__su-record-hi-ai__check_coupling_cohesion`: 결합도/응집도 체크

#### 의존성 분석 (--deps)
- `package.json` / `pyproject.toml` / `pubspec.yaml` 읽기
- 버전 충돌, 보안 취약점, 업데이트 필요 패키지 분석

#### 아키텍처 분석 (--arch)
- `mcp__su-record-hi-ai__find_symbol`: 핵심 모듈 찾기
- `mcp__su-record-hi-ai__find_references`: 모듈 간 의존성 파악
- 순환 의존성, 레이어 위반 검출

### 3. 분석 리포트 생성

`.vide/reports/analysis-{date}.md` 파일에 분석 결과 저장:

```markdown
# 프로젝트 분석 리포트

## 개요
- 분석 일시: 2025-11-17 15:30
- 분석 범위: 전체 (코드 + 의존성 + 아키텍처)

## 코드 품질 (85/100)
- 평균 복잡도: 8.2 (양호)
- 높은 복잡도 파일: 3개
  - src/service.py (CC: 15)
  - src/utils.py (CC: 12)

## 의존성 (92/100)
- 총 패키지: 42개
- 업데이트 필요: 3개
  - express: 4.17.1 → 4.18.2
  - lodash: 4.17.20 → 4.17.21 (보안)

## 아키텍처 (78/100)
- 순환 의존성: 2개 발견
  - A → B → C → A
- 레이어 위반: 1개
  - Controller가 직접 DB 접근

## 개선 제안
1. service.py 리팩토링 (복잡도 15 → 10 이하)
2. lodash 보안 패치 적용
3. 순환 의존성 제거
```

### 4. 개선 제안

분석 결과를 바탕으로 구체적인 개선 방안 제시:
- 리팩토링이 필요한 파일 목록
- 의존성 업데이트 명령어
- 아키텍처 개선 방향

## Example

```
User: /vide.analyze --code

Claude: 코드 품질 분석을 시작합니다...

[MCP 도구 사용]
- analyze_complexity 실행 중...
- validate_code_quality 실행 중...
- check_coupling_cohesion 실행 중...

✅ 분석 완료!

📊 코드 품질 점수: 85/100 (B+)

**주요 발견사항:**
- 높은 복잡도: src/service.py (CC: 15)
- 낮은 응집도: src/utils.py (응집도: 0.3)
- 강한 결합: Controller ↔ Service (결합도: 0.8)

**개선 제안:**
1. src/service.py를 3개 모듈로 분리
2. src/utils.py의 관련 없는 함수 분리
3. Dependency Injection 패턴 도입

상세 리포트: .vide/reports/analysis-2025-11-17.md
```

## Notes

- MCP 서버(`@su-record/hi-ai`)가 설치되어 있어야 합니다
- 대규모 프로젝트는 분석에 시간이 걸릴 수 있습니다 (1-5분)
- 분석 결과는 `.vide/reports/` 폴더에 저장됩니다
