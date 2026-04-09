# Docs Team

API 문서, 아키텍처 다이어그램, 변경로그를 통합 생성하는 문서화 팀.

## 팀 구성

| 팀원 | 역할 | Model |
|------|------|-------|
| architect (리더) | 프로젝트 구조 분석, 문서 범위 조율, 최종 통합 | Sonnet |
| api-documenter | API 엔드포인트 추출 및 문서화 | Haiku |
| changelog-writer | git diff → 구조화된 변경로그 생성 | Haiku |
| diagrammer | 아키텍처/ERD/플로우 다이어그램 생성 | Haiku |

## 활성화 조건

- `/vibe.docs` 실행 시
- 릴리스 준비 시 수동 트리거

## 워크플로우

```
architect: 프로젝트 구조 분석, 문서화 범위 결정
    |
    ├──→ api-documenter: 엔드포인트 스캔 → API 레퍼런스 (병렬)
    ├──→ changelog-writer: git log 분석 → 변경로그 (병렬)
    └──→ diagrammer: 아키텍처 + 데이터 플로우 다이어그램 (병렬)
         |
    [SendMessage로 교차 참조]
         |
    architect: 모든 출력 통합 → 일관성 검증 → 최종 문서 패키지
```

## spawn 패턴

```text
TeamCreate(team_name="docs-{project}", description="Documentation team for {project}")

Task(team_name="docs-{project}", name="architect", subagent_type="architect",
  prompt="문서화 팀 리더. 프로젝트 구조를 분석하고 문서 범위를 결정하세요.
  프로젝트: {project_path}
  범위: {scope}
  역할: 문서화 범위 조율, 팀원에게 각 영역 할당, 최종 통합.
  api-documenter, changelog-writer, diagrammer에게 SendMessage로 작업을 할당하세요.
  모든 결과를 받으면 교차 참조를 확인하고 통합 문서를 작성하세요.")

Task(team_name="docs-{project}", name="api-documenter", subagent_type="api-documenter",
  prompt="문서화 팀 API 담당. 프로젝트: {project_path}
  역할: routes/controllers 스캔, 엔드포인트 추출, request/response 스키마 문서화.
  미문서화 엔드포인트를 식별하세요. 완료 후 architect에게 SendMessage로 전달하세요.")

Task(team_name="docs-{project}", name="changelog-writer", subagent_type="changelog-writer",
  prompt="문서화 팀 변경로그 담당. 프로젝트: {project_path}
  역할: git diff 분석, breaking/feature/fix/refactor 분류, semantic version 제안.
  breaking change 발견 시 architect에게 SendMessage로 알리세요.
  완료 후 architect에게 결과를 전달하세요.")

Task(team_name="docs-{project}", name="diagrammer", subagent_type="diagrammer",
  prompt="문서화 팀 다이어그램 담당. 프로젝트: {project_path}
  역할: 아키텍처 다이어그램 + ERD + 주요 플로우 차트 생성 (Mermaid).
  api-documenter의 결과를 참조하여 API 플로우를 시각화하세요.
  완료 후 architect에게 SendMessage로 전달하세요.")
```

## 팀원 간 통신

```text
architect → api-documenter: "src/api/ 디렉토리의 모든 엔드포인트를 문서화하세요"
architect → changelog-writer: "v2.8.53..HEAD 범위의 변경로그를 생성하세요"
architect → diagrammer: "전체 아키텍처 + DB ERD + 인증 플로우 다이어그램 요청합니다"
changelog-writer → architect: "breaking change 2건 발견: auth API 시그니처 변경, config 스키마 변경"
api-documenter → diagrammer: "엔드포인트 목록 공유합니다. API 플로우 다이어그램에 반영해주세요"
architect → broadcast: "문서 통합 완료. README + API ref + 아키텍처 + 변경로그 생성됨"
```

## ⛔ 하지 않는 것

- 코드 수정 (문서 생성만)
- 프로젝트 구조 변경
- 불확실한 정보 추측 (코드에서 확인 불가하면 표시)
- README 이외 파일 자동 커밋 (사용자 확인 후)
