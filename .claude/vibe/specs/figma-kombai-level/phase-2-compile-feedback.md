---
status: pending
phase: 2
parent: _index.md
---

# SPEC: Phase 2 — 컴파일 에러 피드백 루프

## Persona
<role>
vibe.figma 스킬 개발자. 기존 Phase 4 검증 루프에 TypeScript 컴파일 에러 감지 및
자동 수정 루프를 추가하여, Kombai의 96% 컴파일 성공률에 근접하도록 한다.
</role>

## Context
<context>
### Background
현재 Phase 4 검증 루프는 **시각 비교**에 집중:
- 스크린샷 픽셀 비교 (pixelmatch)
- computed CSS 수치 비교
- 이미지/텍스트 누락 체크

하지만 **컴파일 에러**는 감지하지 않는다:
- TypeScript 타입 에러 (`tsc --noEmit`)
- 빌드 실패 (`npm run build`)
- ESLint 에러
- dev 서버 시작 실패

Kombai는 "TypeScript and compilation error detection with iterative fixes"를 내장하여
96% 컴파일 성공률을 달성한다.

### 현재 코드
- `skills/vibe.figma/SKILL.md` Phase 4 (line 357~491): 검증 루프
- Phase 4-0: dev 서버 시작 — 여기서 실패하면 검증 불가
- Phase 4-4: 자동 수정 루프 (시각 P1만 대상)
- `src/infra/lib/browser/`: 시각 비교 인프라 (변경 불필요)

### 핵심 문제
Phase 3 퍼즐 조립 후 dev 서버가 시작 안 되면 Phase 4 전체가 무력화됨.
컴파일 에러를 Phase 4 이전에 먼저 잡아야 한다.
</context>

## Task
<task>
### 2-1. Phase 3→4 사이 컴파일 검증 단계 추가 (`skills/vibe.figma/SKILL.md`)

Phase 3 완료 후, Phase 4 시작 전에 컴파일 게이트 추가:

1. [ ] Phase 3.5 "컴파일 게이트" 섹션 추가:
   ```
   ## Phase 3.5: 컴파일 게이트

   Phase 3 퍼즐 조립 완료 후, 브라우저 검증 전에 컴파일 성공을 보장한다.

   자동 반복: 컴파일 성공까지. 최대 3라운드.

   ### 3.5-1. TypeScript 컴파일 체크

   1. tsc --noEmit 실행 (또는 프로젝트의 type-check 명령):
      Bash: npx tsc --noEmit 2>&1
      → 에러 0개: PASS → 다음 단계
      → 에러 있음: 에러 메시지 파싱 → 자동 수정

   2. 에러 파싱:
      각 에러에서 추출: 파일 경로, 줄 번호, 에러 코드, 메시지
      예: "src/components/Hero.tsx(15,3): error TS2322: Type 'string' is not assignable to type 'number'"

   3. 자동 수정 (에러 유형별):
      - TS2322 (타입 불일치): prop 타입을 올바르게 수정
      - TS2304 (이름 없음): import 추가
      - TS2339 (프로퍼티 없음): interface에 프로퍼티 추가
      - TS7006 (암시적 any): 타입 어노테이션 추가
      - 기타: Read로 해당 파일+줄 확인 → 컨텍스트 기반 수정

   ### 3.5-2. 빌드 체크

   1. npm run build 실행:
      Bash: npm run build 2>&1
      → 성공: PASS → Phase 4 진행
      → 실패: 에러 메시지 파싱 → 자동 수정

   2. 일반적 빌드 에러 처리:
      - SCSS 컴파일 에러: 변수명/import 오류 수정
      - Module not found: import 경로 수정 (.js 확장자 등)
      - ESLint 에러 (--max-warnings 초과): 자동 수정 가능한 것 처리

   ### 3.5-3. dev 서버 시작 확인

   1. dev 서버 시작 + PID 캡처:
      Bash: npm run dev & echo $!  → DEV_PID 저장
      → localhost 포트 폴링 (3초 간격, 최대 30초 대기)
      → 성공: Phase 4 진행 (Phase 4 완료 후 kill $DEV_PID로 정리)
      → 실패: kill $DEV_PID → 에러 로그 확인 → 수정 → 재시도
      ※ Phase 4 완료 또는 3라운드 실패 시 반드시 pkill -P $DEV_PID && kill $DEV_PID 실행 (자식 프로세스 포함 정리)

   ### 3.5-4. 수정 루프

   라운드 1~3:
     1. tsc → build → dev 순서로 체크
     2. 첫 번째 실패 단계의 에러 수정
     3. 수정 후 해당 단계부터 재체크
     4. 모든 단계 통과: Phase 4 진행

   라운드 종료 조건:
     - 3라운드 후 실패: 에러 목록 + 시도한 수정을 사용자에게 보고
     - 같은 에러 반복: 해당 에러 스킵 불가 → 사용자 보고 (컴파일 에러는 스킵 불가)
   ```
   - File: `skills/vibe.figma/SKILL.md` Phase 3과 Phase 4 사이
   - Verify: Phase 3.5 섹션이 존재하고 tsc/build/dev 체크 절차가 명시됨

### 2-2. Phase 4 수정 루프에 컴파일 체크 통합 (`skills/vibe.figma/SKILL.md`)

Phase 4-4 자동 수정 루프 (line 449~464) 확장:

1. [ ] 시각 수정 후 컴파일 재검증 추가:
   ```
   Phase 4-4 자동 수정 루프 (확장):

   라운드 1~3:
     1. 4-1 ~ 4-3 실행 → 이슈 목록 수집
     2. P1 이슈 우선 수정
     3. 수정 후 컴파일 재검증:
        Bash: npx tsc --noEmit 2>&1
        → 에러 발생 시: 시각 수정이 타입 에러를 유발한 것
        → 즉시 타입 에러 수정 후 진행
     4. 페이지 리로드 → 다시 캡처 → 비교
     5. P1=0 이면 종료
   ```
   - File: `skills/vibe.figma/SKILL.md` Phase 4-4 섹션
   - Verify: 수정 후 tsc 재검증이 추가됨

### 2-3. 에러 보고 포맷 정의 (`skills/vibe.figma/SKILL.md`)

1. [ ] 컴파일 에러 보고 포맷:
   ```
   컴파일 게이트 결과 보고:

   ✅ 통과:
     "Phase 3.5: 컴파일 게이트 PASS (라운드 {N})"
     - tsc: 0 errors
     - build: success
     - dev server: running on localhost:{port}

   ❌ 실패 (3라운드 후):
     "Phase 3.5: 컴파일 게이트 FAIL"
     - 남은 에러 목록 (파일, 줄, 메시지)
     - 시도한 수정 내역
     - 사용자 수동 수정 필요
     → Phase 4 진행하지 않음
   ```
   - File: `skills/vibe.figma/SKILL.md`
   - Verify: 보고 포맷이 정의됨
</task>

## Constraints
<constraints>
- 스킬 파일(`.md`)만 수정 — TypeScript 인프라 코드 변경 없음
- 컴파일 체크는 Bash 도구로 실행 (별도 라이브러리 불필요)
- 컴파일 에러는 스킵 불가 (시각 P2와 다름) — 반드시 수정 또는 사용자 보고
- Phase 3.5 실패 시 Phase 4 진행 불가 (게이트)
- dev 서버 시작 대기: 최대 30초 (localhost 포트 폴링, 3초 간격)
</constraints>

## Output Format
<output_format>
### Files to Modify
- `skills/vibe.figma/SKILL.md` — Phase 3.5 추가, Phase 4-4 확장

### Files to Create
- 없음

### Verification Commands
- `grep -c "3.5" skills/vibe.figma/SKILL.md` → 5 이상
- `grep "tsc --noEmit" skills/vibe.figma/SKILL.md` → 매칭
- `grep "npm run build" skills/vibe.figma/SKILL.md` → 매칭
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] Phase 3.5 "컴파일 게이트"가 Phase 3과 Phase 4 사이에 추가됨
- [ ] tsc --noEmit → npm run build → dev server 순서의 3단계 체크가 명시됨
- [ ] 에러 유형별 자동 수정 전략이 정의됨 (TS2322, TS2304, TS2339, TS7006)
- [ ] 최대 3라운드 반복, 실패 시 사용자 보고 절차가 명시됨
- [ ] Phase 4-4 시각 수정 후 tsc 재검증이 추가됨
- [ ] 컴파일 에러 보고 포맷(성공/실패)이 정의됨
- [ ] Phase 3.5 실패 시 Phase 4 진행 불가(게이트) 원칙이 명시됨
</acceptance>
