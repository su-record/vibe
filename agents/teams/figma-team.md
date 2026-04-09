# Figma Team

Figma 디자인 → 프로덕션 코드 변환 파이프라인 팀.

## 팀 구성

| 팀원 | 역할 | Model |
|------|------|-------|
| figma-analyst (리더) | Figma 트리 분석, 디자인 의도 해석, 공유 패턴 발견 | Opus |
| figma-architect | sections.json → component-spec.json 컴포넌트 설계 | Sonnet |
| figma-builder | component-spec + SCSS → 코드 조립, 섹션별 순차 구현 | Sonnet |
| figma-auditor | 컴파일 게이트 + 시각 검증, 코드 수정 안 함 리포트만 | Sonnet |

## 활성화 조건

- `/vibe.figma` 또는 `/vibe.figma.convert` 실행 시
- Figma URL 또는 트리 데이터 제공 시

## 워크플로우

```
figma-analyst: Figma REST API → 트리 추출 + 스크린샷
    |
figma-architect: sections.json → component-spec.json (이미지 분류 포함)
    |
figma-builder: 섹션별 순차 구현
    │   각 섹션마다:
    │   1. figma-to-scss.js → SCSS 골격
    │   2. component-spec에서 설계 Read
    │   3. HTML 템플릿 작성
    │   4. figma-validate.js → 대조
    │       ├─ PASS → 다음 섹션
    │       └─ FAIL → 수정 → 재검증
    |
figma-auditor: Phase 5 컴파일 게이트 + Phase 6 시각 검증
    │   FAIL → 리포트 → builder 수정 → 재검증
    │   P1=0 → 완료
```

## spawn 패턴

```text
TeamCreate(team_name="figma-{feature}", description="Figma-to-code team for {feature}")

Task(team_name="figma-{feature}", name="analyst", subagent_type="figma-analyst",
  prompt="Figma 팀 리더. 디자인 트리를 분석하고 전체 구조를 파악하세요.
  Figma URL: {figma_url}
  역할: 트리 추출, 디자인 의도 해석, 공유 패턴 발견.
  분석 완료 후 architect에게 SendMessage로 sections.json 전달.")

Task(team_name="figma-{feature}", name="architect", subagent_type="figma-architect",
  prompt="Figma 팀 설계 담당. sections.json → component-spec.json 작성.
  역할: 컴포넌트 트리 설계, Props/Slots 정의, 이미지 분류.
  설계 완료 후 builder에게 SendMessage로 전달.")

Task(team_name="figma-{feature}", name="builder", subagent_type="figma-builder",
  mode="bypassPermissions",
  prompt="Figma 팀 구현 담당. component-spec + SCSS → 코드 조립.
  규칙: SCSS CSS 값 수정 금지, 설계서대로 구현.
  각 섹션 완료 후 auditor에게 SendMessage로 검증 요청.")

Task(team_name="figma-{feature}", name="auditor", subagent_type="figma-auditor",
  prompt="Figma 팀 검증 담당. 코드 직접 수정 안 함, 리포트만.
  Phase 5: 컴파일 게이트 (tsc + build).
  Phase 6: 시각 검증 (렌더링 vs 스크린샷).
  P1 발견 시 builder에게 SendMessage로 수정 요청.")
```

## 팀원 간 통신

```text
analyst → architect: "sections.json 준비 완료. 반복 INSTANCE 5개 발견 — 공유 컴포넌트 후보"
architect → builder: "component-spec.json 작성 완료. HeroSection부터 시작하세요"
builder → auditor: "HeroSection 구현 완료. 검증 요청합니다"
auditor → builder: "P1: padding 불일치 (expected 48px, actual 2rem). SCSS 원본값 사용하세요"
builder → auditor: "수정 완료. 재검증 요청합니다"
auditor → broadcast: "P1=0. 전체 검증 통과"
```

## ⛔ 하지 않는 것

- auditor가 코드 직접 수정 (리포트만)
- builder가 SCSS CSS 값 수정 (figma-to-scss.js 출력 그대로)
- builder가 vw 변환, clamp, @media 사용 (스태틱 구현)
- architect가 코드 파일 생성 (설계서만)
