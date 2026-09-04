---
name: antislop-en
description: A writing skill that strips AI clichés and translationese and writes, diagnoses, revises and converts English prose to fit its purpose, reader and genre. Use it for statements and addresses, print columns, news articles, reports, broadcast and video scripts, technical documents, blog posts and other English output meant for a person to read or hear.
metadata:
  tags: [writing, english, editing, composition]
  category: content
---

# English Writing Skill (antislop-en)

`antislop-en` is a **general-purpose English writing skill**. It does not
imitate one person or one register. It chooses English that fits the
purpose, reader, medium and genre at hand.

## When to Use

- Writing a new piece from scratch.
- Diagnosing a draft without changing it.
- Revising only what needs to change while preserving facts and intent.
- Converting a piece into a different length, medium or genre.
- Rendering a foreign-language original into English free of translationese.

Apply it by default to any request that creates or fixes English prose. Do
not apply it to code, structured data, search queries or classification
output — anything that is not meant to be read as prose.

Treat "write" as authoring, "look this over" or "assess" as diagnosis, "fix"
or "polish" as revision, and "convert" or "rewrite as" as conversion. Do not
attach a diagnostic table or a description of your process that the user did
not ask for; lead with the finished piece.

## Prerequisites

No separate program or credential is required. For requests that need a
current usage or style-guide ruling, be able to consult a named dictionary
and the relevant style guide (for example Merriam-Webster and AP, or the
Oxford English Dictionary and Chicago).

## How to Run

Apply this automatically to requests that write, diagnose, revise or convert
English prose. If it must be called explicitly, invoke `/antislop-en` and
supply purpose, reader, genre, evidence and required format together.

For work with high rejection cost — a manuscript bound for a reporter,
columnist or chief editor — draft first, then read
[Independent Editorial Review](references/editorial-review.md) in this
skill's `references/editorial-review.md`, and bind a `review` check to the
manuscript in a scenario so the harness (`vibe check`) runs `en-copy-editor`
and then `en-chief-editor`. Do not treat the piece as final until both
reviewers PASS.

## Quick Reference

When producing or fixing English that a person will read, hold to the
following.

- Preserve facts, figures, quotations, uncertainty and the source's meaning and form first. Do not add facts, scenes, feelings or quotations that are not there.
- Before writing, fix the purpose, reader, medium, voice and boundary of evidence, then pull from the material only the facts, scenes, judgments and terms that belong to this piece. Build the frame from those alone.
- Open with a specific subject, event or issue. Do not fill space with era-defining statements, claims about the topic's importance, or previews of what you are about to say.
- Give each paragraph one central judgment and connect it by a real relationship — fact to interpretation, claim to evidence, problem to decision. Do not fake a relationship with a connective.
- Every sentence must add a new fact, judgment, piece of evidence, condition, action, scene, or a connection the reader needs. Delete a sentence that would fit any topic, restates what came before, or is empty enthusiasm.
- Make the actor, the party responsible, the timeframe, the condition, the basis of comparison and the referent of every pronoun explicit. Write sentences where subject and verb agree and modifiers sit where they belong.
- Prefer concrete verbs. Unwind unnecessary nominalisation, passive voice and translationese, but keep legal and academic terms of art, proper nouns, code and settled technical vocabulary.
- Do not write `not X but Y` where there is no real contrast, unsupported superlatives and value judgments, mechanical tricolons, sentences of uniform length and ending, or slogan-style closings.
- Hold to the genre's unit of information and pacing. A statement or address is about responsibility and commitment; a print column is about a stance and its argument; a broadcast script is about words understood on first hearing.
- For a piece bound for submission, lock the outlet, reader, length, thesis, evidence, the author's standing and the house style first. Do not invent an editorial policy nobody has stated.
- Do not leave a sentence the editor must take on faith, a jump from evidence to conclusion, a pronoun with no antecedent in context, or a paragraph that duplicates the one before it.
- For a report going to an expert, make conclusion, standard of judgment, evidence, limits and next action traceable to one another. Do not perform confidence or authority the material does not support.
- After a draft, run three quiet passes: (1) facts, conditions and form preserved; (2) each sentence's contribution of information; (3) clichés, translationese and repeated rhythm. Deliver the finished piece without narrating the passes.
- When context, thesis, evidence or submission specification is too unclear to safely close the gap, stop at `needs-human` instead of pretending the draft is finished.

## Procedure

### Editorial contract

Before writing a piece for outside submission, fix the following as internal
working ground.

1. **Placement**: outlet, page/screen/audio, the section's character and length.
2. **Reader and payoff**: what the reader already knows, what they need to learn, what they will judge after reading.
3. **Thesis**: the core judgment stated in one sentence, and the counter-evidence that could overturn it.
4. **Evidence**: the line between sourced fact, figure and quotation, and the author's own interpretation or experience.
5. **Voice**: the author's standing, their distance from the subject, register, and the range they may assert.
6. **Editorial format**: how headline, subhead, subheadings, quotations, numerals, proper nouns and sourcing are marked.

When a style sheet or recently published pieces from the outlet are given,
they take priority over general principles here. If they conflict, or a key
item is missing and the outcome would change substantially, ask once. Do not
label a draft submission-ready while that answer is still outstanding.

Do not close out a piece for outside submission with only the writer's own
review. Read
[Independent Editorial Review](references/editorial-review.md) in this
skill's `references/editorial-review.md` and use a `review` check so the
harness runs `en-copy-editor` and `en-chief-editor` as separate reviewers. If
neither the harness nor an agent is available, do not claim independent
review took place — say instead that human editorial review is needed before
final submission.

### 1. Lock first

Confirm the following before writing. Set reasonable defaults for anything
not given, and ask only about the ambiguity that would materially change the
result.

1. Purpose of the piece: notice, explanation, persuasion, record, narrative or dialogue.
2. Reader: what they already know, and what they need to decide or feel.
3. Genre and medium: article, report, speech, fiction, script, technical document, post, and so on.
4. Boundary of evidence: how confirmed fact, quotation, estimate and example are distinguished.
5. Format: length, register, headings, lists, tables, markdown, any call to action.

If a brand voice or a particular person's voice is specified, follow it. If
not, the piece's purpose and genre decide the voice.

### 2. Quality priorities

Judge in the following order. Do not damage an earlier condition to gain a
later advantage.

1. **Truthfulness and meaning**: facts, conditions, figures, quotations and uncertainty are preserved.
2. **Fit for purpose**: it is clear what the reader should know and do after reading.
3. **Structure and logic**: the order of information, each paragraph's center, and the relation of evidence to conclusion are visible.
4. **Sentence accuracy**: agreement, reference, modification, tense and punctuation are correct.
5. **Naturalness of expression**: the reader understands it immediately, in ordinary English word order and vocabulary.
6. **Rhythm and voice**: pace, emphasis, repetition and pause fit the genre.

A short sentence is not always better, nor a long one always worse. Split a
sentence when it carries two different judgments or its modification becomes
unclear. Join short sentences when the same beat, repeated, starts to read
like a list of notes.

### 3. English sentence principles

**Agreement and reference**

- Check that subject and verb agree, and that every pronoun has a clear antecedent — especially across a long or interrupted sentence.
- Do not let a pronoun's referent drift when the subject of a paragraph changes. Name the actor again if the antecedent could be read two ways.
- Keep a consistent point of view and tense inside one passage. Mark a shift in time or perspective explicitly rather than letting it happen mid-sentence.

**Modifiers and structure**

- Place a modifier next to what it modifies. A dangling or misplaced modifier — "Having finished the report, the meeting began" — attaches the action to the wrong actor; rewrite so the modifier's subject is the sentence's subject.
- Keep parallel structure in a list, a pair joined by "and"/"or", or a comparison: matching grammatical form for matching logical role ("to plan, to build, and to ship," not "to plan, building, and for shipping").
- Give one sentence one central judgment. Attach exceptions and conditions close enough to the term they qualify that a reader can tell what they apply to.

**Nominalisation, passive voice and hidden agents**

Notice these patterns and check whether they hide who is doing what, before
cutting them automatically:

- A weak verb paired with an abstract noun standing in for a real verb — "provide support" for *support*, "make a decision" for *decide*, "conduct an investigation" for *investigate*.
- Chains of `-tion`/`-ment`/`-ance` nouns stacked into one noun phrase — "the implementation of the recommendation for the reduction of emissions."
- Passive voice that drops the actor when the actor matters — "mistakes were made," "the request was denied" — versus passive used deliberately because the actor is unknown, unimportant, or already established.

Unwind these into an active verb with a named subject when responsibility or
action is the point. Keep a nominalisation that names a settled legal,
academic or technical concept precisely.

**Hedging and throat-clearing**

- Cut phrases that announce a sentence instead of making it: "it is important to note that," "it should be mentioned that," "needless to say," "arguably."
- Cut era-defining openers that could preface any topic: "in today's fast-paced world," "in an increasingly connected society," "since the dawn of."
- Keep a hedge only when the uncertainty is real and specific — a stated confidence level, a named limitation — not as a reflex softener.

**Spelling, style guide and punctuation**

- Pick one spelling variant, US or UK, and hold it for the entire piece — not "colour" in one paragraph and "color" in the next.
- Pick one named style guide (AP, Chicago, or a stated house style) and follow its rules for numerals, dates, titles and citation for the whole piece.
- Decide the Oxford comma once and apply it consistently throughout, unless the house style forbids it.
- Write numerals and dates the way the chosen style guide specifies, and do not switch conventions partway through.
- Use quotation marks, dashes and hyphens the same way throughout one document.

**Vocabulary and loan phrases**

- Prefer a concrete verb and a specific noun over an impressive-sounding abstraction.
- Use an evaluative word — "clearly," "significantly," "innovative" — only when the evidence in the piece supports it.
- Keep a term consistent once chosen; do not rename the same thing with a rotating set of synonyms for variety's sake.
- Judge a loanword, a piece of jargon or an industry term by whether the intended reader will understand it, not by where it came from. Keep a settled technical term or proper noun as is; gloss an unfamiliar one briefly on first use.

### 4. Paragraphs and structure

- Give one paragraph one central idea. The opening sentence or the surrounding context should make that center identifiable.
- Follow a claim with whichever of evidence, example, figure or observation the claim needs.
- Use a connective only when the relationship between paragraphs actually changes. Do not decorate with "also," "meanwhile," "therefore" out of habit.
- Distinguish the order the reader needs from the order the writer discovered things in.
- Open by stating the subject and the reader's reason to keep reading. Do not force attention with an inflated question or a grand declaration.
- Close with a conclusion, a judgment, a resonant detail or a next step — not a slogan restating what was already said.

Use a persuasive formula only when the purpose calls for it. Do not
automatically insert an advertising problem–agitate–solve structure or a
call to action into a news article, a meeting record, a report or an
explainer.

### 5. Rhythm and voice

- Vary sentence length and ending to match the weight of the content.
- Keep deliberate repetition when it serves emphasis, memory or a rise in feeling.
- If the same contrastive construction, tricolon or flat declarative ending recurs as a habit, resolve it into a different relationship.
- Read aloud and fix where breath runs out, where a break falls with no relation to meaning, and where consecutive sounds clash.
- An author's voice comes from choice of observation, vocabulary, distance and rhythm, not from one sentence length or one catchphrase.

## Pitfalls

### The test for stripping AI clichés

An AI cliché is not a specific word. It is **a sentence that could be
attached anywhere without evidence**. Find and fix these in this order.

1. Check each sentence for the role it plays in this piece. Delete it if it adds no new fact, judgment, evidence, condition, action, scene, or needed connection.
2. Delete an opening or closing that would hold with the topic swapped out. Rewrite phrases like "in today's world," "now more than ever," "this has significant implications for us" only when there is a specific fact or judgment to replace them with.
3. Unwind a contrast, tricolon or connective that has no real logical relationship behind it. Don't force artificial asymmetry either — follow the actual shape of the thinking.
4. When abstract nouns and evaluative words pile up, state who did what and what changed. Don't fill the gap with stronger language when there is no evidence.
5. Do not flatten every sentence into one smooth register. Preserve a source's way of observing, its distance, its field-specific vocabulary or deliberate rhythm where it exists.
6. Cut sentences that narrate the piece's own progress — "this piece will examine," "as we have seen," "in conclusion, we can see that" — unless the reader genuinely needs them as signposts.
7. For a sentence ending in "is important," "is necessary," "is expected," "is noteworthy," state who judges that and why, and what changes as a result. Delete the sentence if there is no evidence to state.
8. If neighboring paragraphs all share the same claim–explain–emphasize shape, or every sentence ends at a similar length, merge or split them to match the actual weight of the ideas. Don't randomize sentence length for its own sake.
9. Use a heading or subheading only when it classifies content or advances the argument. Don't chop a short piece into fragments, and don't repeat the heading's wording in the first sentence beneath it.

Do not apply a banned-word list mechanically. The same phrase can be correct
when it states a real relationship or the genre requires it. The test is
whether the sentence adds real content to the piece, not whether a
particular word appears.

**A catalogue of English AI-cliché patterns** — fix these only when there is
no real logic or rhythm behind them, not as a list of forbidden words:

- Vague-verb filler: "delve into," "navigate," "unlock," "unpack," "harness the power of."
- Metaphor-of-the-month nouns used as empty scaffolding: "tapestry," "landscape," "journey," "ecosystem."
- The false-contrast frame repeated without a real contrast: "it's not just X, it's Y."
- Mechanical tricolons of adjectives with no distinct content: "innovative, dynamic, and forward-thinking."
- Em dash overuse as a substitute for choosing the right connective or punctuation.
- Era-defining openers: "In today's fast-paced world," "In an increasingly digital age."
- Slogan-style closings that restate the piece instead of ending it: "Ultimately, ...," "At the end of the day, ..."
- Manufactured significance with no named source: "This is a testament to," "This speaks volumes about," "game-changer," "a paradigm shift."
- A rhetorical question used as an opener to manufacture urgency: "Have you ever wondered...?"
- A stock transition into the body that adds nothing: "Let's dive in," "Without further ado."

Read the relevant section only of
[Genre Writing Guide](references/genres.md) when a genre-specific judgment is
needed.

## Procedure by Task

### Write

1. Lock purpose, reader, evidence and format.
2. Set the order of information the reader will follow.
3. In the first draft, do not leave out content.
4. Revise in order: paragraph, sentence, vocabulary, rhythm.
5. Check meaning and form against the source.

Do not manufacture a plausible-sounding fact, figure, quotation or
experience the evidence does not contain. Keep an illustrative assumption or
example clearly separate from actual fact in the opening and conclusion.

After the first draft, revise exactly four more times. First, find missing
facts and logical leaps. Second, fix paragraph order and center. Third, fix
agreement, reference, modification and vocabulary. Fourth, read aloud and
smooth rhythm and clutter. If a later pass would damage the accuracy an
earlier pass established, revert it.

### Diagnose

Do not change the source. Answer in this order.

- What to preserve.
- Findings: severity, exact location, effect on the reader, reason to change it.
- What a human must decide.
- Overall verdict.

Separate taste from error. Do not flag a problem you cannot pin to a
location and a reader effect.

### Revise

- Keep what is already accurate and natural.
- Be able to state the problem each change solves.
- Do not swap a synonym, split a sentence or change punctuation only to look different.
- Stop at `needs-human` when the ambiguity is too great to safely settle fact or intent.

### Carry over from another language

Do not trace the shell of the foreign sentence. Rebuild it by unit of
meaning. The order of information and sentence boundaries can change, but
keep facts, logic, conditions, attitude and the precision of technical terms
intact.

## Preservation Contract

When there is a source or written brief, do not add, remove, strengthen or
soften the following.

- Facts, quotations, the author's stance and stated uncertainty.
- Numbers, dates, versions, units, comparisons and conditions.
- Commands, paths, URLs, error codes, product names and identifiers.
- Exceptions, limits, risks, approvals, how to roll back and next actions.
- The actor, owner, handoff relationship and publishing authority.
- Requested document structure: heading levels, lists, tables, links, code blocks.

Compare the revision against the source afterward. Do not use a revision
that an automated check or a meaning audit rejects. Do not record a failure
as "no change needed."

## Verification

- Are the facts and meaning inside the evidence given?
- Do the sentences and structure show the purpose, reader and genre?
- Are the actor, condition, referent and agreement of each sentence clear?
- Does each paragraph have a center, and does it connect to the one before and after?
- Where clearer, more natural English was available, was a loanword or jargon used out of habit instead?
- Is a settled technical term or proper noun left alone rather than forced into a substitute?
- Do sentence length, ending, contrast and listing avoid falling into one repeated mold?
- Are every requested fact, figure, address, code block, markdown element and approval condition still present?
- Would the opening and closing sentence fail to hold if dropped into a piece about a different topic?
- Does each sentence actually add information or judgment the previous one lacked?
- After the showy evaluative words are removed, is there still enough fact and logic left standing?
- Do paragraph length and sentence ending repeat as a mold rather than because the content calls for it?
- Do the headline, opening, body and closing avoid repeating the same claim in different words?
- Can every pronoun's antecedent and every judgment's source and basis be found immediately?
- Is there a sentence or paragraph an editor could delete without changing the information or the argument?
- Can you trace from conclusion back to evidence, and from figure or quotation back to source?
- Have the outlet's length, formatting and tone rules been confirmed? If not, has that gap been stated rather than hidden?
