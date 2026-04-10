---
name: event-planning
tier: standard
description: "Community event automation — D-Day timeline, community patterns, proactive task execution. Auto-activates for event planning, meetup/webinar/conference management."
triggers: [event planning, meetup, webinar, conference, 행사, 밋업, 웨비나, D-Day, 이벤트 준비]
priority: 70
---
# Event Planning

Community event automation with D-Day based proactive execution.

## Supported Communities

| Code | Name | Format | Schedule |
|------|------|--------|----------|
| `MDC` | 마케팅데이터커넥트 | Offline meetup, 3 speakers × 20-25min | Odd months, last week weekday 19:00 |
| `webinar` | 퇴근후AI | Online Zoom, 1-2 speakers × 50-60min | Irregular |
| `DWK` | Data+Women Korea | Offline/Online, 1-3 speakers + discussion | Irregular |

## D-Day Timeline

### MDC (D-60 → D+2, 11 steps)

| D-Day | Task | Outputs | Confirm |
|-------|------|---------|---------|
| D-60 | Topic selection + speaker research | 3 topics + speaker research | — |
| D-45 | Speaker outreach | DM + email drafts | — |
| D-40 | Speaker topic confirmation request | Confirmation email | — |
| D-28 | **Registration page open** | Intro + 2 images + 3 SMS + 1 email + prompts | — |
| D-30 | SNS promo + notification SMS | LinkedIn/Threads + SMS send | ✅ send |
| D-14 | Remind | LinkedIn/Threads remind | — |
| D-3 | Confirmation email + SMS | BCC email + SMS send | ✅ send |
| D-1 | Nametags + checklist + slides + remind SMS | HTML + MD + PPTX + SMS draft | ✅ print/send |
| D-Day | Day-of remind | SMS send | ✅ send |
| D+1 | Review + settlement | Review draft + settlement template | — |
| D+2 | Site update | (manual) | — |

### Webinar (Planning → D+1, 5 steps)

| D-Day | Task | Outputs | Confirm |
|-------|------|---------|---------|
| Planning | Event page | Intro + 3 images + SMS + email + prompts | — |
| Planning | SNS promo | LinkedIn/Threads | — |
| D-4 | Zoom + notification | Zoom link(manual) + email(BCC) + SMS | ✅ send |
| D-Day | Day-of ops | SMS + slides | ✅ send |
| D+1 | Review post | LinkedIn/Threads | — |

### DWK (D-30 → D+3, 9 steps)

| D-Day | Task | Outputs | Confirm |
|-------|------|---------|---------|
| D-30 | Topic + speaker research | 3 topics + speaker research | — |
| D-25 | Speaker outreach | DM + email drafts | — |
| D-20 | Speaker topic confirmation | Confirmation email | — |
| D-16 | Event page | Intro + 2 images + SMS + email + prompts | — |
| D-15 | SNS promo | LinkedIn/Threads | — |
| D-3 | Confirmation email + SMS | BCC email + SMS | ✅ send |
| D-1 | Slido + ops + remind | Slido plan + PPTX + SNS remind | ✅ |
| D-Day | Day-of ops | SMS + nametags(offline) | ✅ send |
| D+3 | Review + settlement | Review draft + Stripe/Slack settlement | — |

## Proactive Execution Protocol

When user says "MDC 준비해줘" or similar:

```
1. Parse: event type + edition + date
2. Calculate D-Day from today
3. Identify current step(s) in timeline
4. Auto-execute ALL pending outputs for current step
5. Request confirmation ONLY for send/publish actions
6. Save state to .event_state.json
```

## State File (.event_state.json)

```json
{
  "event_id": "MDC-12",
  "type": "MDC",
  "date": "2026-03-30",
  "title": "마케팅데이터커넥트 12회",
  "topic": "",
  "speakers": [],
  "current_step": "D-28",
  "completed_steps": ["D-60", "D-45", "D-40"],
  "outputs": {}
}
```

## Community Tone Guide

| | MDC | Webinar | DWK |
|---|---|---|---|
| Tone | Professional, practical, formal | Friendly, casual, emoji-ok | Warm, inclusive, "together" |
| Example | "Apply directly in your work" | "Relax after work" | "Women who love data" |
| Brand color | #ff6b35 (orange) | #a78bfa (purple) | #34d399 (mint) |

## Community Brand Names

| MDC | webinar | DWK |
|-----|---------|-----|
| 마케팅데이터커넥트 | (none) | DATA + WOMEN KOREA TUG |

## Confirmation Rules

| Auto-execute (no confirm) | Requires confirmation |
|---------------------------|----------------------|
| Intro/SMS/email/SNS **draft** generation | SMS/email **actual send** |
| Image prompt + API generation | Notion **real registration** (dry_run first) |
| Checklist/nametag HTML generation | — |

## Absolute Prohibitions

- No SMS/email send without user confirmation
- **Email recipients MUST use BCC** (never expose attendee emails to each other)
- No file deletion (move only)
- No emoji in SMS (EUC-KR incompatible)
- No Notion registration without dry_run first
- No .env file commits

## Output Directory Structure

```
output/
├── images/           ← Generated images
│   ├── {type}_prompt.txt    ← User-facing prompt summary (≤400 chars)
│   └── {type}_{size}.png    ← Generated images
├── reports/          ← Text outputs (intro, SNS, SMS, email drafts)
├── log.html          ← Dashboard frontend
└── serve.py          ← Dashboard server
```
