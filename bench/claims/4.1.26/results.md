# 4.1.26 discovery evidence

Protocol: fde-discovery-v1. Candidate revision: not frozen.

Release objective: unmet. Evidence: incomplete. Quality: not passed. Cost/customer burden: not passed.

0/60 planned attempts recorded; 0 usable. Errors: 0; stalled: 0. No failed attempt is replaced.

| Client / customer | Arm | Usable | Human weighted scope | Private pilot behavior |
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

| Client | Arm | Matched | Weighted input | Output tokens | Customer response rounds | Machine ms | Known USD |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| claude | off | 0 | unknown | unknown | unknown | unknown | unknown |
| claude | scoped-4.1.25 | 0 | unknown | unknown | unknown | unknown | unknown |
| claude | scoped-4.1.26 | 0 | unknown | unknown | unknown | unknown | unknown |
| codex | off | 0 | unknown | unknown | unknown | unknown | unknown |
| codex | scoped-4.1.25 | 0 | unknown | unknown | unknown | unknown | unknown |
| codex | scoped-4.1.26 | 0 | unknown | unknown | unknown | unknown | unknown |

Customer response rounds are a burden proxy, not measured customer minutes. Machine time is not human time saved. Savings and monetary ROI are not measured. Prices absent from the frozen configuration mean unknown money. This synthetic case does not establish broad prevention or general FDE superiority.

Scope quality comes from frozen pre-build artifacts and external human ratings. Agent verification, executed command traces, and private behavior grades remain separate in the append-only ledger. Within-session phase tokens/tool counts are unavailable; measured session totals are retained. Efficiency uses only matched accepted completions with equally weighted customer variants.

The machine-readable assessment below includes every exclusion and failing target. Linux and Windows require CI evidence for the candidate revision; local Linux checks alone do not establish Windows compatibility.

```json
{
  "ok": false,
  "evidence": {
    "ok": false,
    "problems": [
      "protocol/candidate not frozen",
      "missing baseline executable hash",
      "missing candidate executable hash",
      "token and wall budget required",
      "currency budget or explicit unknown-money acceptance required",
      "human rubric calibration missing or mismatched",
      "claude/status-first/off/1: expected one preserved attempt, found 0",
      "claude/status-first/scoped-4.1.25/1: expected one preserved attempt, found 0",
      "claude/status-first/scoped-4.1.26/1: expected one preserved attempt, found 0",
      "claude/followup-first/off/1: expected one preserved attempt, found 0",
      "claude/followup-first/scoped-4.1.25/1: expected one preserved attempt, found 0",
      "claude/followup-first/scoped-4.1.26/1: expected one preserved attempt, found 0",
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
      "codex/followup-first/off/5: expected one preserved attempt, found 0",
      "linux: missing CI evidence for candidate revision",
      "windows: missing CI evidence for candidate revision"
    ],
    "planned": 60,
    "recorded": 0,
    "usable": 0,
    "apiOrHarnessErrors": 0,
    "stalled": 0,
    "excluded": []
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
            "scope": null,
            "behavior": null
          },
          "scoped-4.1.25": {
            "usable": 0,
            "scope": null,
            "behavior": null
          },
          "scoped-4.1.26": {
            "usable": 0,
            "scope": null,
            "behavior": null
          }
        }
      },
      {
        "client": "claude",
        "variant": "followup-first",
        "arms": {
          "off": {
            "usable": 0,
            "scope": null,
            "behavior": null
          },
          "scoped-4.1.25": {
            "usable": 0,
            "scope": null,
            "behavior": null
          },
          "scoped-4.1.26": {
            "usable": 0,
            "scope": null,
            "behavior": null
          }
        }
      },
      {
        "client": "codex",
        "variant": "status-first",
        "arms": {
          "off": {
            "usable": 0,
            "scope": null,
            "behavior": null
          },
          "scoped-4.1.25": {
            "usable": 0,
            "scope": null,
            "behavior": null
          },
          "scoped-4.1.26": {
            "usable": 0,
            "scope": null,
            "behavior": null
          }
        }
      },
      {
        "client": "codex",
        "variant": "followup-first",
        "arms": {
          "off": {
            "usable": 0,
            "scope": null,
            "behavior": null
          },
          "scoped-4.1.25": {
            "usable": 0,
            "scope": null,
            "behavior": null
          },
          "scoped-4.1.26": {
            "usable": 0,
            "scope": null,
            "behavior": null
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
