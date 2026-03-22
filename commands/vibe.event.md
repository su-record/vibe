---
description: Community event automation — D-Day based proactive task execution
argument-hint: "MDC 12차 3/30" or "webinar AI에이전트 4/15" or "DWK 5차 5/20"
---

# /vibe.event

Automate community event planning with D-Day based proactive execution.

## Usage

```
/vibe.event "MDC 12차 3/30"                    # Parse: type=MDC, edition=12, date=3/30
/vibe.event "webinar AI에이전트 4/15"            # Parse: type=webinar, topic=AI에이전트, date=4/15
/vibe.event "DWK 5차 5/20 오프라인"              # Parse: type=DWK, edition=5, date=5/20, format=offline
/vibe.event status                              # Show current event status
/vibe.event dashboard                           # Open dashboard (localhost:8080)
```

## Execution Flow

```
1. PARSE input
   ├── Event type: MDC / webinar / DWK
   ├── Edition number (optional)
   ├── Date (required)
   ├── Topic (optional, can be set later)
   └── Format: offline/online (DWK only, default=offline)

2. CALCULATE D-Day
   └── today - event_date = D-{n}

3. LOAD or CREATE state
   ├── Check .event_state.json
   └── Create if new event

4. DETERMINE current phase
   ├── MDC: 11 steps (D-60 → D+2)
   ├── Webinar: 5 steps (planning → D+1)
   └── DWK: 9 steps (D-30 → D+3)

5. AUTO-EXECUTE pending deliverables
   ├── Content drafts → event-content agent
   ├── Image generation → event-image agent
   ├── SMS/email drafts → event-comms agent
   ├── Ops materials → event-ops agent
   └── Speaker research → event-speaker agent

6. REQUEST confirmation for send actions
   ├── SMS actual send
   ├── Email actual send
   └── Notion real registration

7. SAVE state
   └── Update .event_state.json
```

## Input Parsing Rules

| Input | Parsed Result |
|-------|---------------|
| `MDC 12차 3/30` | type=MDC, edition=12, date=2026-03-30 |
| `webinar AI에이전트` | type=webinar, topic=AI에이전트, date=TBD (ask) |
| `DWK 5차 5/20 오프라인` | type=DWK, edition=5, date=2026-05-20, format=offline |
| `status` | Show .event_state.json summary |
| `dashboard` | Run `python output/serve.py` |

## Phase-by-Phase Agent Dispatch

### MDC Phases

| Phase | Agents Triggered | Outputs |
|-------|-----------------|---------|
| D-60 | event-speaker | 3 topic suggestions + speaker research |
| D-45 | event-speaker | DM + email outreach drafts |
| D-40 | event-comms | Topic confirmation request email |
| D-28 | event-content, event-image, event-comms | Intro + 2 images + 3 SMS + 1 email |
| D-30 | event-content, event-comms | LinkedIn/Threads promo + SMS send(✅) |
| D-14 | event-content | LinkedIn/Threads reminder |
| D-3 | event-comms | BCC email + SMS send(✅) |
| D-1 | event-ops | Nametags + checklist + PPTX + SMS(✅) |
| D-Day | event-comms | Day-of SMS(✅) |
| D+1 | event-content, event-ops | Review posts + settlement |
| D+2 | — | Site update (manual) |

### Webinar Phases

| Phase | Agents Triggered | Outputs |
|-------|-----------------|---------|
| Planning | event-content, event-image, event-comms | Intro + 3 images + SMS + email |
| Planning | event-content | LinkedIn/Threads promo |
| D-4 | event-comms | Zoom(manual) + BCC email + SMS(✅) |
| D-Day | event-comms, event-ops | SMS(✅) + slides |
| D+1 | event-content | Review posts |

### DWK Phases

| Phase | Agents Triggered | Outputs |
|-------|-----------------|---------|
| D-30 | event-speaker | 3 topics + speaker research |
| D-25 | event-speaker | DM + email outreach |
| D-20 | event-comms | Topic confirmation email |
| D-16 | event-content, event-image, event-comms | Intro + 2 images + SMS + email |
| D-15 | event-content | LinkedIn/Threads promo |
| D-3 | event-comms | BCC email + SMS(✅) |
| D-1 | event-ops | Slido plan + PPTX + SNS remind(✅) |
| D-Day | event-comms, event-ops | SMS(✅) + nametags(offline) |
| D+3 | event-content, event-ops | Review + settlement |

## State File Format

```json
{
  "event_id": "MDC-12",
  "type": "MDC",
  "edition": 12,
  "date": "2026-03-30",
  "title": "마케팅데이터커넥트 12회",
  "topic": "마케팅 자동화",
  "format": "offline",
  "speakers": [
    {
      "name": "김영수",
      "company": "Company X",
      "topic": "마케팅 데이터 파이프라인"
    }
  ],
  "current_step": "D-28",
  "completed_steps": ["D-60", "D-45", "D-40"],
  "outputs": {
    "D-28": ["intro.md", "thumbnail_500x500.png", "sms_notification.txt"]
  },
  "confirmations_pending": []
}
```

## Dashboard

```bash
# Start dashboard
python output/serve.py
# Opens http://localhost:8080

# Features:
# - Timeline view with D-Day progress
# - Generate buttons per step
# - File preview links
# - API status (Gemini/Aligo key validity)
# - Dark theme with community color coding
```

## Safety Rules

```
CRITICAL — These are absolute prohibitions:
1. NEVER send SMS/email without explicit user confirmation
2. ALWAYS use BCC for email (never expose attendee emails)
3. NEVER use emoji in SMS (EUC-KR incompatible)
4. NEVER delete files (move only)
5. ALWAYS test SMS with testmode_yn=Y before real send
6. NEVER register to Notion without dry_run first
7. NEVER commit .env files
```
