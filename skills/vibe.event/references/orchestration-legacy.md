# Event Orchestration Reference

This preserves the complete pre-merge umbrella routing contract.

## Execution Flow

1. Parse type (`MDC`, `webinar`, `DWK`), edition, required date, optional topic, and DWK format (default offline).
2. Calculate D-Day from the event date.
3. Load or create `.event_state.json`.
4. Determine the current phase: MDC 11 steps (D-60→D+2), webinar 5 steps (planning→D+1), DWK 9 steps (D-30→D+3).
5. Produce pending content, speaker research, images, communications drafts, and operations materials.
6. Request confirmation for real SMS/email sends and Notion registration.
7. Save `.event_state.json`.

## Input Parsing

| Input | Parsed result |
|---|---|
| `MDC 12차 3/30` | type=MDC, edition=12, date=2026-03-30 |
| `webinar AI에이전트` | type=webinar, topic=AI에이전트, date=TBD (ask) |
| `DWK 5차 5/20 오프라인` | type=DWK, edition=5, date=2026-05-20, format=offline |
| `status` | Show `.event_state.json` summary |
| `dashboard` | Run `python output/serve.py` |

## MDC Phases

| Phase | Mode | Outputs |
|---|---|---|
| D-60 | planning | 3 topic suggestions + speaker research |
| D-45 | planning | DM + email outreach drafts |
| D-40 | operations | Topic confirmation request email |
| D-28 | planning + operations | Intro + 2 images + 3 SMS + 1 email |
| D-30 | planning + operations | LinkedIn/Threads promo + SMS send |
| D-14 | planning | LinkedIn/Threads reminder |
| D-3 | operations | BCC email + SMS send |
| D-1 | operations | Nametags + checklist + PPTX + SMS |
| D-Day | operations | Day-of SMS |
| D+1 | planning + operations | Review posts + settlement |
| D+2 | manual | Site update |

## Webinar Phases

| Phase | Mode | Outputs |
|---|---|---|
| Planning | planning + operations | Intro + 3 images + SMS + email |
| Planning | planning | LinkedIn/Threads promo |
| D-4 | operations | Zoom manual setup + BCC email + SMS |
| D-Day | operations | SMS + slides |
| D+1 | planning | Review posts |

## DWK Phases

| Phase | Mode | Outputs |
|---|---|---|
| D-30 | planning | 3 topics + speaker research |
| D-25 | planning | DM + email outreach |
| D-20 | operations | Topic confirmation email |
| D-16 | planning + operations | Intro + 2 images + SMS + email |
| D-15 | planning | LinkedIn/Threads promo |
| D-3 | operations | BCC email + SMS |
| D-1 | operations | Slido plan + PPTX + SNS reminder |
| D-Day | operations | SMS + nametags (offline) |
| D+3 | planning + operations | Review + settlement |

## State Schema

```json
{
  "event_id": "MDC-12",
  "type": "MDC",
  "edition": 12,
  "date": "2026-03-30",
  "title": "마케팅데이터커넥트 12회",
  "topic": "마케팅 자동화",
  "format": "offline",
  "speakers": [{ "name": "김영수", "company": "Company X", "topic": "마케팅 데이터 파이프라인" }],
  "current_step": "D-28",
  "completed_steps": ["D-60", "D-45", "D-40"],
  "outputs": { "D-28": ["intro.md", "thumbnail_500x500.png", "sms_notification.txt"] },
  "confirmations_pending": []
}
```

## Dashboard

Run `python output/serve.py` and open `http://localhost:8080`. The dashboard provides timeline progress, per-step generation, file previews, provider status, and community color coding.

## Absolute Safety Rules

1. Never send SMS/email without explicit user confirmation.
2. Always use BCC for email.
3. Never use emoji in SMS (EUC-KR incompatibility).
4. Never delete event files; move them when cleanup is needed.
5. Test SMS with `testmode_yn=Y` before real send.
6. Never register to Notion without `dry_run` first.
7. Never commit `.env` files.

