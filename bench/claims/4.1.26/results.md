# 4.1.26 discovery evidence

Protocol: fde-discovery-v1. Candidate revision: 28f7edaf7e38441da33b789c0cf8b65dae17387f.

Release objective: unmet. Evidence: incomplete. Deterministic indicators: not passed. Cost/customer burden: not passed.

These indicators do not measure the appropriateness of problem framing or tradeoff judgment.

6/60 planned attempts recorded; 0 usable. Errors: 6; stalled: 0. No failed attempt is replaced.

| Client / customer | Arm | Usable | Mechanical agreement coverage | Private pilot behavior |
| --- | --- | ---: | ---: | ---: |
| claude / status-first | off | 0 | unknown | unknown |
| claude / status-first | scoped-4.1.25 | 0 | unknown | unknown |
| claude / status-first | scoped-4.1.26 | 0 | unknown | unknown |
| claude / followup-first | off | 0 | unknown | unknown |
| claude / followup-first | scoped-4.1.25 | 0 | unknown | unknown |
| claude / followup-first | scoped-4.1.26 | 0 | unknown | unknown |
| codex / status-first | off | 0 | unknown | unknown |
| codex / status-first | scoped-4.1.25 | 0 | unknown | unknown |
| codex / status-first | scoped-4.1.26 | 0 | unknown | unknown |
| codex / followup-first | off | 0 | unknown | unknown |
| codex / followup-first | scoped-4.1.25 | 0 | unknown | unknown |
| codex / followup-first | scoped-4.1.26 | 0 | unknown | unknown |

| Client / customer | Arm | Critical omissions | Unsupported structured assertions | Grounded opportunities | Sources preserved |
| --- | --- | ---: | ---: | ---: | ---: |
| claude / status-first | off | unknown | unknown | unknown | unknown |
| claude / status-first | scoped-4.1.25 | unknown | unknown | unknown | unknown |
| claude / status-first | scoped-4.1.26 | unknown | unknown | unknown | unknown |
| claude / followup-first | off | unknown | unknown | unknown | unknown |
| claude / followup-first | scoped-4.1.25 | unknown | unknown | unknown | unknown |
| claude / followup-first | scoped-4.1.26 | unknown | unknown | unknown | unknown |
| codex / status-first | off | unknown | unknown | unknown | unknown |
| codex / status-first | scoped-4.1.25 | unknown | unknown | unknown | unknown |
| codex / status-first | scoped-4.1.26 | unknown | unknown | unknown | unknown |
| codex / followup-first | off | unknown | unknown | unknown | unknown |
| codex / followup-first | scoped-4.1.25 | unknown | unknown | unknown | unknown |
| codex / followup-first | scoped-4.1.26 | unknown | unknown | unknown | unknown |

| Client | Arm | Matched | Weighted input | Output tokens | Customer response rounds | Machine ms | Known USD |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude | off | 0 | unknown | unknown | unknown | unknown | unknown |
| claude | scoped-4.1.25 | 0 | unknown | unknown | unknown | unknown | unknown |
| claude | scoped-4.1.26 | 0 | unknown | unknown | unknown | unknown | unknown |
| codex | off | 0 | unknown | unknown | unknown | unknown | unknown |
| codex | scoped-4.1.25 | 0 | unknown | unknown | unknown | unknown | unknown |
| codex | scoped-4.1.26 | 0 | unknown | unknown | unknown | unknown | unknown |

| Client | Arm | Recorded attempts | Observed attempts | Slice-read blocks | Slice-read warnings |
| --- | --- | ---: | ---: | ---: | ---: |
| claude | off | 2 | 0 | not instrumented | not instrumented |
| claude | scoped-4.1.25 | 2 | 0 | not instrumented | not instrumented |
| claude | scoped-4.1.26 | 2 | 2 | 0 | 0 |
| codex | off | 0 | 0 | not instrumented | not instrumented |
| codex | scoped-4.1.25 | 0 | 0 | not instrumented | not instrumented |
| codex | scoped-4.1.26 | 0 | 0 | unknown | unknown |

Slice-read counts include failed attempts and sum only session counter increments. Off and 4.1.25 lack this instrumentation; they are not zero observations. Missing/reset counters leave unknown totals. Counts explain observed guard activity and do not change the quality or 0.80 weighted-input target. No command or file content is retained with these measurements.

Customer response rounds are a burden proxy, not measured customer minutes. Machine time is not human time saved. Savings and monetary ROI are not measured. Prices absent from the frozen configuration mean unknown money. This synthetic case does not establish broad prevention or general FDE superiority.

Mechanical agreement coverage is recomputed from weighted requirements in frozen pre-build artifacts; behavior is checked separately on the pilot. Table values are means among usable attempts, and every candidate must also meet the per-attempt floor. Unsupported assertions cover structured fields only. Optional human diagnostics do not affect execution authorization or release gates. The pilot still requires human review before any external action.

Agent verification summaries, command counts/hashes, and private behavior metrics remain separate in the append-only ledger. Original messages and transport output require explicit private diagnostics; shared rows never contain them. Capture is bounded to 64 MiB per stream; incomplete prefixes retain observed usage and unknown totals, stop further calls, and never count as usable samples. Within-session phase tokens/tool counts are unavailable; measured session totals are retained. Efficiency uses only matched accepted completions with equally weighted customer variants.

The machine-readable assessment below includes every exclusion and failing target. Linux and Windows require CI evidence for the candidate revision; local Linux checks alone do not establish Windows compatibility.

```json
{
  "sliceReads": [
    {
      "client": "claude",
      "arm": "off",
      "supported": false,
      "recorded": 2,
      "observedAttempts": 0,
      "notStartedAttempts": 0,
      "unavailableAttempts": 0,
      "counts": null,
      "observedCounts": null
    },
    {
      "client": "claude",
      "arm": "scoped-4.1.25",
      "supported": false,
      "recorded": 2,
      "observedAttempts": 0,
      "notStartedAttempts": 0,
      "unavailableAttempts": 0,
      "counts": null,
      "observedCounts": null
    },
    {
      "client": "claude",
      "arm": "scoped-4.1.26",
      "supported": true,
      "recorded": 2,
      "observedAttempts": 2,
      "notStartedAttempts": 0,
      "unavailableAttempts": 0,
      "counts": {
        "blocked": 0,
        "warned": 0
      },
      "observedCounts": {
        "blocked": 0,
        "warned": 0
      }
    },
    {
      "client": "codex",
      "arm": "off",
      "supported": false,
      "recorded": 0,
      "observedAttempts": 0,
      "notStartedAttempts": 0,
      "unavailableAttempts": 0,
      "counts": null,
      "observedCounts": null
    },
    {
      "client": "codex",
      "arm": "scoped-4.1.25",
      "supported": false,
      "recorded": 0,
      "observedAttempts": 0,
      "notStartedAttempts": 0,
      "unavailableAttempts": 0,
      "counts": null,
      "observedCounts": null
    },
    {
      "client": "codex",
      "arm": "scoped-4.1.26",
      "supported": true,
      "recorded": 0,
      "observedAttempts": 0,
      "notStartedAttempts": 0,
      "unavailableAttempts": 0,
      "counts": null,
      "observedCounts": null
    }
  ],
  "ok": false,
  "limitation": "These indicators do not measure the appropriateness of problem framing or tradeoff judgment.",
  "evidence": {
    "ok": false,
    "problems": [
      "claude/status-first/off/1: CLIENT_EXIT_NONZERO; missing pre-build approved scope; missing/invalid scored private grade or inconsistent mechanical coverage; discovery grade must use the initial pre-build agreement; missing, failed or incomplete bounded transport; missing phase boundaries",
      "claude/status-first/scoped-4.1.25/1: CLIENT_EXIT_NONZERO; missing pre-build approved scope; missing/invalid scored private grade or inconsistent mechanical coverage; discovery grade must use the initial pre-build agreement; missing, failed or incomplete bounded transport; missing phase boundaries",
      "claude/status-first/scoped-4.1.26/1: CLIENT_EXIT_NONZERO; missing pre-build approved scope; missing/invalid scored private grade or inconsistent mechanical coverage; discovery grade must use the initial pre-build agreement; missing, failed or incomplete bounded transport; missing phase boundaries",
      "claude/followup-first/off/1: CLIENT_EXIT_NONZERO; missing pre-build approved scope; missing/invalid scored private grade or inconsistent mechanical coverage; discovery grade must use the initial pre-build agreement; missing, failed or incomplete bounded transport; missing phase boundaries",
      "claude/followup-first/scoped-4.1.25/1: CLIENT_EXIT_NONZERO; missing pre-build approved scope; missing/invalid scored private grade or inconsistent mechanical coverage; discovery grade must use the initial pre-build agreement; missing, failed or incomplete bounded transport; missing phase boundaries",
      "claude/followup-first/scoped-4.1.26/1: CLIENT_EXIT_NONZERO; missing pre-build approved scope; missing/invalid scored private grade or inconsistent mechanical coverage; discovery grade must use the initial pre-build agreement; missing, failed or incomplete bounded transport; missing phase boundaries",
      "codex/status-first/off/1: expected one preserved attempt, found 0",
      "codex/status-first/scoped-4.1.25/1: expected one preserved attempt, found 0",
      "codex/status-first/scoped-4.1.26/1: expected one preserved attempt, found 0",
      "codex/followup-first/off/1: expected one preserved attempt, found 0",
      "codex/followup-first/scoped-4.1.25/1: expected one preserved attempt, found 0",
      "codex/followup-first/scoped-4.1.26/1: expected one preserved attempt, found 0",
      "claude/status-first/scoped-4.1.25/2: expected one preserved attempt, found 0",
      "claude/status-first/scoped-4.1.26/2: expected one preserved attempt, found 0",
      "claude/status-first/off/2: expected one preserved attempt, found 0",
      "claude/followup-first/scoped-4.1.25/2: expected one preserved attempt, found 0",
      "claude/followup-first/scoped-4.1.26/2: expected one preserved attempt, found 0",
      "claude/followup-first/off/2: expected one preserved attempt, found 0",
      "codex/status-first/scoped-4.1.25/2: expected one preserved attempt, found 0",
      "codex/status-first/scoped-4.1.26/2: expected one preserved attempt, found 0",
      "codex/status-first/off/2: expected one preserved attempt, found 0",
      "codex/followup-first/scoped-4.1.25/2: expected one preserved attempt, found 0",
      "codex/followup-first/scoped-4.1.26/2: expected one preserved attempt, found 0",
      "codex/followup-first/off/2: expected one preserved attempt, found 0",
      "claude/status-first/scoped-4.1.26/3: expected one preserved attempt, found 0",
      "claude/status-first/off/3: expected one preserved attempt, found 0",
      "claude/status-first/scoped-4.1.25/3: expected one preserved attempt, found 0",
      "claude/followup-first/scoped-4.1.26/3: expected one preserved attempt, found 0",
      "claude/followup-first/off/3: expected one preserved attempt, found 0",
      "claude/followup-first/scoped-4.1.25/3: expected one preserved attempt, found 0",
      "codex/status-first/scoped-4.1.26/3: expected one preserved attempt, found 0",
      "codex/status-first/off/3: expected one preserved attempt, found 0",
      "codex/status-first/scoped-4.1.25/3: expected one preserved attempt, found 0",
      "codex/followup-first/scoped-4.1.26/3: expected one preserved attempt, found 0",
      "codex/followup-first/off/3: expected one preserved attempt, found 0",
      "codex/followup-first/scoped-4.1.25/3: expected one preserved attempt, found 0",
      "claude/status-first/off/4: expected one preserved attempt, found 0",
      "claude/status-first/scoped-4.1.25/4: expected one preserved attempt, found 0",
      "claude/status-first/scoped-4.1.26/4: expected one preserved attempt, found 0",
      "claude/followup-first/off/4: expected one preserved attempt, found 0",
      "claude/followup-first/scoped-4.1.25/4: expected one preserved attempt, found 0",
      "claude/followup-first/scoped-4.1.26/4: expected one preserved attempt, found 0",
      "codex/status-first/off/4: expected one preserved attempt, found 0",
      "codex/status-first/scoped-4.1.25/4: expected one preserved attempt, found 0",
      "codex/status-first/scoped-4.1.26/4: expected one preserved attempt, found 0",
      "codex/followup-first/off/4: expected one preserved attempt, found 0",
      "codex/followup-first/scoped-4.1.25/4: expected one preserved attempt, found 0",
      "codex/followup-first/scoped-4.1.26/4: expected one preserved attempt, found 0",
      "claude/status-first/scoped-4.1.25/5: expected one preserved attempt, found 0",
      "claude/status-first/scoped-4.1.26/5: expected one preserved attempt, found 0",
      "claude/status-first/off/5: expected one preserved attempt, found 0",
      "claude/followup-first/scoped-4.1.25/5: expected one preserved attempt, found 0",
      "claude/followup-first/scoped-4.1.26/5: expected one preserved attempt, found 0",
      "claude/followup-first/off/5: expected one preserved attempt, found 0",
      "codex/status-first/scoped-4.1.25/5: expected one preserved attempt, found 0",
      "codex/status-first/scoped-4.1.26/5: expected one preserved attempt, found 0",
      "codex/status-first/off/5: expected one preserved attempt, found 0",
      "codex/followup-first/scoped-4.1.25/5: expected one preserved attempt, found 0",
      "codex/followup-first/scoped-4.1.26/5: expected one preserved attempt, found 0",
      "codex/followup-first/off/5: expected one preserved attempt, found 0"
    ],
    "planned": 60,
    "recorded": 6,
    "usable": 0,
    "apiOrHarnessErrors": 6,
    "stalled": 0,
    "excluded": [
      {
        "id": "claude/status-first/off/1",
        "reasons": [
          "CLIENT_EXIT_NONZERO",
          "missing pre-build approved scope",
          "missing/invalid scored private grade or inconsistent mechanical coverage",
          "discovery grade must use the initial pre-build agreement",
          "missing, failed or incomplete bounded transport",
          "missing phase boundaries"
        ]
      },
      {
        "id": "claude/status-first/scoped-4.1.25/1",
        "reasons": [
          "CLIENT_EXIT_NONZERO",
          "missing pre-build approved scope",
          "missing/invalid scored private grade or inconsistent mechanical coverage",
          "discovery grade must use the initial pre-build agreement",
          "missing, failed or incomplete bounded transport",
          "missing phase boundaries"
        ]
      },
      {
        "id": "claude/status-first/scoped-4.1.26/1",
        "reasons": [
          "CLIENT_EXIT_NONZERO",
          "missing pre-build approved scope",
          "missing/invalid scored private grade or inconsistent mechanical coverage",
          "discovery grade must use the initial pre-build agreement",
          "missing, failed or incomplete bounded transport",
          "missing phase boundaries"
        ]
      },
      {
        "id": "claude/followup-first/off/1",
        "reasons": [
          "CLIENT_EXIT_NONZERO",
          "missing pre-build approved scope",
          "missing/invalid scored private grade or inconsistent mechanical coverage",
          "discovery grade must use the initial pre-build agreement",
          "missing, failed or incomplete bounded transport",
          "missing phase boundaries"
        ]
      },
      {
        "id": "claude/followup-first/scoped-4.1.25/1",
        "reasons": [
          "CLIENT_EXIT_NONZERO",
          "missing pre-build approved scope",
          "missing/invalid scored private grade or inconsistent mechanical coverage",
          "discovery grade must use the initial pre-build agreement",
          "missing, failed or incomplete bounded transport",
          "missing phase boundaries"
        ]
      },
      {
        "id": "claude/followup-first/scoped-4.1.26/1",
        "reasons": [
          "CLIENT_EXIT_NONZERO",
          "missing pre-build approved scope",
          "missing/invalid scored private grade or inconsistent mechanical coverage",
          "discovery grade must use the initial pre-build agreement",
          "missing, failed or incomplete bounded transport",
          "missing phase boundaries"
        ]
      }
    ]
  },
  "quality": {
    "ok": false,
    "problems": [],
    "cells": [
      {
        "client": "claude",
        "variant": "status-first",
        "arms": {
          "off": {
            "usable": 0,
            "mechanicalCoverage": null,
            "behavior": null,
            "criticalOmissions": null,
            "unsupportedAssertions": null,
            "groundedOpportunities": null,
            "sourcePreserved": null
          },
          "scoped-4.1.25": {
            "usable": 0,
            "mechanicalCoverage": null,
            "behavior": null,
            "criticalOmissions": null,
            "unsupportedAssertions": null,
            "groundedOpportunities": null,
            "sourcePreserved": null
          },
          "scoped-4.1.26": {
            "usable": 0,
            "mechanicalCoverage": null,
            "behavior": null,
            "criticalOmissions": null,
            "unsupportedAssertions": null,
            "groundedOpportunities": null,
            "sourcePreserved": null
          }
        }
      },
      {
        "client": "claude",
        "variant": "followup-first",
        "arms": {
          "off": {
            "usable": 0,
            "mechanicalCoverage": null,
            "behavior": null,
            "criticalOmissions": null,
            "unsupportedAssertions": null,
            "groundedOpportunities": null,
            "sourcePreserved": null
          },
          "scoped-4.1.25": {
            "usable": 0,
            "mechanicalCoverage": null,
            "behavior": null,
            "criticalOmissions": null,
            "unsupportedAssertions": null,
            "groundedOpportunities": null,
            "sourcePreserved": null
          },
          "scoped-4.1.26": {
            "usable": 0,
            "mechanicalCoverage": null,
            "behavior": null,
            "criticalOmissions": null,
            "unsupportedAssertions": null,
            "groundedOpportunities": null,
            "sourcePreserved": null
          }
        }
      },
      {
        "client": "codex",
        "variant": "status-first",
        "arms": {
          "off": {
            "usable": 0,
            "mechanicalCoverage": null,
            "behavior": null,
            "criticalOmissions": null,
            "unsupportedAssertions": null,
            "groundedOpportunities": null,
            "sourcePreserved": null
          },
          "scoped-4.1.25": {
            "usable": 0,
            "mechanicalCoverage": null,
            "behavior": null,
            "criticalOmissions": null,
            "unsupportedAssertions": null,
            "groundedOpportunities": null,
            "sourcePreserved": null
          },
          "scoped-4.1.26": {
            "usable": 0,
            "mechanicalCoverage": null,
            "behavior": null,
            "criticalOmissions": null,
            "unsupportedAssertions": null,
            "groundedOpportunities": null,
            "sourcePreserved": null
          }
        }
      },
      {
        "client": "codex",
        "variant": "followup-first",
        "arms": {
          "off": {
            "usable": 0,
            "mechanicalCoverage": null,
            "behavior": null,
            "criticalOmissions": null,
            "unsupportedAssertions": null,
            "groundedOpportunities": null,
            "sourcePreserved": null
          },
          "scoped-4.1.25": {
            "usable": 0,
            "mechanicalCoverage": null,
            "behavior": null,
            "criticalOmissions": null,
            "unsupportedAssertions": null,
            "groundedOpportunities": null,
            "sourcePreserved": null
          },
          "scoped-4.1.26": {
            "usable": 0,
            "mechanicalCoverage": null,
            "behavior": null,
            "criticalOmissions": null,
            "unsupportedAssertions": null,
            "groundedOpportunities": null,
            "sourcePreserved": null
          }
        }
      }
    ]
  },
  "cost": {
    "ok": false,
    "problems": [
      "claude: incomplete matched accepted completions for efficiency",
      "codex: incomplete matched accepted completions for efficiency"
    ],
    "clients": [
      {
        "client": "claude",
        "arms": {
          "off": {
            "n": 0,
            "weightedInput": null,
            "output": null,
            "customerResponses": null,
            "machineMs": null,
            "costUsd": null
          },
          "scoped-4.1.25": {
            "n": 0,
            "weightedInput": null,
            "output": null,
            "customerResponses": null,
            "machineMs": null,
            "costUsd": null
          },
          "scoped-4.1.26": {
            "n": 0,
            "weightedInput": null,
            "output": null,
            "customerResponses": null,
            "machineMs": null,
            "costUsd": null
          }
        },
        "excluded": []
      },
      {
        "client": "codex",
        "arms": {
          "off": {
            "n": 0,
            "weightedInput": null,
            "output": null,
            "customerResponses": null,
            "machineMs": null,
            "costUsd": null
          },
          "scoped-4.1.25": {
            "n": 0,
            "weightedInput": null,
            "output": null,
            "customerResponses": null,
            "machineMs": null,
            "costUsd": null
          },
          "scoped-4.1.26": {
            "n": 0,
            "weightedInput": null,
            "output": null,
            "customerResponses": null,
            "machineMs": null,
            "costUsd": null
          }
        },
        "excluded": []
      }
    ]
  }
}
```
