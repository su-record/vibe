---
description: Analyze project or specific feature/module
argument-hint: "기능명" or --code or --deps or --arch (optional)
---

# /vibe.analyze

프로젝트 또는 특정 기능/모듈을 분석합니다.

## Usage

```
/vibe.analyze                  # 프로젝트 전체 품질 분석
/vibe.analyze "로그인"          # 로그인 관련 코드 탐색 + 컨텍스트 수집
/vibe.analyze --code           # 코드 품질 분석만
/vibe.analyze --deps           # 의존성 분석만
/vibe.analyze --arch           # 아키텍처 분석만
```

## ⚠️ 컨텍스트 리셋

**이 명령어가 실행되면 이전 대화 내용은 무시합니다.**
- 새 세션처럼 처음부터 코드를 탐색하고 분석
- 오직 이 분석에서 새로 수집한 정보만 기반으로 대화

---

## Mode 1: 기능/모듈 분석 (`/vibe.analyze "기능명"`)

### 목표

사용자가 요청한 기능/모듈과 관련된 **모든 소스코드를 탐색**하고 **플로우를 분석**하여:
1. 현재 구현 상태 파악
2. 코드 구조와 의존성 이해
3. 이후 개발/수정 요청에 즉시 대응 가능한 컨텍스트 확보

### Process

#### 1. 요청 분석

사용자 요청에서 핵심 키워드 추출:
- 기능명 (예: 로그인, 피드, 결제)
- 동작 (예: 작성, 조회, 수정, 삭제)
- 범위 (예: 백엔드만, 프론트엔드만, 전체)

#### 2. 프로젝트 구조 파악

`CLAUDE.md`, `package.json`, `pyproject.toml` 등을 읽어 기술 스택 확인:

**백엔드:**
- FastAPI/Django: `app/api/`, `app/services/`, `app/models/`
- Express/NestJS: `src/controllers/`, `src/services/`, `src/models/`

**프론트엔드:**
- React/Next.js: `src/components/`, `src/pages/`, `src/hooks/`
- Flutter: `lib/screens/`, `lib/services/`, `lib/providers/`

#### 3. 관련 코드 탐색

**탐색 전략:**
1. **Glob**으로 관련 파일 목록 수집
2. **Grep**으로 키워드 기반 코드 위치 파악
3. **Read**로 핵심 파일 상세 분석
4. 필요시 **Task (Explore)** 에이전트로 병렬 탐색

#### 4. 플로우 분석

**API 플로우:**
- 엔드포인트 URL 및 HTTP 메서드
- 요청/응답 스키마
- 인증/권한 요구사항

**비즈니스 로직:**
- 핵심 메서드와 역할
- 유효성 검증 규칙
- 외부 서비스 연동

**데이터 플로우:**
- 관련 테이블/모델
- 관계 (1:N, N:M)
- 주요 쿼리 패턴

#### 5. 분석 결과 출력

```markdown
## 📊 [기능명] 분석 결과

### 개요
- **기능 설명**: [한 줄 요약]
- **구현 상태**: [완료/진행중/미구현]
- **관련 파일 수**: N개

### 구조

#### API 엔드포인트
| 메서드 | 경로 | 설명 | 인증 |
|--------|------|------|------|
| POST | /api/v1/auth/login | 로그인 | - |

#### 핵심 서비스
- `auth_service.py`: 인증 로직
  - `login()`: 로그인 처리
  - `verify_token()`: 토큰 검증

#### 데이터 모델
- `User`: 사용자 테이블
  - 주요 필드: id, email, password_hash
  - 관계: Session (1:N)

### 플로우 다이어그램
[텍스트 기반 플로우 설명]

### 참고 파일 목록
- src/api/auth/router.py:L10-50
- src/services/auth_service.py:L1-100
```

#### 6. 개발 규칙 확인

`.vibe/rules/`에서 관련 규칙 로드:
- `core/quick-start.md` - 5가지 핵심 원칙
- `standards/complexity-metrics.md` - 복잡도 기준
- `quality/checklist.md` - 품질 체크리스트

규칙 위반 사항이 있으면 함께 출력.

#### 7. 완료

분석 완료 후:
1. 분석 결과 요약 출력
2. "이제 어떤 작업을 도와드릴까요?" 질문
3. 이후 개발/수정 요청에 수집된 컨텍스트 활용

---

## Mode 2: 프로젝트 품질 분석 (옵션 없음 또는 --code/--deps/--arch)

### 분석 범위

- **기본** (`/vibe.analyze`): 전체 분석 (코드 + 의존성 + 아키텍처)
- **--code**: 코드 품질 분석만
- **--deps**: 의존성 분석만
- **--arch**: 아키텍처 분석만

### MCP 도구 사용

`@su-record/hi-ai` 기반:

#### 코드 품질 분석 (--code)
- `analyze_complexity`: 복잡도 분석
- `validate_code_quality`: 코드 품질 검증
- `check_coupling_cohesion`: 결합도/응집도 체크

#### 의존성 분석 (--deps)
- `package.json` / `pyproject.toml` / `pubspec.yaml` 읽기
- 버전 충돌, 보안 취약점, 업데이트 필요 패키지 분석

#### 아키텍처 분석 (--arch)
- `find_symbol`: 핵심 모듈 찾기
- `find_references`: 모듈 간 의존성 파악
- 순환 의존성, 레이어 위반 검출

### 분석 리포트

`.vibe/reports/analysis-{date}.md`:

```markdown
# 프로젝트 분석 리포트

## 개요
- 분석 일시: 2025-01-06 12:00
- 분석 범위: 전체

## 코드 품질 (85/100)
- 평균 복잡도: 8.2 (양호)
- 높은 복잡도 파일: 3개

## 의존성 (92/100)
- 총 패키지: 42개
- 업데이트 필요: 3개

## 아키텍처 (78/100)
- 순환 의존성: 2개 발견
- 레이어 위반: 1개

## 개선 제안
1. service.py 리팩토링
2. lodash 보안 패치 적용
```

---

## Example

### 기능 분석
```
User: /vibe.analyze "로그인"

Claude: 로그인 관련 코드를 분석합니다...

[Glob, Grep, Read 도구로 코드 탐색]

📊 로그인 분석 결과

### 개요
- 기능 설명: JWT 기반 사용자 인증
- 구현 상태: 완료
- 관련 파일: 8개

### API 엔드포인트
| POST | /api/v1/auth/login | 로그인 | - |
| POST | /api/v1/auth/refresh | 토큰 갱신 | Required |

[분석 계속...]

이제 어떤 작업을 도와드릴까요?
- 리팩토링
- 신규 기능 추가
- 버그 수정
```

### 품질 분석
```
User: /vibe.analyze --code

Claude: 코드 품질 분석을 시작합니다...

📊 코드 품질 점수: 85/100 (B+)

**주요 발견사항:**
- 높은 복잡도: src/service.py (CC: 15)

**개선 제안:**
1. src/service.py를 3개 모듈로 분리
```
