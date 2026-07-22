# Contingency Plan for Common Event Issues

## Speaker No-Show

| Severity | Trigger | Response |
|----------|---------|----------|
| High | Speaker unreachable 30 min before event | Call + SMS every 5 min. At T-15 min, announce brief delay. At T-0, proceed without or re-order sessions. |

**Mitigation (do in advance):**
- [ ] Backup speaker or moderator-led discussion identified at D-3
- [ ] Speaker has organizer's phone number, not just email
- [ ] Session slides received by D-1 (presenter can proceed without speaker for key points)

---

## A/V Failure (Projector / Screen)

| Issue | Immediate Action |
|-------|----------------|
| No HDMI signal | Swap adapter → try different port → use backup laptop |
| Projector lamp failure | Use TV monitor if available; announce "slides on Slido" as fallback |
| No audio from mic | Switch to backup mic → use presenter's natural voice for small rooms |

**Prevention:**
- [ ] HDMI cable + adapters (USB-C, Mini DisplayPort) in equipment bag
- [ ] Backup laptop with slides loaded and tested
- [ ] Portable Bluetooth speaker for audio fallback (small venues)

---

## Zoom / Streaming Failure (Online/Hybrid)

| Issue | Immediate Action |
|-------|----------------|
| Zoom disconnected | Restart app → new meeting link sent via pre-drafted SMS/email |
| Screen share freeze | Stop/restart screen share → switch to phone hotspot if network issue |
| No audio online | Confirm mic selected in Zoom settings → use phone as audio backup |

**Prevention:**
- [ ] Backup meeting link created and ready to send
- [ ] Phone hotspot available as network backup
- [ ] Co-host assigned to monitor chat/Q&A independently

---

## Low Attendance

| Threshold | Action |
|-----------|--------|
| < 50% of registered | Proceed normally — lower numbers often mean more intimate discussion |
| < 10 people (offline) | Reconfigure seating to feel intimate, not sparse |

**Notes:** Never cancel due to low attendance once speakers are confirmed. Record event for future distribution.

---

## Over-Capacity

| Threshold | Action |
|-----------|--------|
| >10% over room capacity | Direct overflow to live stream or waiting area |
| Fire safety limit reached | Stop admission at door, offer recording link |

**Prevention:**
- [ ] Registration cap set at 80–90% of room capacity
- [ ] Waitlist managed actively from D-14

---

## Payment / Settlement Issue

| Issue | Action |
|-------|--------|
| PG settlement delayed | Note expected settlement date, record in settlement report |
| Attendee requests refund day-of | Log name + contact, process after event via standard refund flow |
| Expense receipt missing | Request digital receipt same day — harder to get after 24 hours |

---

## General Escalation Protocol

1. Assess severity: **Can the event continue?** → Yes: mitigate silently. No: brief attendees.
2. Communicate calmly — attendees follow the organizer's energy.
3. Log the issue in `.event_state.json` under `"incidents"` for post-event review.
4. Debrief within 24 hours — add to standard checklist if issue was preventable.
