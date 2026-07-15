---
name: utils-dissolution
status: approved
created: 2026-07-07
depends: system-lean-hardening
---

# SPEC: utils-dissolution — vibe.utils 해체 + documenter/diagrammer 제거

## 목표 (Done 의 정의)

`vibe.utils` 모놀리스(9모드)를 해체해 각 기능을 명시적 스킬/기존 스킬 모드/툴 호출로 재배치하고,
thin 에이전트 2기(documenter·diagrammer)를 제거하되 프롬프트 규약은 docs/references/ 로 보존한다.
완료 = 수용 기준 전부 통과 + build/vitest 그린 + `vibe.utils`·두 에이전트 무참조.

## 모드 이관 매핑 (승인됨)

| vibe.utils 모드 | 이관처 | 방식 |
|---|---|---|
| --continue | 신규 entry 스킬 `vibe.continue` | 12개 참조처 전부 갱신 |
| --image | 신규 entry 스킬 `vibe.image` | llm-orchestrate.js 툴 호출 래퍼, references 승계 |
| --diagram | `docs` 스킬 diagram 모드 | diagrammer.md 프롬프트 → docs/references/diagram-spec.md |
| --codemaps | `docs` 스킬 codemaps 모드 | references/codemaps-output.md 승계 |
| (documenter 규약) | docs/references/api-docs-changelog.md | documenter.md 프롬프트 이관, docs 는 네이티브/general-purpose 로 실행 |
| --ui | `vibe.design` preview 모드 | references/ui-preview.md 승계 |
| --e2e | 삭제 (vibe.verify --e2e 가 동일 기능) | prompt-dispatcher.js:79 안내문 교체 |
| --build-fix | 삭제 (build-error-resolver 프로액티브 트리거가 커버) | — |
| --clean | 폐기 (승인: /simplify + 모델 네이티브로 충분) | — |
| --compound | 폐기 (승인: post-task curation recipe-extractor 가 대체) | — |

## 작업 항목

### Track A — skills + agents 파일
- A1 `skills/vibe.continue/SKILL.md` 신설 (소형, --continue 내용 승계: core_start_session → 컨텍스트 복원 → 체크포인트 재개)
- A2 `skills/vibe.image/SKILL.md` 신설 (--image 의 MANDATORY 툴 호출 블록 + references/image-generation-examples.md 이동)
- A3 `skills/docs/` 에 diagram·codemaps 모드 추가 — agents/diagrammer.md·documenter.md 프롬프트 규약을 `skills/docs/references/` 로 이관 후 두 에이전트 .md 삭제. docs/SKILL.md 의 Task(documenter/diagrammer) 호출을 네이티브 실행(+이관된 규약 Read)으로 교체. `vibe.docs` entry 라우팅 갱신
- A4 `skills/vibe.design/` 에 preview 모드 추가 (references/ui-preview.md 이동)
- A5 `skills/vibe.utils/` 디렉토리 삭제
- A6 참조 스킬 갱신: handoff(SKILL.md:19-21,101 + templates/handoff.md:89), exec-plan(SKILL.md:132 + templates/plan.md:147), vibe(SKILL.md 라우팅 표의 utils 행 → continue/image/docs 로 재배치)

### Track B — src/hooks/templates/문서
- B1 constants.ts: GLOBAL_SKILLS_ENTRY − vibe.utils + vibe.continue + vibe.image; LEGACY_SKILL_DIRS += 'vibe.utils'
- B2 constants.ts 에이전트 매핑에서 documenter·diagrammer 제거 (CLAUDE_MODEL_MAPPING 등 전체) + claude-agents.ts descriptions; remove.ts 는 stale-cleanup 목록 유지
- B3 `/vibe.utils --continue` 참조 교체 → `/vibe.continue`: ProjectSetup.ts:140,141,399 · inline-skills.ts:131,143 · SkillRepository.ts:513 · info.ts:54 · vibe/templates/claudemd-template.md:67 · CLAUDE.md:134 · AGENTS.md:131
- B4 hooks: session-start.js:92,107 힌트 → `/vibe.continue`; prompt-dispatcher.js:79 E2E echo → `/vibe.verify --e2e`
- B5 카운트 갱신: README.md·README.en.md·package.json (agents 9+→7+, skills 59→60) — validate-counts 그린 유지
- B6 agent-model-sync 대상 13→11 (테스트/스크립트 정합)

## 수용 기준

1. `npm run build` + `npx vitest run` 전체 그린 (wiring-integrity 포함 — vibe.continue/vibe.image 설치 목록 검증 자동 편입)
2. `grep -rn "vibe\.utils" src/ hooks/ skills/ vibe/ CLAUDE.md AGENTS.md` = 0 (LEGACY_SKILL_DIRS·uninstall 목록·.vibe 문서 제외)
3. `grep -rn "documenter\|diagrammer" src/ hooks/ skills/ agents/` = 0 (stale-cleanup 목록·docs/references 이관 문서 제외)
4. `npx tsx scripts/validate-counts.ts` · `validate-skill-invocation.ts` · `sync-agent-models.ts --check` 그린
5. session-start 힌트·prompt-dispatcher echo 가 새 경로 안내
6. 이관 규약 보존: diagrammer·documenter 프롬프트 내용이 docs/references/ 에 존재
