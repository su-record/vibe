# Event Email Invitation Template

> Delivery method: Gmail OAuth 2.0 — MUST use BCC (never expose attendee emails)
> Timing: Use per D-Day schedule from event-planning skill

---

## Registration Open Announcement

```
Subject: [{{EVENT_NAME}}] {{EDITION}}회 참가 신청 안내

{{ATTENDEE_NAME}}님 안녕하세요.

{{COMMUNITY_NAME}}에서 {{EDITION}}회 행사를 안내드립니다.

■ 주제: {{THEME}}
■ 일시: {{DATE}} {{TIME}}
■ 장소: {{VENUE}}
■ 참가비: {{FEE}}

이번 행사에서 다루는 내용:
{{WHAT_YOU_WILL_LEARN_1}}
{{WHAT_YOU_WILL_LEARN_2}}
{{WHAT_YOU_WILL_LEARN_3}}

참가 신청: {{REGISTRATION_URL}}

신청 마감: {{DEADLINE}}

감사합니다.
{{COMMUNITY_NAME}} 드림
```

---

## Attendance Confirmation Email (D-3)

```
Subject: [{{EVENT_NAME}}] {{EDITION}}회 참가 확정 안내

{{ATTENDEE_NAME}}님 안녕하세요.

{{EVENT_NAME}} {{EDITION}}회 참가가 확정되었습니다.
소중한 시간 내주셔서 감사합니다.

■ 일시: {{DATE}} {{TIME}}
■ 장소: {{VENUE_DETAIL}}
   {{VENUE_ADDRESS}}
   {{VENUE_TRANSPORT}}

■ 프로그램:
{{TIMETABLE_LINE_1}}
{{TIMETABLE_LINE_2}}
{{TIMETABLE_LINE_3}}

■ 실시간 질문: {{SLIDO_LINK}}

당일 현장에서 뵙겠습니다.
감사합니다.

{{COMMUNITY_NAME}} 드림
```

---

## Post-Event Thank You + Recording Link

```
Subject: [{{EVENT_NAME}}] {{EDITION}}회 참석 감사드립니다

{{ATTENDEE_NAME}}님 안녕하세요.

{{EVENT_NAME}} {{EDITION}}회에 참석해 주셔서 진심으로 감사드립니다.

■ 행사 후기:
{{REVIEW_SUMMARY}}

■ 발표 자료:
{{SLIDE_URL_1}} — {{SPEAKER_1_NAME}}
{{SLIDE_URL_2}} — {{SPEAKER_2_NAME}}

■ 녹화 영상 (있는 경우):
{{VIDEO_URL}}

다음 행사 소식도 기대해 주세요.

감사합니다.
{{COMMUNITY_NAME}} 드림
```

---

## Usage Notes

- Replace all `{{PLACEHOLDER}}` values before sending
- BCC field only — the `To:` field should be your own sender address or a placeholder
- Test with `testmode_yn=Y` equivalent before real send
- Confirm send with event organizer before dispatch
