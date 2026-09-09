# Dialogue follow-up — pre-registered before new measurements

The earlier anomaly sweep remains a failed result: Codex off averaged 3.0 checks, on 2.4, scoped 1.8; Claude's three arms all scored 3.0. This experiment changes the opportunity to answer a legitimate question and the harness's next-step instructions. It does not relabel or replace the earlier observations.

## Changes and measurements

- Anomaly now has two planned sessions for every arm and a fake user that supplies the rules in docs/finance.md between sessions. Measure five new attempts for Claude and Codex in each of off, on, and scoped.
- Ask rejects report statements without question punctuation, options, or needs; DONE directs the agent to chat; an answered inbox question names remaining scenarios and their files. Measure five new attempts for Claude and Codex in both off and on. Ask remains retired from the release direction set; its quality, turns, and usage are reported as a diagnostic comparison.
- Discover reads relevant workspace documents even when the brief omits them, and states profile anomalies before asking questions.
- A recorded unanswered inbox question with none of the task's declared outputs is `stalled`. Report that count per arm; exclude it from quality averages and completed pairs, while retaining unpaired resource cost. Do not discard a wrong or partial output, an error, or an inconvenient attempt. Do not backfill a stalled attempt with an older success.

Use the configured default client models, five attempts per client/arm, and three concurrent attempts at most within each arm. Preserve the existing overhead, context, session-split, and handover measurements. Record all new rows in a separate follow-up ledger; create a combined snapshot for the release gate without altering the older source ledger.

## Verdict rules

The committed release gate is unchanged in its quality, token, time, and turn thresholds: every required task/client needs five usable latest attempts in every required arm. Anomaly must separate on at least one client, neither on nor scoped may regress against off, and on turns must be at most twice off. If all arms reach 3/3, the task still does not separate and the release gate still fails. A passing usability change does not establish a performance advantage.

Report paired two-arm ledger verdicts and absolute quality means. No saving or release readiness is assumed before the runs. Do not start a favorable rerun merely to obtain a passing result; incomplete or failed measurements are reportable outcomes.
