---
status: pending
phase: 5
parent: _index.md
---

# SPEC: openclaw-integration — Phase 5: Skill System Enhancement

## Persona
<role>
Senior JavaScript/TypeScript 개발자. Hook 시스템, YAML 파싱, CLI 도구 탐지에 경험이 있으며, Vibe의 skill-injector.js 아키텍처를 이해한다.
</role>

## Context
<context>
### Background
스킬 시스템을 3계층 로딩(Progressive Disclosure)으로 개선하고, 스킬 의존성 확인/자동 설치 기능을 추가한다.

### Tech Stack
- JavaScript (CommonJS — hooks/scripts/ 디렉토리는 CJS)
- Node.js `child_process.spawnSync` (binary 확인용, shell:false)
- YAML frontmatter 파싱

### Related Code
- `hooks/scripts/skill-injector.js`: 현재 스킬 매칭/주입 로직
- `hooks/hooks.json`: hook 이벤트 등록
- `src/cli/postinstall/inline-skills.ts`: 기본 스킬 시딩
- `skills/`: 16개 번들 스킬 (markdown 파일)

### Design Reference
- OpenClaw `src/agents/skills/workspace.ts`: 스킬 로딩, 필터링, 프롬프트 생성
- OpenClaw `src/agents/skills/config.ts`: eligibility checking (binary/env/config)
- OpenClaw `src/agents/skills/frontmatter.ts`: metadata 파싱 + OpenClaw 메타데이터
- OpenClaw `skills/skill-creator/SKILL.md`: Progressive Disclosure 가이드
</context>

## Task
<task>
### Phase 5-A: Skill Progressive Disclosure

1. [ ] `hooks/scripts/skill-injector.js` 수정 (~+80 lines)
   - **Tier 1 - Metadata (항상 로드):**
     - 스킬 파일에서 frontmatter만 파싱 (body 제외)
     - 세션 시작 시 모든 스킬 metadata를 메모리에 캐시
     - 디스크 캐시: `.skills-cache.json` (파싱 결과 + 각 파일 mtime 저장, mtime 변경 시만 재파싱)
     - 캐시 구조: `{ name, description, triggers, tier, requires, os, maxBodyTokens }`
     - metadata 전체 크기: 스킬당 ~100 words
   - **Tier 2 - Body (트리거 매칭 시 로드):**
     - 기존 동작 유지 (trigger match → full body 로드)
     - `maxBodyTokens` 필드 지원: 설정 시 body를 해당 토큰 수로 절삭
     - 기본값: 제한 없음 (현재 동작 유지)
   - **Tier 3 - Resources (명시적 요청 시 로드):**
     - 스킬 디렉토리에 `scripts/`, `references/`, `assets/` 하위 디렉토리 감지
     - body에서 직접 로드하지 않음
     - 주입 시 리소스 존재 알림만 포함:
       `<!-- Resources available: scripts/model_usage.py, references/config.md -->`

   - 새 함수:
     - `loadSkillMetadataOnly(skillPath)`: frontmatter만 읽기 (body 무시)
     - `loadSkillBody(skillPath)`: body 섹션만 읽기
     - `listSkillResources(skillDir)`: scripts/, references/, assets/ 파일 목록

   - 주입 포맷 변경:
     ```
     <mnemosyne>
     ## Available Skills (metadata only)
     - skill-a: description (triggers: x, y)
     - skill-b: description (triggers: z)

     ## Triggered Skills (full body)

     ### skill-a (project)
     [full body content]
     <!-- Resources: scripts/helper.py, references/api-docs.md -->

     </mnemosyne>
     ```

2. [ ] frontmatter 확장 필드 지원
   - `tier`: `'metadata' | 'body' | 'full'` (기본: 'body')
   - `requires`: `string[]` — 필요한 바이너리 목록 (예: `["docker", "kubectl"]`)
   - `install`: `Record<string, string>` — 설치 방법 (예: `{ brew: "docker" }`)
   - `os`: `string[]` — 지원 플랫폼 (예: `["darwin", "linux"]`)
   - `maxBodyTokens`: `number` — body 최대 토큰 수

### Phase 5-B: Skill Dependencies / Auto-Install Check

3. [ ] `hooks/scripts/skill-requirements.js` 생성 (~70 lines)
   - `checkBinaryExists(name)`: `spawnSync` 사용 (shell:false), 바이너리명은 `/^[a-zA-Z0-9._-]+$/` 정규식 검증 후 실행
   - macOS/Linux: `which`, Windows: `where`
   - spawnSync timeout: 1초 (hook 지연 방지)
   - 결과 캐시: in-memory Map, TTL 5분 (`Date.now()` 기반)
   - `checkAllRequirements(requires)`: 전체 바이너리 확인, 결과 배열 반환
   - `getInstallHint(install, platform)`: 플랫폼별 설치 명령어 문자열
   - `checkPlatform(os)`: `process.platform` 확인

4. [ ] `hooks/scripts/skill-injector.js` 추가 수정 (~+50 lines)
   - `checkSkillEligibility(metadata)` 함수 추가:
     ```javascript
     function checkSkillEligibility(metadata) {
       // 1. Platform check
       if (metadata.os && !metadata.os.includes(process.platform)) {
         return { eligible: false, reason: `Platform ${process.platform} not supported` };
       }
       // 2. Binary check
       if (metadata.requires) {
         const missing = metadata.requires.filter(b => !checkBinaryExists(b));
         if (missing.length > 0) {
           return { eligible: false, reason: `Missing: ${missing.join(', ')}`, installHint: ... };
         }
       }
       return { eligible: true };
     }
     ```
   - `findMatchingSkills()` 에 eligibility 체크 추가
   - 부적격 스킬은 주입 skip + 알림 포함:
     ```
     <!-- Skill "docker-deploy" skipped: Missing docker. Install: brew install docker -->
     ```
   - 적격 여부 캐시 (세션 동안 유지)

5. [ ] 기존 스킬에 메타데이터 예시 추가 (선택적, 기존 스킬 호환성)
   - `skills/` 디렉토리의 기존 스킬은 변경 없이 동작해야 함
   - 새 필드가 없으면 기존 동작 유지 (backward compatible)
</task>

## Constraints
<constraints>
- hooks/scripts/ 디렉토리는 CommonJS (import 대신 require 사용)
- `which` 명령 실행은 동기적 (`spawnSync`, shell:false, 1초 timeout) — hook은 빠르게 완료되어야 함
- Binary 확인 캐시 TTL: 5분 (매 프롬프트마다 실행하지 않음)
- 기존 스킬 파일(새 필드 없는)은 변경 없이 정상 동작해야 함
- `maxBodyTokens`는 추정치 (정확한 토큰 카운팅 불필요, 문자 수 기반 추정: 1 token ≈ 4 chars)
- Progressive Disclosure는 성능 최적화 목적 — 50+ 스킬에서도 주입 시간 <100ms
- Metadata 캐시는 세션당 1회 로드 (세션 재시작 시 갱신, SESSION_CACHE와 동일 생명주기)
- install 필드는 안내만 제공 (자동 실행 안 함) — 보안상 사용자 확인 필요
</constraints>

## Output Format
<output_format>
### Files to Create
- `hooks/scripts/skill-requirements.js` (~70 lines)
- `hooks/scripts/__tests__/skill-injector.test.js` (~100 lines)

### Files to Modify
- `hooks/scripts/skill-injector.js` (~+130 lines)

### Verification Commands
- `node --test hooks/scripts/__tests__/skill-injector.test.js` (Node test runner)
- 수동 테스트: `echo '{"prompt":"deploy docker"}' | node hooks/scripts/skill-injector.js`
- `npm run build` (TypeScript 파일 변경 없으므로 빌드 영향 없음)
- Hook 동작 확인: 프롬프트 입력 시 `<mnemosyne>` 태그에 Available/Triggered 구분 확인
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] 스킬 50개 로딩 시 metadata 파싱이 100ms 이내 완료
- [ ] 트리거 매칭되지 않은 스킬은 이름+설명만 표시 (body 미포함)
- [ ] 트리거 매칭된 스킬은 전체 body 포함
- [ ] `maxBodyTokens: 1000` 설정 시 body가 ~4000자로 절삭
- [ ] scripts/, references/ 디렉토리가 있는 스킬에 리소스 목록 포함
- [ ] `requires: ["docker"]` 설정 시 docker 없는 환경에서 skip + 설치 안내
- [ ] `os: ["darwin"]` 설정 시 Linux에서 해당 스킬 skip
- [ ] 새 필드가 없는 기존 스킬은 변경 없이 정상 동작
- [ ] Binary 확인이 5분 동안 캐시됨 (같은 바이너리 재확인 안 함)
- [ ] skip된 스킬에 대해 설치 안내 HTML 주석 포함
</acceptance>
