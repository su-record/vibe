# Design Slop Catalogue

One row per marker. "Strength" follows the skill's tiers: a strong marker is
enough on its own; a weak marker only counts when two or more overlap in the
same passage or component. Do not run this as a list of banned properties —
each alternative names what to decide instead, not a substitute default.

| Marker | What it looks like | How it shows in markup/CSS | Strength | Alternative |
|---|---|---|---|---|
| Purple/indigo gradient hero + three cards | A full-width gradient banner headline over exactly three identical rounded feature cards | `background: linear-gradient(135deg, #667eea, #764ba2)` on a hero, followed by a three-up grid of cards with matching `border-radius` and `box-shadow` | Strong | Pick a hero built from the actual content (a product screenshot, a real number, a specific claim) and let the feature count and layout follow what there actually is to say, not a fixed three. |
| Gradient text | Headline text filled with a gradient instead of a solid colour | `background: linear-gradient(...); -webkit-background-clip: text; -webkit-text-fill-color: transparent;` | Strong | A solid brand colour or the default text colour, sized and weighted for hierarchy instead. |
| Glass panels | Frosted, translucent panels floating over a background | `backdrop-filter: blur(...)` or `-webkit-backdrop-filter` on a panel with no real content behind it to blur | Weak (strong if the blur has no functional layering reason at all) | A solid or lightly tinted surface token; reserve blur for an actual overlay (a modal above real scrolling content). |
| Emoji as icons | 👋 🚀 ✨ 📊 standing in for an icon set | Emoji code points inside `<h1>`–`<h3>`, `<button>`, or `<li>` markers | Strong | A real icon set (SVG sprite or icon font) sized and coloured to match the type, or no icon at all. |
| "Welcome back 👋" greeting | Familiar tone asserted by copy instead of earned by relationship | Literal string in a heading or banner component | Strong | A greeting that states something the product actually knows (last visit's actual result, an actual pending item) or no greeting at all. |
| Stat tiles with invented numbers | "10,000+ users," "99.9% uptime," "4.9★" with no source | A stat-tile or metric-card component populated with placeholder numbers not wired to real data | Strong | Wire the tile to a real number, or leave the section out until there is one to show. |
| Fake testimonials | A quote attributed to a generic name and title | A blockquote or card with `"Jane D., Product Manager"` or similar invented attribution | Strong | A sourced quote with permission, or no testimonial section. |
| Sparkles | ✨ marking a feature as "AI" or "new" | The sparkle glyph or icon next to a label, with no other signal of novelty | Strong | State plainly what changed or what the feature does; let the copy carry the claim. |
| Fade-and-slide-up on every section | Every section animates in on scroll, identically | A class like `animate-fade-up`, `data-aos="fade-up"`, or an IntersectionObserver applied uniformly to all `<section>` elements | Strong (when applied to every section with no distinction) | Reserve entrance motion for the one or two moments where it helps orientation (a hero, a state change); let the rest render at rest. |
| Hover-lift on every card | Every card rises and gains shadow on hover, whether or not it is interactive | `hover:-translate-y-1` (Tailwind) or `transform: translateY(-4px)` on `:hover` applied to non-interactive cards | Weak (strong if applied to a card that is not clickable at all) | Apply a hover state only to elements that respond to a click or a link; a static display card gets no hover treatment. |
| One typeface for everything | Inter or the system stack used for display, body and caption alike | A single `font-family` declaration (or none, falling back to `-apple-system, ...`) with no second family anywhere in the file | Weak | One or two typefaces chosen for a reason — a display face for identity, a distinct text face for long-form legibility. |
| Everything centred | Headings, paragraphs and forms all `text-align: center` | `text-align: center` repeated across unrelated element types, or a centred flex/grid container used for body copy | Weak | Left-align body copy and forms for reading flow; reserve centring for short, standalone elements (a hero headline, an empty state). |
| Gray-on-gray low contrast | Body and secondary text both land in a narrow mid-gray band | Two `color` values within a few percentage points of lightness, e.g. `#9CA3AF` next to `#A1A1AA` | Strong (it is a contrast failure, not a taste question) | Push text colour to a value that measures at least 4.5:1 against its background; reserve the lighter gray for genuinely de-emphasised metadata only. |
| Uniform spacing with no rhythm | Every gap is the same one or two values regardless of grouping | A design system or utility classes using only `gap-4`/`gap-6` (16px/24px) everywhere, no larger gap between unrelated groups | Weak | A small set of spacing tokens used deliberately — a larger gap between sections than between related items within one. |
| Slop CTA copy | "Get started" repeated for buttons that do different things | Multiple `<button>`/`<a>` elements sharing the same label across a page | Weak (strong if the buttons trigger different actions) | Name what each button actually does: "Create your first roster," "View last week," and so on. |
| Vague-verb copy | "seamlessly," "unlock," "effortless," "empower" with no specific referent | Marketing copy inside headings or subheads | Strong | State the specific benefit and to whom, the way `antislop-en`'s catalogue treats vague-verb filler in prose. |
| Tracked all-caps eyebrow labels | Small uppercase label above every heading | `letter-spacing: 0.1em; text-transform: uppercase;` on a short label element, repeated site-wide | Weak | Use a label only where it classifies content the reader needs classified; vary its treatment instead of stamping it everywhere. |
| Middle-dot metadata | Metadata joined with `·` or em dashes | Literal `·` or `—` characters joining date, author, category strings | Weak | A layout (separate fields, an icon, whitespace) that shows the same grouping without relying on one punctuation glyph as the whole design system. |
| Uniform card-kit radius and shadow | Every card shares one `border-radius` and one soft shadow regardless of hierarchy | A single `rounded-2xl shadow-lg` (or equivalent) utility pair applied to every card-like container in the file | Weak (strong if it is the *only* structural device the layout uses to show grouping) | Vary radius and elevation by role — a primary surface, a nested item, an inline chip — or drop the shadow and let spacing do the grouping work. |

## The five named aesthetic clusters

These are complete looks, not single properties. Each is legitimate when the
brief calls for it and slop when it is reached for because it reads as
"designed."

| Cluster | Signature | Strength |
|---|---|---|
| Warm minimal | Warm cream background (near `#F4F1EA`), high-contrast serif display face, terracotta/clay accent | Strong when none of the three traces to the brief |
| Dark neon | Near-black background, single bright acid-green or vermilion accent | Strong when none of the three traces to the brief |
| Broadsheet | Hairline rules, `border-radius: 0` everywhere, dense multi-column text | Strong when applied to content that is not actually a publication |
| SaaS card kit | Identical rounded cards, one radius, one soft grey shadow, regardless of hierarchy | Strong when it is the layout's only structural device |
| Template chrome | Tracked-out ALL-CAPS eyebrow labels, middle-dot metadata, "WORD — fragment" label pattern | Strong when repeated site-wide with no variation |
