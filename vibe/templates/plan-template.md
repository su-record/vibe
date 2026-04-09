# PLAN: {Project or Feature Name}

## Metadata

- **Created**: {YYYY-MM-DD}
- **Author**: {Name}
- **Status**: DRAFT
- **Type**: {website | webapp | mobile | api | feature | library}
- **Language**: {ko | en}
- **Downstream**: {spec | figma | both}

---

## 1. 개요 (Overview)

> 한 줄 요약 — "무엇"인지 비전공자도 이해할 수 있게.

{One-line summary}

---

## 2. 배경 (Why)

**왜 만드는가?**

{Motivation, problem being solved}

**왜 지금인가?**

{Trigger — what changed, new opportunity, user pain}

---

## 3. 타깃 사용자 (Who)

**주요 사용자**

- {Persona 1}: {상황, 니즈}
- {Persona 2}: {상황, 니즈}

**사용 맥락**

- 언제: {when}
- 어디서: {where}
- 어떤 디바이스로: {device}

---

## 4. 목표 & 성공 기준 (Goals)

**달성하려는 것**

- {Goal 1}
- {Goal 2}

**성공 지표 (측정 가능)**

| 지표 | 현재 | 목표 | 측정 방법 |
|-----|-----|-----|---------|
| {Metric 1} | {baseline} | {target} | {how} |

---

## 5. 핵심 기능/섹션 (What)

**기능/섹션 리스트 (우선순위)**

| 우선순위 | 항목 | 설명 |
|--------|-----|-----|
| Must | {Item 1} | {description} |
| Must | {Item 2} | {description} |
| Should | {Item 3} | {description} |
| Could | {Item 4} | {description} |

---

## 6. 범위 (Scope)

**이번 버전 포함**

- {In-scope item 1}
- {In-scope item 2}

**제외 (Non-goals)**

- {Out-of-scope item 1}
- {Out-of-scope item 2}

---

## 7. Look & Feel

> **UI 프로젝트에서만 작성.** API/라이브러리면 이 섹션 생략.

**분위기/톤**

- {e.g., "미니멀·시네마틱", "친근·유쾌"}

**컬러 방향**

- {e.g., "다크 + 네온 액센트", "파스텔 따뜻한 톤"}

**타이포그래피**

- {e.g., "Serif 헤드라인 + Sans 본문"}

**레퍼런스**

- {URL or 이미지 경로 1}: {무엇을 참고}
- {URL or 이미지 경로 2}: {무엇을 참고}

**애니메이션/인터랙션**

- {e.g., "스크롤 기반 패럴랙스", "호버 시 부드러운 스케일"}

---

## 8. 레이아웃/섹션 구성

> **UI 프로젝트에서만 작성.**

| 순서 | 섹션 | 목적 | 핵심 콘텐츠 |
|-----|-----|-----|-----------|
| 1 | Hero | 첫인상, 브랜드 임팩트 | 타이틀, 서브카피, CTA |
| 2 | {Section} | {purpose} | {content} |
| 3 | {Section} | {purpose} | {content} |

---

## 9. 반응형 전략

> **UI 프로젝트에서만 작성.**

**디바이스 우선순위**

- {e.g., "Desktop first — 주 사용자는 PC", "Mobile first — SNS 유입"}

**브레이크포인트**

- Mobile: {width}
- Tablet: {width}
- Desktop: {width}

---

## 10. 기술 스택 & 제약

**선호 스택**

- Frontend: {framework}
- Backend: {framework}
- DB: {database}
- Hosting: {platform}

**제약사항**

- 성능: {e.g., "LCP < 2.5s"}
- 브라우저: {e.g., "최신 2버전"}
- 접근성: {e.g., "WCAG AA"}
- 예산: {e.g., "월 $0 (free tier)"}

---

## 11. 가정 & 리스크

**가정한 것**

| # | 가정 | 검증 방법 | 틀렸을 때 리스크 |
|---|-----|---------|--------------|
| 1 | {assumption} | {how to validate} | {risk} |

**알려진 리스크**

- {Risk 1}: {mitigation}
- {Risk 2}: {mitigation}

---

## 12. 다음 단계 (Handoff)

이 기획서로 아래 워크플로를 시작할 수 있습니다:

| 커맨드 | 결과물 |
|-------|------|
| `/vibe.spec "{feature}"` | AI 구현용 코드 명세 → `/vibe.run`으로 기능 구현 |
| `/vibe.figma` | Figma 디자인 → 프로덕션 UI 코드 |
| 두 가지 병렬 실행 | 기능 + 디자인 → 웹사이트 프로토타입 |

**권장 순서**

1. `/vibe.spec "{feature}"` → 기능 구조 + API + 데이터 모델 확정
2. `/vibe.figma` (스토리보드 Phase에서 이 기획서를 참고) → 비주얼 디자인
3. `/vibe.run "{feature}"` → 구현
4. 통합 검증 → 프로토타입 완성
