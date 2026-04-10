---
name: chub-usage
tier: optional
description: "Context Hub (chub) — fetch vetted, up-to-date API documentation. Write accurate code based on the latest docs instead of training data when working with external APIs/SDKs."
triggers: [chub, context hub, API docs, latest API, deprecated API, SDK documentation, api reference, 최신 문서]
priority: 65
---

# Context Hub (chub) Usage

A skill for fetching vetted, up-to-date documentation before writing external API/SDK code.
Solves the knowledge cutoff problem inherent in training data.

## Why?

| Problem | Solution |
|---------|----------|
| Relying on training data → using deprecated APIs | chub get → code based on vetted latest docs |
| Web search → noisy results | chub search → curated docs only |
| Repeating the same mistakes every session | chub annotate → accumulated learnings |

## When to Use

| Situation | Example |
|-----------|---------|
| Writing external API code | "Integrate Stripe payments" |
| Checking latest SDK version | "Call the latest OpenAI model" |
| Need official documentation | "Set up Supabase auth" |
| Preventing deprecated patterns | "Firebase v10 migration" |

## Workflow

```
Request to write external API/SDK code
    ↓
Step 0: Check if chub is installed (auto-install if not)
    ↓
Step 1: chub search "<library name>"
    ↓
Step 2: chub get <id> --lang ts
    ↓
Step 3: Write code based on the docs
    ↓
Step 4: chub annotate when a gotcha is discovered
```

## Step 0 — Auto-install

**Always perform this step before running the skill.**

```bash
# 1. Check if chub exists
which chub || command -v chub
```

If chub is not found, attempt automatic installation:

```bash
npm install -g @aisuite/chub
```

If installation fails, fall back to running via `npx @aisuite/chub`:

```bash
# search example
npx @aisuite/chub search "stripe"
# get example
npx @aisuite/chub get stripe/api --lang ts
```

If `npx` also fails, fall back to context7 or Web Search (see Fallback Chain).

## Usage

### Step 1 — Search for docs

```bash
chub search "stripe"
chub search "openai"
chub search ""           # View full list
```

### Step 2 — Fetch latest docs

```bash
chub get stripe/api --lang ts
chub get openai/chat --lang py
chub get supabase/auth --lang js
```

### Step 3 — Write code based on the docs

Write accurate code based on the fetched documentation.
**Never rely on training data. Docs first, code second.**

### Step 4 — Record learnings

Gotchas, workarounds, and version issues discovered during work:

```bash
chub annotate stripe/api "pg parameter is required for Korean payments"
chub annotate openai/chat "tool_calls in streaming comes as delta"
chub annotate firebase/auth "getAuth() import path changed in v10"
```

Annotations are stored locally and automatically included the next time you run `chub get`.

## Implementation Pattern (Subagent)

Run via subagent to prevent context bloat:

```
Task tool call:
- subagent_type: Explore
- model: haiku
- prompt: "Run `chub search <library>` then `chub get <id> --lang <lang>` to fetch latest API documentation for [topic]. Return only the relevant API usage examples, key changes from previous versions, and any annotations."
```

The subagent handles the chub calls and returns only a summary — keeping the main context clean.

## Supported APIs (1,000+)

OpenAI, Anthropic, Stripe, Firebase, Supabase, Vercel, AWS S3, Cloudflare Workers, Auth0, Clerk, and more.

```bash
chub search    # Run without arguments to view the full list
```

## Fallback Chain

```
which chub fails
    ↓
npm install -g @aisuite/chub (auto attempt)
    ↓
On failure: npx @aisuite/chub <command> (temporary execution)
    ↓
If npx also fails: context7 or Web Search fallback
```
