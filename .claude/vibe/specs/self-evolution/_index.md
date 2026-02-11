---
status: pending
currentPhase: 0
totalPhases: 5
createdAt: 2026-02-10T00:30:00+09:00
lastUpdated: 2026-02-10T00:30:00+09:00
---

# SPEC: self-evolution (Master)

## Overview

vibe가 사용 경험에서 스스로 배우고, 부족한 능력을 자동으로 보충하는 자기진화(Self-Evolution) 시스템.

- Total phases: 5
- Dependencies: 기존 Memory System, Skill System, Agent Registry, Hook System
- Estimated files: 20+

## Sub-SPECs

| Order | SPEC File | Feature File | Description | Status |
|-------|-----------|--------------|-------------|--------|
| 1 | phase-1-reflection.md | phase-1-reflection.feature | Self-Reflection (자동 성찰) | ⬜ |
| 2 | phase-2-insight.md | phase-2-insight.feature | Insight Extraction (인사이트 추출) | ⬜ |
| 3 | phase-3-generation.md | phase-3-generation.feature | Auto Generation (Skill/Agent/Rule 자동 생성) | ⬜ |
| 4 | phase-4-validation.md | phase-4-validation.feature | Validation & Lifecycle (검증 및 생명주기) | ⬜ |
| 5 | phase-5-integration.md | phase-5-integration.feature | Integration & Hook (시스템 통합) | ⬜ |

## Shared Context

### Tech Stack
- Runtime: Node.js 18+ (ESM)
- Language: TypeScript (strict mode)
- Storage: SQLite (better-sqlite3, WAL mode, FTS5)
- Schema validation: Zod
- Testing: Vitest

### Architecture Principles (Research Consensus)
- **Event-sourced observation log**: 관찰은 불변 append-only 로그
- **Episodic-to-Semantic promotion**: 에피소딕(원시) → 시맨틱(규칙/스킬) 승격
- **Transactional pre-compaction flush**: 압축 전 원자적 플러시
- **Sandboxed validation**: 생성된 skill은 샌드박스에서 검증 후 승격
- **Quality Gate + TTL + Trigger 충돌검사**: 3중 안전장치

### Security Requirements (Research Consensus)
- 생성된 skill/agent/rule은 **untrusted input**으로 취급
- Trigger 패턴은 **유니크 제약조건** + 기존 skill과 충돌 검사
- 순환 trigger chain 방지 (최대 depth 10)
- Prompt injection 방지: 허용 스키마 기반 입력 sanitization
- Rollback: 문제 발생 시 즉시 비활성화 + 이전 버전 복원

### Constraints
- 기존 MemoryStorage, SessionRAG, AgentRegistry 인터페이스 유지
- 새 SQLite 테이블은 기존 DB에 추가 (별도 DB 파일 생성 안함)
- **동시 접근 보호**: WAL 모드 + `PRAGMA busy_timeout = 5000` 설정. 모든 쓰기는 단일 트랜잭션 내 완료
- config.json에 `evolution` 키로 설정 (기본값: suggest 모드)
- 모든 생성물은 `~/.claude/vibe/skills/auto/`, `~/.claude/agents/auto/`, `~/.claude/vibe/rules/auto/`에 저장
- **생성물은 마크다운 지시문**(LLM용 프롬프트 템플릿)이며, 실행 가능한 코드가 아님. 단, 콘텐츠 검증(Zod 스키마 + 금지 패턴 검사)은 필수
