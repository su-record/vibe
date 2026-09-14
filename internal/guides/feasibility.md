# Resolve a consequential capability unknown

Use only when a requested integration or proposed approach depends on an uncertain capability, or a failed experiment has an ambiguous meaning. Reuse existing evidence before testing. Routine edits need no feasibility stage, extra reviewer or report template.

State the specific claim and the boundary it crosses: for example, whether this installed client can call this service with these permissions. Record the relevant version, environment and source beside the finding. Distinguish documented support, directly observed behavior and inference. A claim may be supported, conditional, unsupported or still unknown. Missing documentation does not establish impossibility; success on one version does not establish all-version support.

Choose the cheapest experiment that could change the decision. Define the expected observable result and a bounded time, retry and spending limit before execution. Check local prerequisites before invoking expensive or mutating operations. A mock can test local handling but cannot prove the connection it replaces. Use the real boundary when claiming integration works, and a meaningful negative or recovery control when that risk matters. Reuse the existing verification guide and checks; do not add another verdict store.

Interpret the experiment from its observations:

- Not executed: preparation, help output or a proposed command only.
- Blocked: credentials, access, dependency or environment prevented the experiment.
- Invalid: the setup or assertions could not test the claim.
- Inconclusive: execution produced insufficient or ambiguous evidence.
- Supported or refuted: observations actually address the bounded claim.

A 401 response usually shows an access obstacle, not that an API capability is impossible. An exit code or well-formed JSON alone does not prove the promised outcome. A reproduced candidate failure is not the root cause of the user's incident until evidence connects them. Report what was observed and what remains unknown; never silently promote an inference into a confirmed fact.

Continue on the supported path, try one materially different bounded experiment when justified, or identify the specific missing access/input. Do not repeat identical attempts without a changed premise. Keep the finding in the existing task note or evidence, with source and scope; do not require four intermediate reports.

When another person or environment must run the result, provide the exact working directory, prerequisites, relevant versions, commands, expected output and recovery steps. Identify commands actually executed separately from instructions merely prepared. Validate references and prerequisite results against the underlying evidence; matching a schema is not proof of readiness. Omit a separate handoff package when the current FDE can finish the work itself.
