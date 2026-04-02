---
name: vibe-figma-consolidate
description: Step D — 모바일/PC 스타일 공통화, 컴포넌트 통합, 최종 검증
triggers: []
tier: standard
---

# Skill: vibe-figma-consolidate — Step C: 최종 공통화 리팩토링

> **⛔ 실행 지시: Edit 도구로 기존 파일을 실제 수정한다.**
> - 토큰 통합: Edit으로 _tokens.scss 수정
> - 중복 제거: Edit으로 중복 스타일/코드 통합
> - variant 통합: Edit으로 유사 컴포넌트 합침
> 분석만 보여주고 끝내면 안 됨.

## D-1. 스타일 공통화

```
1. 모바일/PC에서 동일한 값 → 공통 토큰으로 추출
2. 중복 CSS/SCSS 규칙 통합
3. 컴포넌트 내 중복 로직 제거
```

### 공통화 우선순위

| 유형 | 처리 방법 |
|------|----------|
| 색상 (모바일/PC 동일) | 공통 CSS custom property로 추출 |
| 타이포그래피 (동일 scale) | 공통 토큰 유지 |
| 간격 (다름) | clamp() fluid 토큰으로 변환 |
| 레이아웃 방향 (다름) | @media 분기 유지 |
| 컴포넌트 구조 (동일) | 하나의 컴포넌트로 통합 |

## D-2. 컴포넌트 통합

```
1. 유사 컴포넌트 (80% rule) → variant prop으로 통합
2. 중복 sub-component → 공유 컴포넌트로 추출
3. Fragment/template 활용하여 불필요한 래퍼 제거
```

### 80% Rule 적용 기준

```
유사도 판단 기준:
  - 레이아웃 구조 동일
  - 색상/크기/텍스트만 다름
  → 하나의 컴포넌트 + props로 변형

  - 구조 자체가 다름 (요소 추가/제거, 레이아웃 방향 변경)
  → 별도 컴포넌트 유지
```

| Stack | 변형 방법 |
|-------|----------|
| React | `variant` prop + 조건부 className / style |
| Vue | `variant` prop + `<slot>` for 커스텀 영역 |
| Svelte | `variant` prop + `<slot>` |
| React Native | `variant` prop + StyleSheet 조건 선택 |

### 통합 예시 (React)

```tsx
// 통합 전: 별도 컴포넌트 (구조 동일, 색상만 다름)
<DefaultCard />
<HighlightCard />
<CompactCard />

// 통합 후: 단일 컴포넌트 + variant
interface CardProps {
  variant: 'default' | 'highlight' | 'compact';
  title: string;
  children: React.ReactNode;
}

export function Card({ variant, title, children }: CardProps): JSX.Element {
  return (
    <article className={styles[variant]}>
      <h3 className={styles.title}>{title}</h3>
      {children}
    </article>
  );
}
```

### 불필요한 래퍼 제거

```tsx
// WRONG: 스타일 없는 불필요한 div 래핑
<div>
  <ComponentA />
  <ComponentB />
</div>

// CORRECT: Fragment
<>
  <ComponentA />
  <ComponentB />
</>
```

## D-3. 최종 검증 루프

```
🔄 양쪽 뷰포트 동시 검증:
  - 모바일 Figma vs 코드 (mobile viewport)
  - PC Figma vs 코드 (desktop viewport)
  - 양쪽 모두 P1=0, Match Score 95%+
  - 이미지 에셋 전부 정상 표시
```

### 검증 완료 조건

```
✅ Match Score 95% 이상 (모바일 + 데스크탑 각각)
✅ P1 불일치 0건
✅ 모든 이미지 에셋 표시 확인
✅ 공통 토큰으로 중복 제거 완료
```

### Model Routing (Step D)

| 작업 | 모델 |
|------|------|
| 공통화 리팩토링 + 최종 검증 | **Sonnet** |
| Post — 코드 리뷰 | **gpt-5.3-codex** |

### Post — 코드 리뷰 (Codex 설치 시)

```
/codex:review (gpt-5.3-codex)
생성된 코드의 design fidelity + 코드 품질 크로스 검증

Codex 미설치 시 자동 스킵.
```

Step D 완료 후 → vibe-figma-pipeline 실행.
