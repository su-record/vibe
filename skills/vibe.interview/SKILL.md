---
name: vibe.interview
tier: core
description: "Iteratively interview the user to gather ALL required and optional requirements for a new project or feature. Loops until the user explicitly stops. Uses type-specific domain checklists (website, webapp, mobile, api, library, feature) so nothing is missed. Must use this skill when the user says '만들자', '개발하자', '신규 기능', '무엇을 만들', 'let's build', 'new feature', or starts describing a product idea without a plan yet."
triggers: [만들자, 개발하자, 기획하자, 신규 기능, 새 프로젝트, "무엇을 만들", "무엇을 개발", 아이디어, 인터뷰, interview, requirements, "let's build", "new feature", "new project"]
priority: 95
chain-next: [vibe.plan]
---

# vibe.interview — Domain Requirements Interview

> **Principle**: Uncover all required and optional information in the requirements domain until the user says "stop". Do not wrap up with 10 shallow questions.

## When to Use

- The user is starting development of a new project or feature
- Going straight to `/vibe.spec` without a plan risks missing requirements
- Natural language triggers like "let's build", "let's develop", "new", "idea"
- `/vibe.spec` orchestrator calls this as Phase 1 (interview step)

**Skip when**:
- Small bug fix on an existing project
- `.claude/vibe/plans/{feature}.md` already exists (→ only update via `vibe.plan`)

## Core Loop

```
1. Detect project type (website|webapp|mobile|api|library|feature)
     ↓
2. Load type-specific checklist
     checklists/{type}.md
     Required items + Optional items
     ↓
3. ┌─── Interview loop ───┐
   │                      │
   │  One question at a   │
   │  time                │
   │       ↓              │
   │  User answer         │
   │       ↓              │
   │  Update checklist    │
   │       ↓              │
   │  New domain found →  │
   │  Expand checklist    │
   │       ↓              │
   │  Show progress       │
   │       ↓              │
   │  Stop detected? ─────┼─→ Exit
   │       │              │
   │       └──── loop ────┘
   └──────────────────────┘
     ↓
4. Save collected results
   .claude/vibe/interviews/{feature}.md
     ↓
5. chain-next: vibe.plan
```

## Step 0: Git Branch (MANDATORY)

```bash
git branch --show-current
```

| Current | Action |
|---------|--------|
| `main`/`master` | `git checkout -b interview/{feature-name}` |
| `interview/*`, `feature/*` | Confirm with user |
| Other | Confirm with user |

**Naming**: lowercase + hyphens, prefix `interview/`

## Step 1: Detect Project Type

**First pass — keywords**:

| Keyword | Type | Checklist |
|---------|------|-----------|
| website, landing, portfolio, 랜딩, 웹사이트, 홍보, 프로모션 | `website` | `checklists/website.md` |
| webapp, dashboard, SaaS, 대시보드, 관리자, tool | `webapp` | `checklists/webapp.md` |
| mobile, iOS, Android, 앱, native, Flutter, React Native | `mobile` | `checklists/mobile.md` |
| api, backend, server, rest, graphql, 서버, 백엔드 | `api` | `checklists/api.md` |
| library, sdk, cli, package, npm, 라이브러리 | `library` | `checklists/library.md` |
| feature, 기능, 추가, refactor | `feature` | `checklists/feature.md` |

**If ambiguous, confirm with one question** (provide options):

```
What kind of project is this?

1. Website (landing / portfolio / promotion)
2. Web app (dashboard / SaaS / tool)
3. Mobile app
4. API / Backend
5. Library / SDK / CLI
6. A feature to add to an existing project
```

## Step 2: Load Checklist

Read the checklist file for the detected type:

```
Read skills/vibe.interview/checklists/{type}.md
```

The checklist is divided into a **Required** section and an **Optional** section. Each item has the following structure:

```markdown
- [ ] ID: question-id
      question: The question to ask the user
      type: required | optional
      hint: Example answers or choices
      follow-up: Sub-questions to drill into based on the answer
```

**Keep state in memory**:

```javascript
const state = {
  type: 'website',
  collected: {
    'purpose': 'New product launch promotion',
    'target-users': 'Home cafe enthusiasts',
    // ...
  },
  pending: {
    required: ['success-metric', 'launch-deadline', ...],
    optional: ['analytics', 'cms', 'i18n', ...]
  },
  discovered: [],  // Items newly discovered during conversation
  stopped: false
};
```

## Step 3: Interview Loop

### 3.1 Question Rules

- **One question at a time**. No combined questions.
- **Multiple choice + free input** in parallel: "1. A  2. B  3. C  or describe freely"
- **No fixed order**. Prioritize related pending items based on conversation flow.
- **Keep it short**. One line of context + one line of question.

### 3.2 Processing Answers

- Save answers to `collected`
- Extract additional information from answers (e.g., "I want dark mode" → auto-record `theme-preference=dark`)
- **Detect new domains**: If an answer mentions an area not in `pending` → add to `discovered` and generate questions
  - e.g., "I need payments too" → expand checklist with `payment-provider`, `payment-methods`, `currency`, etc.

### 3.3 Show Progress (every 3–5 questions)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Interview Progress
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Required: 5/8
⚪ Optional: 2/14
➕ Discovered: 3 new items

Next topic: {next-topic}

Just answer to continue.
Say "stop", "enough", or "done" at any time to finish.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3.4 Stop Detection (Stop Control)

**Explicit stop keywords** (if found in user's answer, set `stopped = true`):

```
그만, 멈춰, 충분해, 됐어, 이제 됐다,
stop, done, enough, that's it, finish, skip
```

**Implicit stop**:
- "I don't know" / "later" on the same topic 3 times in a row → automatically move to next topic
- Pressing only `Enter` on an Optional item → skip that item

**Warning when Required items are incomplete**:

```
⚠️ {N} required item(s) remaining: {list}

Do you still want to stop? (y/N)
Incomplete items will be marked as "TBD" in the plan.
```

### 3.5 Phase Transitions

- **Required → Optional**: Automatically transition when all Required items are filled
  ```
  ✅ Required requirements collected!

  Would you like to go through the optional items?
  (SEO, analytics, i18n, accessibility, etc. — 1–2 questions each)

  1. Yes, continue
  2. Key items only (3–5 questions)
  3. Stop
  ```
- **Optional → End**: All Optional items processed or user stopped

## Step 4: Save Collected Results

**Output file**: `.claude/vibe/interviews/{feature-name}.md`

**Structure**:

```markdown
---
feature: {feature-name}
type: website | webapp | mobile | api | library | feature
status: complete | partial
startedAt: {ISO-timestamp}
completedAt: {ISO-timestamp}
requiredCollected: 8/8
optionalCollected: 12/14
stoppedBy: user | auto
---

# Interview: {feature-name}

## Required Requirements

### purpose
**Q**: Why are you building this project?
**A**: A new product launch promotion site. Launching a home cafe coffee bean brand.

### target-users
**Q**: Who is the primary target audience?
**A**: Home cafe enthusiasts, people who buy coffee beans 2–3 times a month.

...

## Optional Requirements

### analytics
**Q**: Do you need analytics tool integration?
**A**: GA4 + Hotjar

...

## Discovered (found during conversation)

### payment-integration
**Context**: User mentioned "direct checkout from the buy button"
**Q**: What payment methods do you want to support?
**A**: Stripe, Kakao Pay

...

## TBD (not collected)

- [ ] `seo-strategy` — optional, skipped by user
- [ ] `maintenance-plan` — optional, skipped by user
```

### Update `.last-feature` pointer

```
Write ".claude/vibe/.last-feature" ← feature-name (single line)

Run immediately after saving the interview file in Step 4.
This pointer is used by /vibe.spec (no args) for Smart Resume.
No-op if the value is already the same.
```

## Step 5: Chain to vibe.plan

After the interview is complete, the `vibe.plan` skill is automatically activated to refine the results into a structured plan.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Interview complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 .claude/vibe/interviews/{feature-name}.md
   Required: 8/8
   Optional: 12/14
   Discovered: 3

→ vibe.plan skill is starting plan creation...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Anti-Patterns

- Bundling multiple questions together at once
- Prompting the user to stop before Required items are complete
- Ignoring a user's answer and moving on to the next question
- Missing areas not in the checklist (use `discovered`)
- Writing the plan in PTCF/EARS/Phase structure here (that is refined by vibe.plan; the actual spec is written by /vibe.spec)
- Ending with 10 shallow questions (keep going until the user explicitly stops)
- Providing only multiple-choice options without allowing free input

## Example Session (abbreviated)

```
User: I want to make a parallax website

Claude: 🌿 Branch created: interview/parallax-website ✅
        Type: website detected → loading checklists/website.md

        Let me start with some background.
        Why are you building this website?
        (e.g., personal portfolio, product promotion, agency introduction, etc.)

User: New product launch promotion. Coffee bean brand.

Claude: Got it. Who is the primary target audience?
        1. Coffee beginners
        2. Home cafe enthusiasts
        3. Cafe owners / baristas
        Or describe freely

User: 2

Claude: What emotion or atmosphere should users feel first when they land on this site?

User: Premium. Cinematic.

Claude: Do you have any reference sites or images? (URL or "none")

User: Like the apple.com product page feel

[10–20 questions continue...]

Claude: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        📊 Interview Progress
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        ✅ Required: 8/8 complete!
        ⚪ Optional: 4/14

        Would you like to continue with optional items (SEO, analytics, i18n, etc.)?
        1. Yes, all of them
        2. Key items only (3–5)
        3. Stop

User: 3

Claude: ⚠️ All required items complete. 10 optional items will be marked as TBD.

        ✅ Interview complete!
        📄 .claude/vibe/interviews/parallax-website.md

        → vibe.plan skill is starting plan creation...
```

## Related

- **Next**: `vibe.plan` — refine interview results into a structured plan
- **After plan**: `vibe.spec` (skill) → generates SPEC → then `/vibe.run` (logic) + `/vibe.figma` (UI track) in parallel
- **Templates**: `~/.claude/vibe/templates/plan-template.md`
- **Checklists**: `skills/vibe.interview/checklists/{type}.md`
