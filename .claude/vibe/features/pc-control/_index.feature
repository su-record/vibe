# Feature: pc-control (Master)

**Master SPEC**: `.claude/vibe/specs/pc-control/_index.md`

## Sub-Features

| Order | Feature File | SPEC File | Status |
|-------|--------------|-----------|--------|
| 1 | phase-1-browser-automation.feature | phase-1-browser-automation.md | ⬜ |
| 2 | phase-2-google-apps.feature | phase-2-google-apps.md | ⬜ |
| 3 | phase-3-voice-pipeline.feature | phase-3-voice-pipeline.md | ⬜ |
| 4 | phase-4-vision-live.feature | phase-4-vision-live.md | ⬜ |
| 5 | phase-5-docker-sandbox.feature | phase-5-docker-sandbox.md | ⬜ |
| 6 | phase-6-integration.feature | phase-6-integration.md | ⬜ |

## Overall User Story

**As a** 개발자 (로컬) 또는 SaaS 사용자 (클라우드)
**I want** AI 에이전트가 브라우저 조작, Google Apps 연동, 음성 대화, 실시간 화면 분석, 보안 샌드박스를 통합적으로 수행하도록
**So that** Telegram/Slack 메시지 또는 음성으로 "통화하듯" 개발 작업을 위임하고 결과를 받을 수 있다

## Deployment Modes

| Mode | User | Google Account | Docker | Auth |
|------|------|---------------|--------|------|
| Local (npm) | 본인 1명 | 본인 Google 계정 | 선택 | 불필요 |
| SaaS (cloud) | 다수 유료 | 각자 Google 계정 | 필수 | JWT/OAuth |
