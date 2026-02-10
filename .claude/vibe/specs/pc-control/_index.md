---
status: pending
currentPhase: 0
totalPhases: 6
createdAt: 2026-02-10T07:13:10Z
lastUpdated: 2026-02-10T07:13:10Z
---

# SPEC: pc-control (Master)

## Overview

VIBE를 **개발에 특화된 풀스택 AI 에이전트**로 확장한다. 보고(Vision), 조작하고(Browser), 소통하고(Google Apps/Email), 대화하는(Voice) 에이전트를 구현하여, 개인 npm 설치 및 SaaS 클라우드 배포 모두 지원한다.

- **Total phases**: 6
- **Dependencies**: OpenClaw `src/browser/` 참조 (MIT License)
- **Target**: `@su-record/core` npm 패키지 확장

## Sub-SPECs

| Order | SPEC File | Feature File | 핵심 | Status |
|-------|-----------|--------------|------|--------|
| 1 | phase-1-browser-automation.md | phase-1-browser-automation.feature | Playwright ARIA Snapshot 기반 브라우저 제어 | ⬜ |
| 2 | phase-2-google-apps.md | phase-2-google-apps.feature | Per-user Google Apps OAuth (Gmail/Drive/Sheets/Calendar) | ⬜ |
| 3 | phase-3-voice-pipeline.md | phase-3-voice-pipeline.feature | PWA 마이크 + TTS + 양방향 음성 | ⬜ |
| 4 | phase-4-vision-live.md | phase-4-vision-live.feature | Gemini Live 실시간 화면 (Full/Region/Window) | ⬜ |
| 5 | phase-5-docker-sandbox.md | phase-5-docker-sandbox.feature | Docker 멀티테넌시 격리 | ⬜ |
| 6 | phase-6-integration.md | phase-6-integration.feature | 전체 통합 + 메시지/음성 통합 인터페이스 | ⬜ |

## Shared Context

### Tech Stack
- Runtime: Node.js 22+ / TypeScript (ESM)
- Database: SQLite (WAL mode, better-sqlite3)
- Browser: Playwright 1.58+ (ARIA Snapshot API)
- AI: Claude Code + GPT + Gemini + Kimi K2.5
- Google: googleapis (OAuth 2.0 + PKCE)
- Voice: Web Speech API / WebRTC / Gemini Live
- TTS: Google Cloud TTS / Edge TTS / OpenAI TTS
- Container: Dockerode
- Auth: JWT (jose)

### Deployment Modes
| Mode | 사용자 | Google 계정 | Docker | 인증 |
|------|--------|------------|--------|------|
| **Local (npm)** | 본인 1명 | 본인 Google 계정 | 선택 | 불필요 |
| **SaaS (cloud)** | 다수 유료 | 각자 Google 계정 | 필수 | JWT/OAuth |

### Constraints
- 기존 VIBE 아키텍처(daemon, interface, policy, router) 유지
- `@su-record/core` 패키지 구조 내에서 확장
- OpenClaw 코드 직접 복사 금지 → 패턴만 참조하여 VIBE 스타일로 재구현
- TypeScript strict mode, no `any`, explicit return types
- 함수 ≤30줄, 중첩 ≤3레벨, cyclomatic complexity ≤10

### Security Requirements (Research-based)
- OAuth: PKCE + incremental scopes + token envelope encryption
- Browser: 에피소드 단위 ephemeral context (cross-tenant 격리)
- Docker: rootless + read-only FS + dropped capabilities + seccomp
- Voice: VAD 기반 명시적 녹음 시작 + 영구 표시기
- Screen: 캡처 대상 명시적 동의 + 소스 변경 시 재동의
- Token: refresh token rotation + reuse detection + DPoP (서버 지원 시)

### Cross-Phase Dependency Matrix
| Source | Depends On | Condition | Notes |
|--------|-----------|-----------|-------|
| Phase 1 (Browser) | Phase 5 (Sandbox) | SaaS 모드 | IBrowserProvider 인터페이스로 분리 |
| Phase 4 (Vision) | Phase 5 (Sandbox) | SaaS 모드 | RemoteCaptureSource로 샌드박스 Xvfb 접근 |
| Phase 4 (Vision) | Phase 3 (Voice) | 양방향 대화 | Vision+Voice 동시 세션 관리 필요 |
| Phase 6 (Integration) | Phase 5 (Sandbox) | SaaS 모드 | SecurityGate → ToolPolicy 체인 |
| Phase 6 (Integration) | Phase 1-4 | 항상 | ModuleRegistry로 lazy load |
| Phase 2 (Google) | Phase 6 (Integration) | SaaS 모드 | OAuth Relay Service 필요 |

### Performance Benchmark Profile
- 테스트 환경: 4-core CPU, 8GB RAM, SSD, 100Mbps 네트워크
- 측정: 30회 반복, P95 기준
- 외부 API 호출: mock 처리 (latency simulation 50ms)
