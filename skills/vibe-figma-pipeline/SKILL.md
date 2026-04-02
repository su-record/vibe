---
name: vibe-figma-pipeline
description: Figma to Code 완료 후 Design Quality Pipeline 안내
triggers: []
tier: standard
---

# Skill: vibe-figma-pipeline — Design Quality Pipeline

코드 생성 완료 후, 다음 파이프라인을 사용자에게 제시한다.

## Pre-requisite check

If `.claude/vibe/design-context.json` does NOT exist:
```
⚠️ 디자인 컨텍스트가 없습니다. /design-teach 를 먼저 실행하면
   브랜드, 접근성, 타겟 디바이스에 맞춘 더 정확한 코드를 생성할 수 있습니다.
```

## Quick (default recommendation)

```
/design-normalize → /design-audit
```

- Normalize: 하드코딩 값 → MASTER.md 토큰으로 치환
- Audit: A11Y + 성능 + 반응형 + AI Slop 검출

## Thorough (recommended for production)

```
/design-normalize → /design-audit → /design-critique → /design-polish
```

- + Critique: Nielsen 10 휴리스틱 + 5 페르소나 분석
- + Polish: 인터랙션 상태 보완 (hover/focus/loading/error)

## Output format

```
## 🎨 Design Quality Pipeline

생성된 파일: {file list}

추천 다음 단계:
  1. /design-normalize  — 토큰 정렬 (하드코딩 제거)
  2. /design-audit      — 기술 품질 검사
  3. /design-critique    — UX 휴리스틱 리뷰
  4. /design-polish      — 최종 인터랙션 보완

💡 /design-teach 가 아직 설정되지 않았다면 먼저 실행하세요.
```
