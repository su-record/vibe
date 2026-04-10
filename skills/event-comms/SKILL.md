---
name: event-comms
tier: standard
description: "Event communication automation — SMS via Aligo, email via Gmail OAuth, SNS posts for LinkedIn/Threads. Handles templates, BCC rules, and confirmation protocol."
triggers: [sms, aligo, gmail, event email, event sms, 문자 발송, 메일 발송, SNS 홍보]
priority: 65
---
# Event Communications

SMS, email, and SNS content generation for community events.

## SMS (Aligo API)

### Rules
- Auto-switch to LMS when >90 bytes
- Use `%고객명%` substitution
- Always test with `testmode_yn=Y` first
- **Emoji strictly forbidden** (EUC-KR encoding)

### SMS Types

| Timing | Type | Content |
|--------|------|---------|
| D-7~D-3 | Notification LMS | Event name, datetime, venue, fee, registration URL |
| D-3 | Confirmation SMS | Attendance confirmed + detailed venue |
| D-1 | Reminder SMS | Tomorrow schedule reminder + venue |
| D-Day | Day-of SMS | Today schedule reminder |

### Templates

**Notification LMS (D-7~D-3)**
```
%고객명%님 안녕하세요.

{event_name} {edition}회 안내드립니다.

일시: {date} {time}
장소: {venue}
참가비: {fee}

신청: {url}

{community_name}
```

**Confirmation SMS (D-3)**
```
%고객명%님, {event_name} 참가가 확정되었습니다.

일시: {date} {time}
장소: {venue_detail}

당일 뵙겠습니다.
```

**Reminder SMS (D-1)**
```
%고객명%님, 내일 {event_name}이 있습니다.

일시: {date} {time}
장소: {venue}

내일 뵙겠습니다!
```

**Day-of SMS (D-Day)**
```
%고객명%님, 오늘 {time} {event_name}입니다.

장소: {venue}

오늘 뵙겠습니다!
```

## Email (Gmail OAuth 2.0)

### Rules
- **MUST use BCC** — never expose attendee emails to each other
- D-3 confirmation email includes: venue details, timetable, Slido link

### Confirmation Email Template (D-3)
```
Subject: [{event_name}] Attendance Confirmation

Hello {attendee_name},

Your attendance for {event_name} edition {edition} has been confirmed.

■ Date & Time: {date} {time}
■ Venue: {venue_detail}
■ Program:
{timetable}

■ Live Q&A: {slido_link}

We look forward to seeing you on the day.
Thank you.

{community_name}
```

## SNS Posts

### Platform Tone

| Platform | Tone | Length | Style |
|----------|------|--------|-------|
| LinkedIn | Professional, formal | 300+ chars | Expert participation encouragement |
| Threads | Casual, hooking | 150-200 chars | "Haven't seen this yet?" style |

### Post Types

| Timing | Type | Content |
|--------|------|---------|
| Open | Promo post | Event intro + CTA |
| D-14 | Deadline remind | Urgency + remaining spots |
| D+1 | Review post | Story → 3 insights → next event preview |

### LinkedIn Promo Template
```
{hook_sentence}

Introducing {event_name} edition {edition}.

📅 {date} {time}
📍 {venue}

This session's topic: {topic}

{speaker_intro}

{cta}
```

### Threads Promo Template
```
{hook_casual}

{event_name} edition {edition} is happening!

{date} {time}
{venue_short}

{topic_casual}

{cta_casual}
```

### Review Post Structure
1. Story (emotional hook)
2. Key insights (3 items)
3. Next event preview
4. Thank you + community link

## Error Recovery

| Failure | Recovery |
|---------|----------|
| Aligo API timeout/error | Retry once after 5s. If still failing, output the SMS text as plain text for manual sending |
| Aligo auth error | Prompt user to verify API key in `~/.vibe/config.json` |
| Gmail auth expired | Prompt user to re-authenticate: `! gemini auth login` or refresh OAuth token |
| Gmail quota exceeded | Save email as `.eml` file for manual sending later |
| SNS post generation fails | Output post text as markdown for manual copy-paste |

## API Keys Required

| Key | Service | Required |
|-----|---------|----------|
| `ALIGO_API_KEY` | Aligo SMS | ✅ (for send) |
| `ALIGO_USER_ID` | Aligo SMS | ✅ (for send) |
| `ALIGO_SENDER` | Aligo SMS | ✅ (for send) |
| `GMAIL_CREDENTIALS_PATH` | Gmail OAuth | ✅ (for email) |
