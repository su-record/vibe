---
name: event-ops
tier: standard
description: "Event operations — nametags, checklists, operational slides, Slido plans, image generation specs, settlement reports."
triggers: [nametag, checklist, event slide, slido, 이름표, 체크리스트, 운영 슬라이드, 정산]
priority: 65
---
# Event Operations

Nametags, checklists, operational slides, Slido configuration, image generation, and settlement.

## Nametags

### Specs
- Size: 85mm × 60mm
- A4 layout: 8 per page (2 columns × 4 rows)
- Layout: Company(9pt gray) / Role(9pt gray) / Name(18pt bold) / Brand(7pt bottom-right)
- Output: HTML → browser A4 print
- Data: webhook participant CSV, or blank template if unavailable

### Community Brand

| MDC | webinar | DWK |
|-----|---------|-----|
| 마케팅데이터커넥트 | (none) | DATA + WOMEN KOREA TUG |

### HTML Template Structure
```html
<!DOCTYPE html>
<html>
<head>
  <style>
    @page { size: A4; margin: 10mm; }
    .nametag-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; }
    .nametag {
      width: 85mm; height: 60mm;
      border: 1px dashed #ccc;
      padding: 8mm;
      display: flex; flex-direction: column;
      justify-content: center; position: relative;
    }
    .company { font-size: 9pt; color: #888; }
    .role { font-size: 9pt; color: #888; }
    .name { font-size: 18pt; font-weight: bold; margin: 4mm 0; }
    .brand { font-size: 7pt; position: absolute; bottom: 3mm; right: 5mm; color: #aaa; }
  </style>
</head>
<body>
  <div class="nametag-grid">
    <!-- Repeat for each participant -->
    <div class="nametag">
      <span class="company">{company}</span>
      <span class="role">{role}</span>
      <span class="name">{name}</span>
      <span class="brand">{brand}</span>
    </div>
  </div>
</body>
</html>
```

## Checklist (D-1)

Fixed 4 items for all offline events:

```markdown
## D-1 체크리스트

- [ ] 생수/간식/식사 주문
- [ ] 이름표 출력
- [ ] 행사 운영 슬라이드
- [ ] 스크린/카메라/삼각대 준비
```

## Operational Slides

### Format
- PPTX (16:9)
- Generated with python-pptx
- Community colors + timetable patterns

### Slide Structure (5-7 slides)
1. Cover (event name, topic, datetime, venue)
2. Timetable (community-specific pattern)
3~N. Speaker intro (1 slide per speaker)
N+1. Q&A + Networking (Slido QR placeholder)
N+2. Thank you + community links

### Community Colors

| MDC | webinar | DWK |
|-----|---------|-----|
| #ff6b35 (orange) | #a78bfa (purple) | #34d399 (mint) |

### Timetable Patterns

**MDC (3 speakers)**
```
19:00-19:10  오프닝 + 네트워킹
19:10-19:35  세션 1: {speaker1_name} — {topic1}
19:35-20:00  세션 2: {speaker2_name} — {topic2}
20:00-20:25  세션 3: {speaker3_name} — {topic3}
20:25-20:40  Q&A + Slido
20:40-21:00  네트워킹
```

**Webinar (1-2 speakers)**
```
19:30-19:35  오프닝
19:35-20:30  세션: {speaker_name} — {topic}
20:30-20:50  Q&A
20:50-21:00  마무리
```

**DWK (1-3 speakers + discussion)**
```
14:00-14:10  오프닝 + 아이스브레이커
14:10-14:40  세션 1: {speaker1_name} — {topic1}
14:40-15:10  세션 2: {speaker2_name} — {topic2}
15:10-15:30  쉬는 시간
15:30-16:00  토론 세션
16:00-16:30  네트워킹
```

## Slido Configuration

API is read-only → Claude outputs plan → user manually configures.

### Community Presets

| Community | Items | Structure |
|-----------|-------|-----------|
| MDC | 5 | Icebreaker + Pre-Q&A + Balance game 2-3 + Satisfaction |
| Webinar | 5 | Icebreaker + Skill check + Live Q&A + Word cloud + Feedback |
| DWK | 10 | Icebreaker + Session feedback + Word cloud + Balance game 3 + Opinion poll 2 + Experience share + Feedback |

## Image Generation

### Model
Gemini (`gemini-3-pro-image-preview`)

### Specs by Community

| Community | Size | Purpose |
|-----------|------|---------|
| MDC | 500×500 | Listing thumbnail |
| MDC | 595×842 | A4 poster |
| Webinar | 1080×1080 | Instagram/Threads 1:1 |
| Webinar | 1920×1080 | YouTube 16:9 |
| Webinar | 1440×1080 | Zoom background 4:3 |
| DWK | 2000×500 | Banner 4:1 |
| DWK | 1080×1080 | SNS 1:1 |

### Prompt Dual Structure
- **API prompt**: No length limit, detailed (colors, layout, text position, logo placement)
- **User prompt**: ≤400 chars summary → `output/images/{type}_prompt.txt`

### Logo Auto-include
- Source: `data/assets/common/images/{community} logo.png`
- Auto-append: "Place logo naturally at bottom-left"

### Smart Resizing
- Same ratio → Pillow scale only (no API call)
- Different ratio → Gemini re-generate (pass original as reference, no white margins)

## Settlement

### MDC
Revenue(attendance fees) - Expenses(venue, snacks, speaker gifts) = Markdown settlement report

### DWK
Stripe receipts + speaker gifts → Slack Workflow settlement message (future)

### Webinar
Free — no settlement needed

## Intro Page Structure (Common)

1. Hook sentence (2-3 lines)
2. Event info (datetime/venue/fee)
3. "Recommended for" (5 items)
4. "What you'll learn" (5 items)
5. Speaker intro (1 paragraph per speaker)
6. Program timetable
7. Attendance benefits
8. CTA + quote

## Speaker Research

- Check past topic overlap → suggest 3 trend-based topics
- Collect related post URLs from LinkedIn/Threads/X/Blog/Brunch/Publy
- Use WebSearch tool (free)

## Speaker Outreach

- DM draft (short, 5-line version) + email draft (formal)
- Auto-reference existing contact history (for re-outreach)
- Business card image + LinkedIn URL → `data/speakers/{name}.json` accumulation
