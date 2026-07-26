---
name: vibe.event
description: 커뮤니티 행사 일정·홍보·운영을 준비하거나 D-Day 기준 자동화가 필요할 때 — event 유형을 판별하고 외부 발송 전 승인을 강제한다.
argument-hint: '"event description" | status | dashboard'
user-invocable: true
---

# /vibe.event

## 완료 기준

- [ ] event 유형, 날짜, D-Day가 상태 파일에 기록되어 있다.
- [ ] 선택한 planning·communications·operations 단계의 산출물이 존재한다.
- [ ] 외부 발송은 명시적 승인 기록 없이는 실행되지 않았다.
- [ ] 완료된 task와 남은 task 상태가 저장되어 있다.

Route one event request across planning, communications, and operations without loading unrelated detail.

## Usage

```text
/vibe.event "MDC 12차 3/30"
/vibe.event "webinar AI에이전트 4/15"
/vibe.event "DWK 5차 5/20 오프라인"
/vibe.event status
/vibe.event dashboard
```

## Routing

1. Parse event type (`MDC`, `webinar`, `DWK`), edition, date, topic, and format.
2. Load `.event_state.json` when present; update it after each completed action.
   For the complete phase tables, parsing examples, state schema, dashboard,
   and legacy safety contract, read `references/orchestration-legacy.md`.
3. Select only the required reference:
   - timeline, speakers, outreach, intro/SNS/review content → `references/planning.md`
   - SMS, email, invitations, reminders, SNS delivery copy → `references/comms.md`
   - nametags, checklist, slides, Slido, images, settlement → `references/operations.md`
4. When a request crosses modes, execute planning before communications and operations, sharing the same event state and output paths.

Claude Code maps named event workers to Task/Agent; Codex maps them to native
collaboration. Inherit the session model and delegate independent work only
when it does not race on `.event_state.json` or shared output files.

## Safety Gate

- Drafts, previews, test sends, and local artifacts may be produced automatically.
- Never send SMS/email/SNS, publish content, upload, or contact a real person without explicit confirmation in the current conversation.
- Before confirmation show recipient count, exact preview, channel, and cost estimate where applicable. Email recipients use BCC.
- Autonomous mode never bypasses this external-state confirmation.

## State and Outputs

- State: `.event_state.json`
- Speaker history: `data/speakers/{name}.json`
- Reports and copy: `output/reports/`
- Images and prompts: `output/images/`

## Done

- Event identity and current D-Day phase are explicit.
- Every requested artifact exists at its documented path.
- State reflects completed, pending, and confirmation-blocked work.
- No external send or publish occurred without explicit approval.

ARGUMENTS: $ARGUMENTS
