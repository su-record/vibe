---
name: devlog
tier: standard
description: "Auto-generate devlog posts from git commit history. Triggers every N commits, writes markdown to configured target repo."
triggers: [devlog, 개발일지, dev log, devlog 작성, 개발일지 작성]
priority: 60
---
# Devlog Auto-Generator

Analyzes git commit history to automatically generate development logs and saves them as posts to the configured blog repository.

## Config

`devlog` section in `.claude/vibe/config.json`:

```json
{
  "devlog": {
    "enabled": true,
    "targetRepo": "/absolute/path/to/blog-repo",
    "targetDir": "posts",
    "prefix": "devlog",
    "interval": 10,
    "autoPush": false,
    "lang": "ko",
    "author": "Su",
    "category": "dev-log",
    "tags": []
  }
}
```

| Key | Required | Default | Description |
|-----|----------|---------|-------------|
| `enabled` | Y | `false` | Whether to enable |
| `targetRepo` | Y | — | Absolute path to the blog repository |
| `targetDir` | N | `"posts"` | Directory to save posts |
| `prefix` | N | `"devlog"` | Filename prefix (`{prefix}-{NNNN}.md`) |
| `interval` | N | `10` | How many commits trigger a generation |
| `autoPush` | N | `false` | Auto commit+push to targetRepo |
| `lang` | N | `"ko"` | Writing language |
| `author` | N | git user.name | Author name |
| `category` | N | `"dev-log"` | frontmatter category |
| `tags` | N | `[]` | Default tags (project name etc. auto-added) |

## Trigger Modes

### 1. Auto (post-commit hook)

The `devlog-gen.js` hook checks the counter on every commit, and when it reaches `interval`, generates a devlog via `llm-orchestrate.js`.

### 2. Manual

User manually triggers via `/devlog` or the `개발일지 작성` keyword. Collects commits since the last devlog and generates immediately.

## Generation Process

### Step 1: Collect Commits

Collects commits after the date of the last devlog:

```bash
# Extract date from last devlog file
# frontmatter date of targetRepo/targetDir/{prefix}-NNNN.md
git log --oneline --after="{last_date}" --reverse
```

### Step 2: Analyze & Group

- Identify version bump commits (X.Y.Z pattern)
- Classify by feat/fix/refactor/docs
- Select notable commits (meaningful changes)

### Step 3: Generate Markdown

Generated with the following frontmatter format:

```markdown
---
title: "{project_name} Devlog #{next_number} - {summary_title} ({interval} commits)"
date: "{today}"
category: "{category}"
description: "{one_line_description}"
tags: [{project_tags}, {auto_detected_tags}]
author: "{author}"
lang: "{lang}"
---

# {title}

**Work period**: {start_date} ~ {end_date}

## Work done this period

### {theme} ({interval} commits)

{overview_paragraph}

| Commit | Description |
|--------|-------------|
| `{meaningful_commit_message}` | **{highlight}** |
...

## Work highlights

{2-3 highlights with code blocks or diagrams}

## Development status

- **Version**: {start_version} → {end_version}
- **Key changes**: {key_changes}

---

**Next devlog**: {prefix}-{next+1} (after next {interval} commits)
```

### Step 4: Write File

```
{targetRepo}/{targetDir}/{prefix}-{NNNN}.md
```

The number is automatically determined as the last existing file number + 1.

### Step 5: (Optional) Auto Push

If `autoPush: true`:

```bash
cd {targetRepo}
git add {targetDir}/{prefix}-{NNNN}.md
git commit -m "post: Add {prefix} #{NNNN}"
git push
```

## Rules

- **Preserve original commit messages** — Quote commit messages verbatim, no arbitrary changes
- **Include version bump commits** — Include in the table but exclude from highlights
- **Maximum 3 highlights** — Select only the most impactful changes
- **Use code blocks** — Before/After comparisons and architecture diagrams are recommended
- **Emphasize numbers** — Line count changes (-N lines), version ranges, file counts, etc.
