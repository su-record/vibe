---
name: design-teach
tier: standard
description: "Gather and store project design context — target audience, brand personality, aesthetic direction, constraints. Used by other design-* skills. Use when design-teach, design-setup, design-context."
triggers: [design-teach, design-setup, design-context]
priority: 50
---

# Design Teach — Project Design Context Gathering

Collect project-specific design context so all design-* skills produce tailored, brand-aware results. Saves to `.claude/vibe/design-context.json`.

## Usage

```
/design-teach                  # Interactive context gathering
/design-teach --update         # Update existing context
```

## Process

### Step 1: Auto-Explore Codebase

Before asking questions, automatically gather existing signals:

| Signal | Where to Look |
|--------|---------------|
| CSS variables / tokens | `*.css`, `tailwind.config.*`, `theme.*` |
| Color palette | Existing color definitions, brand assets |
| Typography | Font imports, font-family declarations |
| Component library | `package.json` dependencies (MUI, Chakra, shadcn, etc.) |
| Design system | `.claude/vibe/design-system/*/MASTER.md` |
| Existing context | `.claude/vibe/design-context.json` (if updating) |

### Step 2: Ask Clarifying Questions

Present findings from Step 1, then ask what's missing:

**1. Target Audience**
- Who are the primary users? (developers, consumers, enterprise, internal)
- Technical sophistication? (tech-savvy, general public, mixed)
- Usage context? (desktop office, mobile on-the-go, both)

**2. Brand Personality**
- How should the product feel? (professional, playful, minimal, bold, warm)
- Reference products with similar feel? (e.g., "Linear-like", "Notion-like")
- Any brand guidelines or style guide URL?

**3. Aesthetic Direction**
- Visual density preference? (spacious, balanced, dense)
- Color mood? (warm, cool, neutral, vibrant)
- Typography mood? (modern sans, classic serif, monospace-technical)

**4. Constraints**
- Accessibility requirements? (WCAG AA, AAA, specific needs)
- Supported devices? (desktop-only, mobile-first, responsive)
- Dark mode required?
- Performance budget? (target LCP, bundle size limits)

### Step 3: Save Context

Write gathered context to `.claude/vibe/design-context.json` using the Write tool.

**Schema (v1):**

```json
{
  "$schema": "design-context-v1",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "audience": {
    "primary": "대상 사용자 설명",
    "context": "사용 환경 (desktop/mobile/mixed)",
    "expertise": "기술 수준 (beginner/intermediate/expert)"
  },
  "brand": {
    "personality": ["형용사 3-5개"],
    "tone": "formal | casual | playful | professional (가이드라인, 자유 입력 가능)",
    "existingAssets": "기존 브랜드 가이드라인 경로 (선택)"
  },
  "aesthetic": {
    "style": "minimal | bold | elegant | playful | corporate (가이드라인, 자유 입력 가능)",
    "colorMood": "warm | cool | neutral | vibrant | muted (가이드라인, 자유 입력 가능)",
    "typographyMood": "modern | classic | geometric | humanist (가이드라인, 자유 입력 가능)",
    "references": ["참조 사이트/앱 URL"]
  },
  "constraints": {
    "accessibility": "AA | AAA",
    "performance": "core-web-vitals | balanced | unlimited",
    "browsers": ["chrome", "safari", "firefox", "edge"],
    "devices": ["mobile", "tablet", "desktop"]
  },
  "detectedStack": {
    "framework": "감지된 프레임워크",
    "componentLibrary": "감지된 컴포넌트 라이브러리",
    "styling": "감지된 스타일링 방식",
    "fonts": ["감지된 폰트"]
  }
}
```

> **Note**: `tone`, `style`, `colorMood`, `typographyMood` 값은 제안 값이며 closed enum이 아닙니다. 사용자가 자유 텍스트로 입력할 수 있습니다.

> **Size limit**: design-context.json은 10KB를 초과하지 않도록 합니다. `references` 배열은 최대 5개로 제한합니다.

### Step 4: Rerun Semantics

`design-context.json`이 이미 존재할 때 `/design-teach`를 다시 실행하면:

1. 기존 파일을 Read 도구로 읽음
2. 각 질문에 **기존 값을 기본값으로 표시** ("현재: professional, clean — 변경하시겠습니까?")
3. 사용자가 "keep" 또는 빈 답변 → 해당 필드 유지
4. 새 값 입력 → 해당 필드만 교체 (병합이 아닌 **필드 단위 교체**)
5. `createdAt`은 항상 보존, `updatedAt`만 현재 시각으로 갱신

### Step 5: Other Skills Reference This Context

각 design-* skill은 실행 시 다음을 수행:

```
1. Read `.claude/vibe/design-context.json`
2. 파일 없음 → "Run /design-teach first for better results" 안내 출력 → 기본값으로 계속 실행
3. 파싱 실패 (잘못된 JSON) → "design-context.json 파싱 실패" 경고 + 기본값으로 계속 → /design-teach 재실행 권장
4. 정상 → context를 분석 기준에 반영
```

## Design Workflow Integration

디자인 스킬은 vibe 워크플로우의 3개 Phase에 통합됩니다:

```
SPEC Phase:
  ① design-context.json 확인 (없으면 /design-teach 권장)
  ② ui-industry-analyzer → ui-design-system-gen → ui-layout-architect

REVIEW Phase:
  ③ /design-audit (기술 품질 점검)
  ④ /design-critique (UX 리뷰)
  ⑤ ui-antipattern-detector (AI slop + 패턴 탐지)

PRE-SHIP Phase:
  ⑥ /design-normalize (디자인 시스템 정렬)
  ⑦ /design-polish (최종 패스)
```

## How Other Skills Use This

| Skill | Context Usage |
|-------|---------------|
| `/design-audit` | Weight findings by audience constraints (a11y level, devices) |
| `/design-critique` | Adjust persona priorities by target audience |
| `/design-polish` | Apply brand-appropriate micro-interactions |
| `/design-normalize` | Use detected token system for replacement mapping |
| `/design-distill` | Preserve brand-expressive elements based on personality |

## Output Format

```markdown
## Design Context: {project}

### Auto-Detected
- Framework: Next.js 15
- Styling: Tailwind CSS + shadcn/ui
- Fonts: Inter (heading), Inter (body)
- Tokens: 24 CSS variables found

### User Provided
- Audience: B2B SaaS, mixed technical level
- Brand: Professional, clean (like Linear)
- Density: Balanced
- A11y: WCAG AA
- Dark mode: Required

### Saved
✅ .claude/vibe/design-context.json updated
```

## Important

- **Non-destructive**: Only creates/updates the context file. No code changes.
- **Incremental**: Running `--update` preserves existing answers, only asks about gaps.
- **Foundation**: Run this first before other design-* skills for best results.
