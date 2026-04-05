# Event Plan: {{EVENT_NAME}} {{EDITION}}회

| Field | Value |
|-------|-------|
| Event type | {{TYPE}} (MDC / Webinar / DWK / Other) |
| Date & time | {{DATE}} {{TIME}} |
| Venue | {{VENUE}} |
| Format | {{OFFLINE / ONLINE / HYBRID}} |
| Expected attendees | {{EXPECTED_COUNT}} |
| Registration URL | {{REG_URL}} |
| Participation fee | {{FEE}} |

## Topic & Theme

**Main theme**: {{THEME}}

**Session topics:**

| # | Topic | Speaker | Duration |
|---|-------|---------|----------|
| 1 | {{TOPIC_1}} | {{SPEAKER_1}} | {{DURATION}} |
| 2 | {{TOPIC_2}} | {{SPEAKER_2}} | {{DURATION}} |
| 3 | {{TOPIC_3}} | {{SPEAKER_3}} | {{DURATION}} |

## Timetable

| Time | Item |
|------|------|
| {{TIME_1}} | {{ITEM_1}} |
| {{TIME_2}} | {{ITEM_2}} |
| {{TIME_3}} | {{ITEM_3}} |
| {{TIME_4}} | Q&A + Networking |

## Speakers

### Speaker 1: {{SPEAKER_1_NAME}}

- Role: {{ROLE}}
- Company: {{COMPANY}}
- Topic: {{TOPIC}}
- Contact: {{EMAIL_OR_DM}}
- Confirmation status: {{PENDING / CONFIRMED}}

### Speaker 2: {{SPEAKER_2_NAME}}

- Role: {{ROLE}}
- Company: {{COMPANY}}
- Topic: {{TOPIC}}
- Contact: {{EMAIL_OR_DM}}
- Confirmation status: {{PENDING / CONFIRMED}}

## D-Day Timeline

| D-Day | Task | Owner | Status |
|-------|------|-------|--------|
| D-{{N}} | {{TASK_1}} | {{OWNER}} | Not started |
| D-{{N}} | {{TASK_2}} | {{OWNER}} | Not started |
| D-3 | Confirmation email + SMS | {{OWNER}} | Not started |
| D-1 | Nametags + checklist + slides | {{OWNER}} | Not started |
| D-Day | Day-of operations | {{OWNER}} | Not started |
| D+1 | Review post + settlement | {{OWNER}} | Not started |

## Budget

| Item | Estimated Cost | Actual Cost |
|------|---------------|-------------|
| Venue | {{AMOUNT}} | — |
| Snacks / Refreshments | {{AMOUNT}} | — |
| Speaker gifts | {{AMOUNT}} | — |
| Printing (nametags, etc.) | {{AMOUNT}} | — |
| **Total** | {{TOTAL}} | — |

Revenue: {{EXPECTED_ATTENDEES}} × {{FEE}} = {{EXPECTED_REVENUE}}

## State File Reference

Save progress to `.event_state.json` after each step completion.

```json
{
  "event_id": "{{TYPE}}-{{EDITION}}",
  "type": "{{TYPE}}",
  "date": "{{DATE}}",
  "title": "{{EVENT_NAME}} {{EDITION}}회",
  "topic": "{{THEME}}",
  "speakers": [],
  "current_step": "{{CURRENT_STEP}}",
  "completed_steps": [],
  "outputs": {}
}
```
