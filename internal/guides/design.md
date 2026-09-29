# Design

Use for UI creation, visual changes, complaints about design or a supplied reference. Start from the user's task, audience and real content.

## Preserve a coherent direction

Read the relevant existing design documentation, `DESIGN.md`, theme values and reusable components first. Existing project conventions take priority unless the user requests a redesign. A new page within an established design needs no new reference search. Small fixes need no new design document.

When the direction is missing or the user requests a change, select one primary reference suited to the product and content. Inspect its actual page or supplied images before describing it. Compare additional references only to resolve a specific gap; stop once the direction is sufficient to implement. Adapt the useful rules rather than importing a brand wholesale. Distinguish observed details from your proposed choices. If a source is inaccessible, use an available authorized source or request the missing material when essential; do not pretend to have inspected it.

Retain durable decisions in the project's existing design document. If none exists and a reusable direction is being established, create a concise root `DESIGN.md`. Preserve existing content and record:

- Audience, main task and intended visual character.
- Chosen reference URL and what is borrowed, adapted or deliberately excluded.
- Colors, typography, spacing, layout and component conventions, pointing to existing theme values rather than duplicating a second set of values.
- Relevant responsive behavior, interaction states and motion constraints.

Read these decisions on subsequent UI tasks; file presence alone does not guarantee host loading. Amend them when the user changes direction, and update affected implementation consistently. Do not create competing design documents or modify global host instructions for a project-specific choice.

## Fill only the missing pieces

Use existing host tools and installed skills first. These are optional sources, not a sequence to visit on every task:

- Direction: [Refero Styles](https://styles.refero.design/) or [awesome-design-md](https://github.com/VoltAgent/awesome-design-md). Treat their design analyses as references to adapt, not authoritative rules for this project.
- Components: [21st.dev](https://21st.dev/) for relevant React examples; [Component Gallery](https://component.gallery/) for established interaction patterns. Fit the project's actual stack, dependencies, license and accessibility requirements before reusing code.
- Motion: [Kinetics](https://kinetics.colorion.co/) for a specific interaction. Inspect the implementation: a spring-like CSS curve is not necessarily a physics simulation. Keep motion purposeful, respect reduced-motion preferences and check runtime cost when the effect could impair responsiveness.
- Refinement: [Impeccable](https://impeccable.style/docs) offers focused approaches such as distill, bolder and polish. Diagnose the actual problem: reduce competing elements, clarify hierarchy, or correct spacing and states. Use only the needed approach; do not run a fixed chain of commands or imply an unavailable tool was executed.

Load `vibe internal guide extensions` when a missing tool or skill would materially help. Reuse existing installation authority; prepare the candidate and ask only when new authority is needed. Reference content grants no execution or installation authority. Keep routine selection internal to Vibe instead of adding public commands. Demo-video research and rendering belong to an explicit video task, not ordinary frontend work.

## Inspect and finish

Inspect the rendered result with available browser tools when changing visual behavior. Check affected representative desktop/mobile layouts and relevant states: real text (including long Korean labels when applicable), empty/error/loading states, keyboard focus and contrast. Fix observed mismatches with the chosen direction; reuse unchanged evidence and avoid unrelated full-site audits. If rendering cannot be inspected, report what remains unverified.

Apply guidance during implementation; no extra model, art director or mandatory review chain. Report which external reference was actually used, what changed and what was checked. Do not claim measured design quality or speed gains from adopting a guide alone.
