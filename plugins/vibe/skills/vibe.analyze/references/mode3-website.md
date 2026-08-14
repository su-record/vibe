# Mode 3: Website Analysis (URL)

> vibe.analyze SKILL.md 의 모드 라우팅에서 **이 모드가 선택됐을 때만** 로드한다.

## Mode 3: Website Analysis (URL)

### Goal

Analyze website **tech stack, UX/UI, SEO, accessibility, and performance** to:
1. Understand technical implementation
2. Identify improvement opportunities
3. Collect benchmarking insights

### Process

#### 1. Fetch Website

- Use the harness's web-page retrieval capability to retrieve HTML
- Fetch key pages (home, main feature pages, login, etc.)

#### 2. Analyze (Parallel Sub-Agents)

```text
- Worker: retrieve and analyze [URL] for tech stack, page structure, and SEO elements.
- Worker: retrieve and analyze [URL] for accessibility, performance hints, and responsiveness.
- Worker: retrieve and analyze [URL] for UX patterns, design-system signals, and content strategy.
```

#### 3. Figma URL Handling

If a Figma URL is detected, switch to **Figma-specific analysis**:
- Use `get_design_context` or `get_screenshot` to collect design data
- Analyze component structure, design tokens, layout patterns
- Compare design intent with current project code

#### 4. Output

> Read `references/output-templates.md` for the full Mode 3 output format.

#### Fallback

If web-page retrieval fails:
1. Retry once with a simplified URL (strip query params)
2. If still failing, inform user of the error (timeout, DNS, etc.)
3. Suggest user provide HTML file directly: `/vibe.analyze page.html`

---
