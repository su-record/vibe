---
status: pending
currentPhase: 0
totalPhases: 3
createdAt: 2026-03-31T14:30:00Z
lastUpdated: 2026-03-31T14:30:00Z
---

# SPEC: PM Skills + Workflow Chaining System

## Persona
<role>
Senior TypeScript developer working on the @su-record/vibe npm package.
- Follow ESM module patterns (`.js` extensions in imports)
- Strict TypeScript (no `any`, explicit return types)
- Modify only files in scope; preserve existing conventions
</role>

## Context
<context>
### Background
vibe는 개발자 워크플로우 스킬을 제공하지만, PM(Product Management) 도메인 스킬이 없음.
pm-skills 레포(phuryn/pm-skills)에서 검증된 PM 프레임워크 기반 스킬 3개를 vibe 포맷으로 변환하여 추가.
동시에, 스킬 간 워크플로우 체이닝을 위한 `chain-next` 메타데이터 필드를 도입.

### Why
- PM capability 추가 → vibe 사용자층 확대 (개발자 + PM)
- chain-next → 스킬 완료 후 자동 다음 스킬 제안 (워크플로우 연속성)
- 기존 vibe 스킬(vibe.spec → vibe.run → vibe.trace)도 같은 체이닝 프레임워크로 통합 가능

### Tech Stack
- TypeScript strict mode, ESM (`"type": "module"`)
- Build: `tsc` → `dist/`
- Test: `vitest`

### Related Code
- `src/cli/postinstall/constants.ts`: CAPABILITY_SKILLS, AVAILABLE_CAPABILITIES, resolveLocalSkills()
- `src/infra/lib/SkillFrontmatter.ts`: SkillMetadata interface, parseSimpleYaml(), generateSkillFrontmatter()
- `skills/*/SKILL.md`: 기존 26개 스킬 파일

### Source Material
- `/Users/grove/workspace/pm-skills/pm-execution/skills/create-prd/SKILL.md`
- `/Users/grove/workspace/pm-skills/pm-execution/skills/prioritization-frameworks/SKILL.md`
- `/Users/grove/workspace/pm-skills/pm-market-research/skills/user-personas/SKILL.md`
</context>

## Task
<task>
### Phase 1: chain-next 메타데이터 필드 추가
1. [ ] `src/infra/lib/SkillFrontmatter.ts` — `SkillMetadata` interface에 `chainNext?: string[]` 추가
   - File: `src/infra/lib/SkillFrontmatter.ts:11`
   - 변경: interface에 optional field 추가
   - Verify: `npm run build`
2. [ ] `src/infra/lib/SkillFrontmatter.ts` — `generateSkillFrontmatter()`에 chain-next 출력 로직 추가
   - File: `src/infra/lib/SkillFrontmatter.ts:113`
   - 변경: `if (metadata.chainNext)` 블록 추가 (priority 다음 위치에 삽입)
   - 직렬화: `chain-next: [${metadata.chainNext.join(', ')}]` (인라인 배열 형식)
   - 참고: `parseSimpleYaml()`은 이미 인라인 배열 `[a, b]`/kebab-to-camelCase 지원 → 파싱은 수정 불필요
   - Verify: `npm run build`
3. [ ] `src/infra/lib/SkillFrontmatter.ts` — `mergeWithDefaults()`에 chainNext 기본값 추가
   - File: `src/infra/lib/SkillFrontmatter.ts:198`
   - 변경: `chainNext: metadata.chainNext` 추가

### Phase 2: PM 스킬 3개 생성
1. [ ] `skills/create-prd/SKILL.md` 생성
   - pm-skills의 create-prd를 vibe 포맷으로 변환
   - frontmatter: name, description, triggers, priority, chain-next
   - 내용: 8-section PRD 템플릿 (개발자 컨텍스트 적용)
   - chain-next: [user-personas, prioritization-frameworks]
2. [ ] `skills/prioritization-frameworks/SKILL.md` 생성
   - pm-skills의 prioritization-frameworks를 vibe 포맷으로 변환
   - 내용: 9개 프레임워크 레퍼런스 가이드
   - chain-next: [create-prd]
3. [ ] `skills/user-personas/SKILL.md` 생성
   - pm-skills의 user-personas를 vibe 포맷으로 변환
   - 내용: 리서치 기반 3개 페르소나 생성 워크플로우
   - chain-next: [create-prd, prioritization-frameworks]

### Phase 3: PM capability 등록 + 기존 스킬 chain-next 소급
1. [ ] `src/cli/postinstall/constants.ts` — CAPABILITY_SKILLS에 pm 매핑 추가
   - File: `src/cli/postinstall/constants.ts:44`
   - 추가: `'pm': ['create-prd', 'prioritization-frameworks', 'user-personas']`
2. [ ] `src/cli/postinstall/constants.ts` — AVAILABLE_CAPABILITIES에 PM 항목 추가
   - File: `src/cli/postinstall/constants.ts:60`
   - 추가: `{ value: 'pm', label: 'Product Management', hint: 'PRD, 우선순위, 페르소나 등' }`
3. [ ] 기존 핵심 스킬에 chain-next 소급 적용 (4개 수정, 1개 확인만)
   - `skills/commit-push-pr/SKILL.md`: chain-next: [techdebt]
   - `skills/parallel-research/SKILL.md`: chain-next: [exec-plan]
   - `skills/techdebt/SKILL.md`: chain-next: [commit-push-pr]
   - `skills/exec-plan/SKILL.md`: chain-next: [commit-push-pr]
   - `skills/handoff/SKILL.md`: 변경 없음 (세션 종료 스킬 — chain-next 불필요)
4. [ ] 빌드 및 테스트
   - Verify: `npm run build`
   - Verify: `npx vitest run src/infra/lib/SkillFrontmatter`
</task>

## Constraints
<constraints>
- ESM import에 `.js` 확장자 필수
- `any` 사용 금지 — `unknown` + type guard
- 함수 50줄 이내, 중첩 3레벨 이내
- pm-skills 원본 라이선스 존중 (MIT) — 변환 시 attribution 포함
- 기존 스킬의 기능 변경 금지 — frontmatter에 chain-next 추가만
- `parseSimpleYaml()`은 이미 `chain-next` → `chainNext` 변환을 처리함 (kebab-to-camelCase)
- `chainNext`는 빈 배열 허용 (`[]`) — 체이닝 없는 스킬을 명시적으로 표현
- `chainNext` 값은 파싱 시점에 유효성 검증하지 않음 (런타임 해석) — 존재하지 않는 스킬 이름이어도 파싱 에러 아님
- vibe 포맷 = YAML frontmatter (name, description, triggers, priority 필수) + Markdown body
- `generateSkillFrontmatter()` 시 `chainNext`가 `undefined`이면 chain-next 필드 생략, 빈 배열이면 `chain-next: []` 출력
</constraints>

## Output Format
<output_format>
### Files to Create
- `skills/create-prd/SKILL.md`
- `skills/prioritization-frameworks/SKILL.md`
- `skills/user-personas/SKILL.md`

### Files to Modify
- `src/infra/lib/SkillFrontmatter.ts` (interface + generate + merge)
- `src/cli/postinstall/constants.ts` (CAPABILITY_SKILLS + AVAILABLE_CAPABILITIES)
- `skills/commit-push-pr/SKILL.md` (chain-next 추가)
- `skills/parallel-research/SKILL.md` (chain-next 추가)
- `skills/techdebt/SKILL.md` (chain-next 추가)
- `skills/exec-plan/SKILL.md` (chain-next 추가)

### Verification Commands
- `npm run build`
- `npx vitest run src/infra/lib/SkillFrontmatter`
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] AC-1: `SkillMetadata.chainNext` 타입이 `string[] | undefined`
- [ ] AC-2: `generateSkillFrontmatter()`가 chain-next 배열을 YAML로 직렬화
- [ ] AC-3: `parseSimpleYaml()`가 `chain-next: [a, b]`를 `chainNext: ['a', 'b']`로 파싱 (기존 동작 확인)
- [ ] AC-4: PM 스킬 3개 각각 vibe frontmatter 필수 필드 포함 (name, description, triggers, priority)
- [ ] AC-5: PM 스킬 3개 각각 chain-next 필드 포함
- [ ] AC-6: CAPABILITY_SKILLS에 `pm` 키 존재
- [ ] AC-7: AVAILABLE_CAPABILITIES에 PM 항목 존재
- [ ] AC-8: 기존 4개 스킬에 chain-next 추가됨
- [ ] AC-9: `npm run build` 성공
- [ ] AC-10: 기존 테스트 통과 (pre-existing failures 제외)
- [ ] AC-11: `generateSkillFrontmatter()`가 `chainNext: undefined`일 때 chain-next 필드 생략
- [ ] AC-12: `generateSkillFrontmatter()`가 `chainNext: []`일 때 `chain-next: []` 출력
</acceptance>
