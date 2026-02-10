---
status: pending
phase: 5
---

# SPEC: self-evolution — Phase 5: Integration & Hook

## Persona
<role>
Senior TypeScript engineer integrating subsystems into a cohesive pipeline.
Wire all evolution components into vibe's hook system and CLI.
</role>

## Context
<context>
### Background
Phase 1-4의 모든 컴포넌트를 vibe의 기존 hook 시스템, CLI, config에 통합.
사용자가 의식하지 않아도 자동으로 작동하는 seamless한 경험 제공.

### 기존 시스템
- `hooks/scripts/prompt-dispatcher.js`: 사용자 프롬프트 라우팅
- `hooks/scripts/skill-injector.js`: trigger 매칭 + skill 주입
- `hooks/scripts/context-save.js`: 컨텍스트 압력 관리
- `src/cli/commands/`: CLI 명령어 모듈
- `.claude/vibe/config.json`: 프로젝트별 설정
</context>

## Task
<task>
### Phase 5-1: Evolution Hook
1. [ ] `hooks/scripts/evolution-engine.js` 생성
   - File: `hooks/scripts/evolution-engine.js`
   - Hook event: `PostToolUse` (Write/Edit 완료 후)
   - 트리거 조건: 세션 내 5번째 tool use마다 (과도한 호출 방지)
   - 동작:
     1. InsightExtractor.extractFromRecent() 호출
     2. 새 insight 발견 시 → EvolutionOrchestrator.generate()
     3. suggest 모드: 사용자에게 알림 ("새 skill 후보 발견: {name}")
     4. auto 모드: 자동 생성 + 로그
   - **비동기 fire-and-forget 패턴**: hook은 즉시 반환 (< 5ms), 실제 처리는 백그라운드 큐에 등록
   - 실행 모델: `setImmediate()` 콜백으로 등록 → 현재 이벤트 루프 틱 완료 후 실행. better-sqlite3의 동기 호출은 별도 스레드가 아닌 다음 이벤트 루프에서 실행되므로, hook 반환은 즉시 (< 5ms) 보장
   - 백그라운드 처리 시간: < 1초 (SQLite 쿼리만, LLM 호출 없음)
   - 에러 격리: 백그라운드 처리 실패 시 try-catch로 stderr 로그만 남기고, 메인 도구 실행에 영향 없음
   - 메인 도구 실행을 차단하지 않음

### Phase 5-2: Prompt Dispatcher Gap Detection
2. [ ] `hooks/scripts/prompt-dispatcher.js` 수정
   - File: `hooks/scripts/prompt-dispatcher.js`
   - 변경: 매칭 실패 시 로깅 추가
     ```javascript
     // 기존: 매칭 없으면 그냥 통과
     // 변경: 매칭 없으면 gap 로깅
     logGap(userPrompt, timestamp);
     ```
   - Gap 로그 저장: `SkillGapDetector.logMiss(prompt, timestamp)`
   - `evolution.gapDetection: true` (config 기본값) 일 때만 동작

### Phase 5-3: Skill Injector 확장
3. [ ] `hooks/scripts/skill-injector.js` 수정
   - File: `hooks/scripts/skill-injector.js`
   - 변경 1: `auto/` 디렉토리의 skill도 스캔
   - 변경 2: `.disabled` 확장자 파일 무시
   - 변경 3: auto-generated skill 주입 시 UsageTracker 호출
   - 변경 4: `generated: true` frontmatter가 있으면 사용 추적

### Phase 5-4: CLI Commands
4. [ ] `src/cli/commands/evolution.ts` 생성
   - File: `src/cli/commands/evolution.ts`
   - Commands:
     ```
     vibe evolution status           # 전체 현황
     vibe evolution list             # 생성물 목록 (skill/agent/rule)
     vibe evolution approve <id>     # draft → testing 승인
     vibe evolution reject <id>      # draft 거부
     vibe evolution disable <id>     # 비활성화
     vibe evolution rollback <id>    # 이전 버전 복원
     vibe evolution disable-all      # 긴급 전체 비활성화
     vibe evolution run              # 수동 evolution cycle 실행
     vibe evolution insights         # 현재 insights 목록
     vibe evolution gaps             # 발견된 skill gaps
     ```

### Phase 5-5: Config Integration
5. [ ] `.claude/vibe/config.json` evolution 설정
   - File: `.claude/vibe/config.json`
   - 추가 키:
     ```json
     {
       "evolution": {
         "enabled": true,
         "mode": "suggest",
         "gapDetection": true,
         "autoReflection": true,
         "maxGenerationsPerCycle": 5,
         "ttlDays": 7,
         "minQualityScore": 60,
         "useLLMInsight": false,
         "circuitBreaker": {
           "failureThreshold": 0.5,
           "cooldownMinutes": 30
         }
       }
     }
     ```
   - ultrawork 모드 감지 시: `mode` 자동 override → `"auto"`

### Phase 5-6: Session Start Integration
6. [ ] `hooks/scripts/session-start.js` 수정
   - File: `hooks/scripts/session-start.js`
   - 변경: 세션 시작 시 evolution status 요약 표시
     ```
     🧬 Evolution: 3 active skills, 2 pending approval, 1 gap detected
     ```
   - high-value reflections 자동 주입 (Phase 1과 연계)
   - suggest 모드에서 pending drafts 알림

### Phase 5-7: Export & Module Index
7. [ ] `src/lib/evolution/index.ts` 생성
   - File: `src/lib/evolution/index.ts`
   - 모든 evolution 모듈 re-export
   - `src/tools/evolution/index.ts` — 모든 evolution tools re-export
   - `package.json` exports에 `"./evolution"` 추가
</task>

## Constraints
<constraints>
- evolution-engine.js hook은 비동기 fire-and-forget (즉시 반환 < 5ms, 백그라운드 처리 < 1초)
- config.json의 `evolution.enabled: false`면 모든 evolution 기능 비활성화
- 기존 hook 동작에 영향 없음 (evolution은 추가 동작)
- CLI 명령어는 `vibe evolution` 네임스페이스 하위에만
- ultrawork 모드 감지: keyword-detector.js의 기존 로직 활용
</constraints>

## Output Format
<output_format>
### Files to Create
- `hooks/scripts/evolution-engine.js`
- `src/cli/commands/evolution.ts`
- `src/lib/evolution/index.ts`
- `src/tools/evolution/index.ts`
- `src/lib/evolution/__tests__/integration.test.ts`

### Files to Modify
- `hooks/scripts/prompt-dispatcher.js` (gap detection 로깅)
- `hooks/scripts/skill-injector.js` (auto/ 스캔, .disabled 무시, usage tracking)
- `hooks/scripts/session-start.js` (evolution status 표시)
- `.claude/vibe/config.json` (evolution 설정 추가)
- `package.json` (exports에 ./evolution 추가)
- `src/cli/index.ts` (evolution CLI 등록)

### Verification Commands
- `vitest run src/lib/evolution/__tests__/integration.test.ts`
- `npx tsc --noEmit`
- `vibe evolution status` (CLI 테스트)
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] evolution-engine.js hook이 PostToolUse에서 작동함
- [ ] prompt-dispatcher가 매칭 실패를 gap으로 로깅함
- [ ] skill-injector가 auto/ 디렉토리를 스캔하고 .disabled를 무시함
- [ ] `vibe evolution status` CLI가 전체 현황을 표시함
- [ ] `vibe evolution approve/reject/disable/rollback` 명령어 작동
- [ ] config.json의 evolution.enabled=false 시 모든 기능 비활성화됨
- [ ] ultrawork 모드에서 evolution.mode가 auto로 override됨
- [ ] 세션 시작 시 evolution status 요약이 표시됨
- [ ] 모든 테스트 통과, 빌드 성공
</acceptance>
