---
status: pending
currentPhase: 0
totalPhases: 5
createdAt: 2026-02-10T15:00:00+09:00
lastUpdated: 2026-02-10T15:00:00+09:00
---

# SPEC: agent-autonomy (Master)

## Overview

vibe의 자율성을 확장하여 보안 감시(Security Sentinel) 기반의 안전한 자율 에이전트 시스템을 구축.
사용자의 명시적 요청 없이도 프로액티브하게 제안하고, 위험도에 따라 자동 실행 또는 오너 확인을 거치며,
멀티 에이전트 협업으로 복잡한 태스크를 자율적으로 분해·실행하는 시스템.

- Total phases: 5
- Dependencies: 기존 Memory System, Self-Evolution, Hook System, Notification Channels (Telegram/Slack/Web)
- Estimated files: 25+

## Sub-SPECs

| Order | SPEC File | Feature File | Description | Status |
|-------|-----------|--------------|-------------|--------|
| 1 | phase-1-event-core.md | phase-1-event-core.feature | Event Core & Audit Foundation | ⬜ |
| 2 | phase-2-security-sentinel.md | phase-2-security-sentinel.feature | Security Sentinel (보안 감시) | ⬜ |
| 3 | phase-3-owner-governance.md | phase-3-owner-governance.feature | Owner Confirmation & Governance | ⬜ |
| 4 | phase-4-proactive-intelligence.md | phase-4-proactive-intelligence.feature | Proactive Intelligence (프로액티브 지능) | ⬜ |
| 5 | phase-5-agent-collaboration.md | phase-5-agent-collaboration.feature | Multi-Agent Collaboration & Integration | ⬜ |

## Shared Context

### Tech Stack
- Runtime: Node.js 18+ (ESM)
- Language: TypeScript (strict mode)
- Storage: SQLite (better-sqlite3, WAL mode, FTS5, JSON1 확장 활성화)
- Schema validation: Zod
- Testing: Vitest
- Notifications: Telegram Bot API, Slack Socket Mode, WebSocket/SSE
- UUIDv7: `uuidv7` npm package (RFC 9562 compliant) — 모든 ID/correlationId에 사용
- JSON 컬럼: SQLite TEXT 타입 + JSON.stringify/JSON.parse (json_extract() 쿼리 지원)

### Architecture Principles (Research Consensus)

- **Event-Driven Governance**: 모든 에이전트 행위를 이벤트로 캡처, 정책 평가 후 실행 허가
- **Sentinel as PEP/PDP**: Security Sentinel은 Policy Enforcement Point + Policy Decision Point로 동작
- **Immutable Audit Trail**: append-only 감사 로그 + SQLite TRIGGER로 수정/삭제 방지
- **State Machine Confirmation**: PENDING_APPROVAL → APPROVED/REJECTED/EXPIRED 상태 머신
- **Transactional Outbox**: SQLite 트랜잭션 내 이벤트 저장 → 비동기 발행 (exactly-once)
- **Defense in Depth**: 입력 검증 → SQL 파라미터화 → 비즈니스 규칙 → 감사 로그 (4중 방어)
- **Risk-Based Gating**: LOW(자동)/MEDIUM(알림+진행)/HIGH(블록+확인) 3단계

### Security Requirements (Research Consensus)

- Sentinel은 self-evolution 대상에서 **제외** (불변)
- 오너만 Sentinel 정책 수정 가능
- 모든 자율 행위에 correlation ID 부여 (추적성)
- HIGH 위험 행위는 오너 확인 없이 실행 불가
- 감사 로그 위변조 방지 (SQLite TRIGGER: UPDATE/DELETE RAISE ABORT)
- 정책 버전 관리 + 서명된 정책 번들
- Race condition 방지: 원자적 상태 머신 전환 (SQLite 트랜잭션 내)
- Prompt injection 방지: 허용 스키마 기반 sanitization (Zod 스키마로 모든 문자열 파라미터 검증, 제어 문자/delimiter 패턴 차단)
- 감사 로그 민감 데이터 보호: payload 저장 전 PII/secrets 자동 redaction (정규식 기반: API 키, 토큰, 비밀번호 패턴 마스킹)
- CSRF 보호: Web API 상태 변경 엔드포인트에 Double Submit Cookie 패턴 적용

### Constraints

- 기존 evolution, memory, hooks 공개 API + export signature 유지 (내부 구현 변경 허용)
- 새 SQLite 테이블은 기존 memories.db에 추가
- WAL 모드 + `PRAGMA busy_timeout = 5000`
- config.json에 `sentinel` 키로 설정
- 모든 이벤트 처리는 리스너당 5ms, 전체 50ms 이내 완료 (비동기 작업: 최대 5초 타임아웃)
- 오너 확인 타임아웃: 기본 300초 (5분), 최대 3600초 (1시간)
- 알림 채널: 기존 Telegram/Slack/Web 재사용
- 자율 태스크 분해는 config.json `autonomy.mode`로 제어 (suggest/auto)
- 성능 테스트 기준 환경: 2+ vCPU, 4GB+ RAM, SSD 스토리지 (CI 환경 동등), p95 레이턴시 기준
- SQLite 스키마 마이그레이션: `schema_migrations` 테이블로 버전 관리, initTables()에서 증분 마이그레이션 적용
- 감사 로그 보관 정책: config.json `sentinel.auditRetentionDays` (기본: 무제한). 설정 시 프로세스 시작 + 24시간 간격으로 `DELETE FROM audit_events WHERE createdAt < datetime('now', '-N days')` 실행. immutable TRIGGER 우회: 정리 전 TRIGGER 일시 비활성화 → 정리 → TRIGGER 재활성화 (단일 트랜잭션 내)
