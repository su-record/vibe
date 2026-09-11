---
name: antislop-design
description: A design skill that strips generic-AI visual patterns and writes, diagnoses, revises and converts the design of anything a person will look at — web UI, screens, components, dashboards, landing pages, slides, card news, posters, email layouts — in HTML, CSS, React, Vue, Svelte or SVG. Use it before writing markup or styling for a new interface, when judging or fixing an existing one, and whenever a visual layout needs to fit a specific brief instead of a default template.
metadata:
  tags: [design, ui, frontend, editing]
  category: content
---

# Design Writing Skill (antislop-design)

`antislop-design` is a **general-purpose design skill**. It does not impose
one visual style. It chooses structure, type, colour and motion that fit the
brief, the user and the medium at hand — the same way `antislop-en` and
`antislop-ko` choose prose that fits purpose, reader and genre rather than
one house voice.

## When to Use

- Writing a new screen, page, component, dashboard, slide, card or poster from scratch.
- Diagnosing an existing design without changing it.
- Revising only what needs to change while preserving function, data and brand.
- Converting a template into something specific to one brief, or moving a design from one medium to another.

Apply it by default to any request that creates or fixes something a person
will look at on a screen or a printed page. Do not apply it to backend logic,
data pipelines or prose with no visual layout — those belong to other skills.

Treat "build" or "design" as authoring, "look this over" as diagnosis, "fix"
or "polish" as revision, and "make this specific" or "turn this into a
poster" as conversion. Do not attach a diagnostic table the user did not ask
for; lead with the finished design.

## Quality Priority

Judge in the following order. Do not damage an earlier condition to gain a
later advantage.

1. **Function and data**: the design does what it must do, with real content and real states, nothing invented.
2. **Fit for the user and task**: the person who uses this, how often, and what they look for first, are visibly served.
3. **Hierarchy and structure**: what is seen first is what matters first; layout encodes information, not decoration.
4. **Accessibility**: contrast, semantic structure, keyboard access and labels hold for every state.
5. **Type and colour choices**: deliberate, named, traceable to the brand or the content.
6. **Motion and polish**: present only where it serves a purpose, never as default flourish.

## What Design Slop Is

Design slop is a visual choice that could be dropped into any product,
company or brief unchanged and would still "look right." It is the visual
equivalent of a sentence that fits any topic. The test is not whether a
pattern appears — a rounded card or a gradient can be correct — but whether
the choice was made for this brief or is the generic default a model
produces when nobody decided otherwise.

### Generic clusters that show up on sight

A model left to its own defaults converges on a small set of looks. Each is
fine as one deliberate choice for the right brief; each is slop when it is
simply what appeared because nothing else was decided.

- **Purple/indigo gradient hero over three rounded feature cards.** A `linear-gradient` hero banner, a bold headline, and exactly three cards below it, each with an icon, a heading and one line of copy — the shape of a demo, not a product.
- **Glass panels with backdrop blur.** Frosted, semi-transparent panels (`backdrop-filter: blur(...)`) laid over an image or gradient, used for decoration rather than to show real layering (a modal above content, a sticky header over scroll).
- **Emoji as icons.** 👋, 🚀, ✨, 📊 standing in for a real icon set or no icon at all, especially in headings, buttons and list markers.
- **"Welcome back 👋" greetings.** A friendly, familiar tone asserted by copy instead of earned by the product's actual relationship with the user.
- **Stat tiles with invented numbers.** "10,000+ users," "99.9% uptime," "4.9★" with no source — a number that exists to look like proof rather than to report one.
- **Fake testimonials.** A quote attributed to "Jane D., Product Manager" that is illustrative rather than sourced.
- **Sparkles.** The ✨ glyph or a sparkle icon marking a feature as "AI" or "new" with no other signal.
- **Fade-and-slide-up on every section, hover-lift on every card.** A scroll-triggered entrance animation applied uniformly, and a `translateY` lift on `:hover` for every card regardless of whether the card is interactive.
- **One typeface for everything.** Inter or the system font stack used for display headings, body copy and captions alike, with no second voice for contrast.
- **Everything centred.** `text-align: center` and centred flex layouts applied to headings, paragraphs and forms alike, flattening the reading path.
- **Gray-on-gray low contrast.** Body text and secondary text both landing in a narrow band of grays that fails contrast rather than being pushed to a deliberate darker or lighter value.
- **Uniform 16/24px spacing with no rhythm.** Every gap the same one or two values, so nothing signals grouping, and dense and sparse content look the same.
- **Copy that says seamlessly, unlock, effortless, empower.** The visual-design counterpart of AI-cliché prose (see `antislop-en`'s catalogue) — vague verbs standing in for a specific benefit.
- **"Get started" CTAs everywhere.** The same button label repeated for actions that are not the same action, because no one named what each button actually does.

### The five named aesthetic clusters

Beyond the generic-default shapes above, a model asked for "something
distinctive" tends to reach for one of five named looks, applied as a skin
rather than a decision:

1. **Warm minimal**: a warm cream background, a high-contrast serif display face, a terracotta or warm-clay accent.
2. **Dark neon**: a near-black background with a single bright acid-green or vermilion accent.
3. **Broadsheet**: hairline rules, zero border-radius, dense newspaper-like columns.
4. **SaaS card kit**: content chopped into identical rounded cards, one border-radius and one soft grey shadow applied regardless of hierarchy.
5. **Template chrome**: tracked-out ALL-CAPS eyebrow labels above every heading, meta strings joined with middle dots, labels built as "WORD — fragment."

Any of the five is a legitimate choice when the brief calls for it — a
newspaper-style broadsheet look for an actual publication, a dark-neon look
for a security dashboard. It is slop when it is reached for because it reads
as "designed" rather than because the brief asked for it.

### How to see these in markup and CSS

The catalogue markers have concrete signatures in source: a `linear-gradient`
value with two stop colours in the purple/indigo range, `backdrop-filter:
blur(...)` on a panel with no functional layering reason, emoji code points
inside `<h1>`–`<h3>` or `<li>` markers, `font-family: Inter` (or no
`font-family` at all, falling back to the system stack) with no second
family declared anywhere, `text-align: center` repeated across unrelated
elements, a single `border-radius` and `box-shadow` pair repeated on every
card, `letter-spacing` and `text-transform: uppercase` on short labels, `·`
or `—` as a metadata separator, and an animation class (`fade-up`,
`animate-in`, `hover:-translate-y-1`) applied to every section or every card
rather than to the one element that needs it. The full table of markers,
their code signatures and the alternative is in
[references/catalogue.md](references/catalogue.md).

## The Decisions a Specific Design Makes First

Before writing markup or styling, fix the following as internal working
ground. This is the design-plan step — do it in prose and an ASCII sketch,
not in code, and revise the plan itself before building from it.

1. **Who uses this, and how often.** A charge nurse checking a roster twenty times a shift needs a different density than a visitor reading a landing page once.
2. **The task, and what they look for first.** Name the one piece of information or action that matters most on this screen, and make sure it is what the eye lands on first.
3. **Density.** A screen used often and briefly should show more at once with less chrome; a screen used rarely should explain more and show less.
4. **Hierarchy.** What is largest, boldest or first should be what matters most — not what was easiest to make prominent.
5. **Type.** One or two typefaces, chosen for a reason (a display face for identity, a text face for legibility at the sizes the content actually needs), not a default.
6. **Colour.** Four to six named tokens drawn from the brand or the content itself — not a palette chosen because it looks "designed." Name each token by role (background, surface, text, accent, danger, success), not only by hex value.
7. **Structure that encodes information, not decoration.** Grouping, spacing and borders should tell the reader what belongs together; a card, a rule or a gap is a claim about relationship, not a stylistic default.
8. **Motion only with a purpose.** An animation should confirm an action, guide attention to a change, or ease a state transition — never run on every element because it is available.
9. **The states.** Design for empty, loading, error, long text, many items, one item and a narrow viewport — not only the populated, average-length, ideal-count screenshot state.
10. **Contrast and keyboard access.** Text and meaningful UI against its background should read at least 4.5:1, and every interactive element should be reachable and operable by keyboard alone.
11. **Copy inside the design.** Headings, labels, button text and body copy follow the antislop pack of whatever language they are written in — `antislop-en` or `antislop-ko` — so the words are not a second source of slop next to the layout.

The design-plan template in
[references/plan.md](references/plan.md) walks through these in order,
ending with a check: state plainly what about the plan would make it generic,
and either fix that part or state why it is the right choice here anyway.

## The Four Tasks

### Write

1. Fill out the design plan (references/plan.md): brief, users and frequency, task, density, hierarchy, type, colour tokens, layout sketch in ASCII, states, motion, copy voice.
2. Review the plan itself: for each choice, ask whether it is what this brief calls for or what any similar brief would get. Revise the part that would not change if the subject changed.
3. Only then build. Implement structure first (semantic HTML, real content, all listed states), then type and colour tokens, then motion last and only where planned.
4. Check the result against the plan and against [Verification](#verification) before calling it done.

### Diagnose

Do not change the source. Answer in this order.

- What to preserve (working function, real data, existing brand tokens, accessibility that already holds).
- Findings: marker or defect, exact location, effect on the user, reason to change it.
- What a human must decide.
- Overall verdict.

Separate a stylistic preference from a defect. Do not flag a marker you
cannot pin to a location and a user effect; do not flag a single weak marker
alone (see [Strength Tiers](#strength-tiers)).

### Revise

Hold a preservation contract. Do not add, remove or alter the following
while fixing what was flagged:

- **Function**: what each control does, what each interaction triggers.
- **Data**: real content, real numbers, real copy — do not replace a fixed defect with an invented one.
- **Accessibility**: any contrast, labelling or keyboard behaviour that already passes.
- **Brand tokens**: an established colour, typeface or logo usage that the brief or an existing style guide fixes.
- **Routes and handlers**: URLs, form actions, event handlers, API calls and their shapes.

Be able to state the problem each change solves. Do not swap a shadow for a
different shadow, or a border-radius value for another one, only to look
different. Stop at `needs-human` when the brief or the brand ground is too
unclear to safely settle a change.

### Convert

- **Template to specific**: take a generic starting point (a component library default, a boilerplate landing page) and rebuild its type, colour, copy and structure around one real brief, using the design plan to force every generic choice into a decided one.
- **One medium to another**: moving a design from web UI to slide, poster or card news (or back) keeps the information hierarchy and brand tokens, but density, type scale and interaction all change with the medium — a hover state has no meaning on a printed poster, and a slide has no scroll.

## Strength Tiers

Not every marker is equally damning. Judge by tier.

- **Strong markers act alone.** One instance is enough to flag: a gradient hero paired with exactly three rounded feature cards, an emoji standing in for an icon, an invented statistic, a fake testimonial, or copy using "seamlessly"/"unlock"/"effortless"/"empower" with no specific referent.
- **Weak markers act only when two or more overlap in the same passage or component.** A rounded corner alone is not slop; a rounded corner, a soft grey shadow and a centred headline together, on a card that looks like every other SaaS card kit, is. A centred heading alone is not slop; centring applied to headings, body copy and a form all at once is.

Do not run the catalogue as a checklist of banned properties. `border-radius`
and `box-shadow` are ordinary tools; the question is always whether this use,
in this brief, is a decision or a default.

## Verification

- Does the design do what it must, with real content and every required state shown?
- Is what the user sees first what the task actually needs first?
- Is density right for how often and how briefly this gets used?
- Do type and colour choices trace to a stated reason, not a default?
- Does contrast hold at 4.5:1 or better for text and meaningful UI, and can every control be reached by keyboard?
- Is structure (grouping, spacing, borders) telling the reader something true about relationship, not just decorating?
- Does any motion serve a purpose the user would notice if it were removed?
- Would this design move unchanged to a different product, brand or brief? If yes, what makes it specific has not been found yet.
- Are any strong markers present — a gradient-hero-plus-three-cards shape, emoji icons, invented numbers, fake testimonials? A single strong marker is enough to flag.
- Do two or more weak markers overlap in the same place — rounded corners, soft shadow and centred text together, for instance?
- Does copy inside the design follow the antislop pack for its language, free of vague-verb filler and manufactured urgency?
- For a revision: does the preservation contract hold — same function, same data, same accessibility, same brand tokens, same routes and handlers?

## Editorial Review

Do not close out a design meant for a real audience — a shipped screen, a
deck someone will present, a poster someone will print — on the writer's own
judgment alone. Bind a `review` check to the design in a scenario:

```yaml
- id: dashboard-review
  then: the dashboard passes the markup reviewer and the art director
  check: { type: review, pack: design, path: out/dashboard.html, contract: out/brief.md, screenshot: out/dashboard.png }
```

- `path` is the file or directory under review; `contract` is the design brief; `screenshot` is optional and, when given, is a rendered image of the result.
- The harness runs `reviewers/design/1-markup-reviewer.md` first, and only on a pass runs `reviewers/design/2-art-director.md`. A stage passes only when the entire response is exactly one line, `PASS`.
- **The harness renders nothing.** It has no browser and no screenshot tool. A screenshot, when the review needs one, is produced by the project's own tooling (a build step, a headless-browser script, a design tool export) in an earlier scenario, and handed to the check by path. Without a screenshot, the art director judges the source directly.
- If the same failure repeats twice, stop at `needs-human` rather than guessing at a fix the reviewer did not ask for.

This mirrors the two-stage independent review in `antislop-en`'s
[Independent Editorial Review](../antislop-en/references/editorial-review.md) —
a different agent judges, the writer does not self-certify, and a reviewer
returns only `PASS` or a `REJECT` list, never a rewrite.

## Pitfalls

- Do not treat a design plan as a formality to write after the fact to justify code already written. Write it first; let it change what you build.
- Do not ban a CSS property. A gradient, a rounded corner and a shadow are tools; the catalogue names the *pattern of default use*, not the property.
- Do not skip states to ship faster. A design with no error state or no empty state is not finished, even if the populated screenshot looks right.
- Do not add a stat, a testimonial or a number to "fill out" a design. An empty space is honest; an invented number is not.
- Do not apply motion uniformly because a library makes it one line to add. Every animation should be traceable to a purpose a user would miss if it were gone.
- Do not let the art director judge a screenshot that was never actually produced. If no screenshot is given, say the review judged source only.
- Do not confuse "distinctive" with "one of the five named aesthetic clusters." Warm minimal, dark neon, broadsheet, SaaS card kit and template chrome are looks, not proof of a decision — they are slop exactly as often as the generic-default shapes are.
- Do not let a revision's preservation contract be an excuse to leave an accessibility or contrast defect in place; "preserve function and data" does not mean "preserve every existing property untouched."
