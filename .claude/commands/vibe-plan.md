# /vibe.plan

PLAN 문서를 작성합니다 (Planning Agent).

## Usage

```
/vibe.plan "기능명"
```

## Description

SPEC 문서를 분석하여 기술 구현 계획(PLAN)을 작성합니다.

## Process

1. **SPEC 문서 읽기**: `.vibe/specs/{기능명}.md` 분석
2. **프로젝트 컨텍스트 파악**:
   - `CLAUDE.md` 읽기 (기술 스택 확인)
   - `package.json` / `pyproject.toml` / `pubspec.yaml` 확인
3. **PLAN 문서 작성**: 15개 섹션 포함
   - 기술 스택 선정 (기존 스택 재사용 우선)
   - 아키텍처 설계
   - API 설계
   - DB 스키마
   - 외부 서비스 통합
   - 보안 설계
   - 성능 최적화
   - 에러 처리
   - 모니터링 및 로깅
   - 테스트 전략
   - 배포 전략
   - 비용 예측
   - 마일스톤 (Phase별)
   - 리스크 및 완화 방안
   - 다음 단계
4. **품질 검증**: 기술 선택 근거, 비용, 일정 현실성

## Agent

`~/.vibe/agents/planning-agent.md`

## Input

- `.vibe/specs/{기능명}.md` (SPEC 문서)
- `CLAUDE.md` (프로젝트 기술 스택)

## Output

- `.vibe/plans/{기능명}.md` - PLAN 문서
- 예상 공수 (시간/일)
- 예상 비용 ($)
- Phase별 마일스톤

## Example

```
/vibe.plan "푸시 알림 설정 기능"
```

**결과:**
- 3 Phases (Backend → Frontend → FCM)
- 24시간 (3일)
- $0.50/월 추가 비용

## Next Step

```
/vibe.tasks "푸시 알림 설정 기능"
```
