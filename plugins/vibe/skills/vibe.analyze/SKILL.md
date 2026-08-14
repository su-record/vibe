---
name: vibe.analyze
description: Use when code, documents, websites, Figma, or project quality must be analyzed into an evidence-backed report.
argument-hint: '"feature-name" or file.pdf or https://... or --code or --deps or --arch'
user-invocable: true
---

# /vibe.analyze

Analyze any target: source code, documents, websites, or Figma designs.

## Usage

```
/vibe.analyze                  # Full project quality analysis
/vibe.analyze "login"          # Feature/module code exploration + context collection
/vibe.analyze --code           # Code quality analysis only
/vibe.analyze --deps           # Dependency analysis only
/vibe.analyze --arch           # Architecture analysis only
/vibe.analyze report.pdf       # Document analysis (PDF, markdown, slides)
/vibe.analyze https://example.com  # Website analysis (UX, tech, SEO, accessibility)
/vibe.analyze https://figma.com/design/...  # Figma design analysis
```

## Input Type Auto-Detection

Determine analysis mode from the argument pattern:

| Pattern | Mode | Description |
|---------|------|-------------|
| `*.pdf`, `*.docx`, `*.pptx`, `*.md` (file path) | **Document** | Structure, content, quality, applicability |
| `http(s)://figma.com/*` | **Figma** | Design structure, components, tokens |
| `http(s)://*` | **Website** | UX, tech stack, SEO, accessibility |
| `--code`, `--deps`, `--arch` | **Project Quality** | Code quality, dependencies, architecture |
| String (feature name) | **Feature/Module** | Source code exploration + flow analysis |
| No argument | **Project Quality** | Full project analysis |

**Detection order**: file extension → URL pattern → flag → string.

## File Reading Policy (Mandatory)

- **SPEC/Feature files**: Always use the harness's full-file reading capability (never text search for content)
- **Source files**: Read the entire file before analyzing (no partial reads)
- **Text-search restriction**: Use only for locating files, not for understanding content
- **Agent prompts**: Always include "Read target files in full before analyzing"
- **No partial analysis**: Never judge a file by a few lines around a Grep match

## Context Reset

**When this command runs, previous conversation is ignored.**
- Explore and analyze from scratch like a new session
- Base analysis only on newly collected information

---

> **Timer**: Record start time at the beginning. Include elapsed time in the final report.

## 모드 라우팅 (하나만 로드)

입력 판별 결과에 따라 **아래 reference 중 정확히 하나만** 읽는다. 한 번의 호출은 한 모드만 실행하므로,
나머지 셋은 읽지 않는다 — 이것이 이 스킬에서 컨텍스트를 가장 크게 줄이는 지점이다.

| 모드 | 선택 조건 | 본문 |
|---|---|---|
| **1** Feature/Module | 인자가 기능·모듈 이름 (코드 분석) | `references/mode1-feature.md` |
| **2** Document | 인자가 PDF·Markdown·슬라이드 파일 | `references/mode2-document.md` |
| **3** Website | 인자가 http(s) URL | `references/mode3-website.md` |
| **4** Project Quality | `--code` / `--deps` / `--arch` 플래그 | `references/mode4-quality.md` |

두 모드가 동시에 해당하면 사용자에게 어느 쪽인지 묻는다 — 임의로 고르지 않는다.

## Core Tools (Semantic Analysis)

### Tool Invocation

```bash
node -e "import('{{VIBE_PATH_URL}}/node_modules/@su-record/vibe/dist/tools/index.js').then(t => t.TOOL_NAME({...args}).then(r => console.log(r.content[0].text)))"
```

### Available Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `analyzeComplexity` | Complexity analysis | Measure complexity metrics |
| `validateCodeQuality` | Quality validation | Check code quality standards |
| `saveMemory` | Save analysis results | Persist findings for future sessions |

---

## Quality Gate (Mandatory)

Each mode has a weighted completeness checklist. Score = sum(checked items × weight) / 100. **Minimum depth: L3 for feature analysis, L2 for project overview.**

> Read `references/quality-gate.md` for the full mode-specific weighted checklists, score grades, depth-level table, forbidden-patterns table, and quality thresholds (code/deps).

---

## Done Criteria

- [ ] The report records the target and selected mode.
- [ ] Every material finding has a file/line, URL, or source-location citation.
- [ ] The selected mode's minimum depth and quality score pass.
- [ ] The specified `.vibe/reports/` output exists.

ARGUMENTS: $ARGUMENTS
