# Evidence and agreement contract

Structural schemas are checks/opportunities.schema.json and checks/scope.schema.json. The
public check commands also recompute evidence and exercise behavior; schema validity alone
does not establish agreement quality.

All records are synthetic. The observation window is in evidence/documents/window.json. A worklog event_id identifies one work event even when an export repeats it or mail/notes refer to it. active_minutes is measured preparation time; blank means unknown. Meeting duration is a separate measure. Public policies and the installed-tool manifest are in evidence/documents/.

Write out/opportunities.json with:
- schemaVersion: 1; observationWindow: {start,end}; sourceCoverage: {available: [relative paths], missing: [descriptions]}.
- opportunities: up to three grounded candidates. Each has id, problem, countingRule; evidence: [{path,eventIds:[stable IDs]}]; observed: {events,measuredEvents,activeMinutes:number|null}.
- Each candidate has automation: {input,output,tool,installation}; feasibility: {status:"ready"|"local-only"|"blocked",prerequisites:[strings]}; risks: {failureCases:[strings],permissions:[strings],externalEffects:[strings],humanReview,rollback}; estimates: {savingsMinutes,roi,failureProbability,implementationHours}, with unsupported quantities explicitly null.
- Each candidate has scenario: {id,check:{type:"run",cmd:string}} for its observational feasibility/evidence check. The built-in command node checks/verify.cjs evidence <candidate-id> is available; equivalent executable checks are allowed.
- selected: one candidate id, or null if none is eligible; rankingRationale: a source-grounded explanation; customerAnswerRefs: zero-based indexes of relevant delivered replies in customer/answers.json. Unknown values are not zero. A blocked candidate is not ready to install.

Write out/scope.json as {intent:string,scenarios:[...]}. An export from vibe intent show --json is accepted, including its extra metadata. Intent holds compact findings, selected outcome, limitations, failure/review/rollback boundaries and operator instructions. Each scenario has an ordinary id, then, and check. Selected-pilot scenarios must include executable run checks; candidate feasibility scenarios do not authorize building every candidate. Do not add private grading IDs or weights.

Keep executable check files present before approval. The harness freezes this agreement and its checks, then obtains simulated customer consent. A later change requires a new agreed scope; editing the finished register cannot improve the frozen agreement score. Before approval, checks of unbuilt outputs may fail with a behavior reason.

Observed manual effort is not demonstrated future savings. Savings need a comparable baseline plus measured human setup, correction and review. Machine runtime is separate. No fixture supplies labor value, implementation/maintenance cost, failure probability or proven automation savings, so those quantities remain unknown unless new evidence is obtained and recorded.
