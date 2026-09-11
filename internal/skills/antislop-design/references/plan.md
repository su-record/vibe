# Design Plan Template

Fill this out before writing any markup or CSS. Keep it short — a paragraph
or a few lines per section — and revise it once against the last question
before building from it. The plan is working ground, not a deliverable; drop
it from the final output unless the brief asked to see it.

## 1. Brief

State in one or two sentences what this is, who asked for it, and what
"done" looks like. Quote the actual request rather than paraphrasing it into
something generic.

> Example: "A shift roster for a hospital ward, used by charge nurses to
> check who is on and swap shifts."

## 2. Users and frequency

Name who looks at this, and how often and for how long each time. A screen
checked twenty times a day for a few seconds needs a different design than
one read once for ten minutes.

> Example: "Charge nurses, roughly twenty times per shift, glancing for a
> few seconds at a time on a desk monitor."

## 3. Task

Name the one thing this screen is for. If there is more than one candidate,
pick the one that happens most often or matters most when it goes wrong.

> Example: "See who is on shift right now and who is on call next."

## 4. Density

Given the frequency and task above, decide how much shows at once: more
information with less chrome for a frequent, brief-glance screen; more
explanation and fewer items for an infrequent, unfamiliar one.

> Example: "High density: the full week's roster fits on one screen with no
> scrolling, at a size legible from arm's length on a desk monitor."

## 5. Hierarchy

State what is seen first, second and third, and why that order matches the
task in section 3 rather than what was easiest to make prominent.

> Example: "First: who is on right now, highlighted. Second: who is on call.
> Third: the rest of the week, in a lower-contrast grid."

## 6. Type

Name the typeface(s) and the reason for each — not "looks clean," but a
reason tied to the content (numeral legibility at a distance, a display face
that matches an existing brand mark, a monospace for aligned data).

> Example: "One typeface, a grotesque with strong numeral distinction, for
> both headings and body — no display face needed at this density."

## 7. Colour tokens

List four to six named tokens with hex values, each tied to a role and a
source (the brand's existing palette, or the content itself — a status
colour that already means something to this user).

> Example: `bg #0B1220` (screen background), `surface #16202E` (roster
> cells), `text #E7ECF3`, `accent-on-shift #3FB27F`, `accent-on-call #E0A930`,
> `danger-gap #E05252` (an uncovered slot).

## 8. Layout sketch

Draw the layout in ASCII. This is the step that catches a generic default
before it becomes code — if the sketch could belong to any dashboard, redo
it around the actual content.

```
+----------------------------------------------------+
| Ward 4B  ·  Wed 10 Sep            [ Swap ] [ Print] |
+----------------------------------------------------+
| NOW ON SHIFT           | ON CALL NEXT               |
| J. Alvarez  R. Singh   | M. Cho                     |
+----------------------------------------------------+
| Mon  Tue  Wed  Thu  Fri  Sat  Sun                   |
| ---------------------------------------------       |
| AM   [names in cells, one row per nurse]             |
| PM   [ ...                                ]          |
| Night[ ...                                ]          |
+----------------------------------------------------+
```

## 9. States

List what the layout must handle beyond the populated, average-length case:
empty, loading, error, long text (a long name overflowing a cell), many
items (more nurses than rows fit), one item (a ward with two nurses total),
and a narrow viewport.

> Example: "Empty slot shows a dashed outline and 'unfilled,' not a blank
> cell. A name too long to fit truncates with a tooltip, never wraps and
> breaks row height. Fewer than four nurses still fills the width without
> stretching cells absurdly wide."

## 10. Motion

State what, if anything, animates, and the purpose each animation serves. If
nothing needs to animate, say so.

> Example: "A swapped shift briefly highlights the changed cell for two
> seconds so the nurse who made the change can confirm it landed. Nothing
> else animates."

## 11. Copy

Note the voice and note that in-design copy follows the antislop pack of its
language (`antislop-en` or `antislop-ko`) — labels are specific to the
action, not a generic "Get started."

> Example: "Button labels name the action: 'Request swap,' not 'Get
> started.' No greeting copy; the nurse's name appears only where needed for
> identification."

## 12. What would make this generic — and the answer

Name the part of this plan most likely to be the default anyone would
produce for a similar brief, and state what makes it specific here instead.
If nothing survives this question, revise the plan before building.

> Example: "The three-column week grid could be any scheduling app. What
> makes it specific: the NOW/NEXT band above it, sized and coloured for a
> glance from across the nurses' station, which no generic scheduling
> template includes because it assumes a mouse and a close read, not a desk
> monitor checked in passing."
