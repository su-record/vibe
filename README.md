# VIBE

**AI writes code. Vibe makes sure it's good.**

[![npm](https://img.shields.io/npm/v/@su-record/vibe)](https://www.npmjs.com/package/@su-record/vibe)
[![npm downloads](https://img.shields.io/npm/dt/@su-record/vibe.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/@su-record/vibe)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

Vibe is a quality harness for AI coding tools. It wraps around Claude Code, Codex, Cursor, or Gemini CLI and automatically enforces type safety, code quality, and security — before, during, and after code generation.

```bash
npm install -g @su-record/vibe
vibe init
```

---

## How It Works

```
You: "Add user authentication"

  /vibe.spec        → GPT + Gemini research in parallel → SPEC document
  /vibe.run         → Implement from SPEC → 12 agents review in parallel
  Quality gates     → Block any types, long functions, dangerous commands
  Done              → Only reviewed, type-safe code remains

Every step is automatic. You type one prompt.
```

---

## Quick Start

```bash
# 1. Install
npm install -g @su-record/vibe

# 2. Initialize your project (auto-detects stack)
cd your-project
vibe init

# 3. Use with your AI coding tool
claude                              # Claude Code
# or codex, cursor, gemini — all supported

# 4. Try the workflow
/vibe.spec "add user authentication"   # Write requirements
/vibe.run                              # Implement from SPEC
```

Add `ultrawork` to any command for full automation:

```bash
/vibe.run "add user authentication" ultrawork
```

---

## What It Does

**Quality gates** — Blocks `any` types, `@ts-ignore`, functions over 50 lines. Three-layer defense runs on every tool call.

**Specialized agents** — 56 purpose-built agents for exploration, implementation, architecture, code review (12 in parallel), and UI/UX analysis.

**Multi-LLM** — Claude orchestrates, GPT reasons, Gemini researches. Auto-routes by availability. Works Claude-only by default.

**Session memory** — Decisions, constraints, and goals persist across sessions via SQLite + FTS5 hybrid search.

**Stack detection** — Auto-detects 24 frameworks (Next.js, Django, Rails, Go, Rust, Flutter, and more) and applies framework-specific rules.

**Figma → Code** — Tree-based structural mapping targeting 90% design fidelity. Extracts 30+ CSS properties from Figma REST API, remaps across breakpoints, generates responsive code.

---

## Supported Tools

| CLI | Status |
|-----|--------|
| [Claude Code](https://claude.ai/code) | Full support |
| [Codex](https://github.com/openai/codex) | Plugin |
| [Cursor](https://cursor.sh) | Agents + Rules |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | Agents + Skills |

---

## Documentation

Full guides, skill reference, and configuration details are in the [Wiki](https://github.com/su-record/vibe/wiki).

- [README (Korean)](README.ko.md)
- [Release Notes](RELEASE_NOTES.md)

---

## Requirements

- Node.js >= 18.0.0
- Claude Code (required)
- GPT, Gemini (optional)

## License

MIT — Copyright (c) 2025 Su
