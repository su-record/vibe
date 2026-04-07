---
status: pending
phase: 1
parent: _index.md
---

# SPEC: Phase 1 — 컴포넌트 재사용 인덱싱

## Persona
<role>
vibe.figma 스킬 개발자. 기존 파이프라인의 Phase 0(Setup)과 Phase 3(퍼즐 조립)에
컴포넌트 재사용 로직을 추가하여, 새 코드 생성 전에 기존 프로젝트 자산을 우선 활용하도록 한다.
</role>

## Context
<context>
### Background
현재 vibe.figma Phase 0에서 `Glob "components/**/*.vue"` 로 기존 컴포넌트 목록만 수집한다.
이름 목록만 있고, 각 컴포넌트의 props/slots/스타일/용도를 알 수 없어
Phase 3에서 실질적 재사용이 어렵다.

Kombai는 "Context Graphs"로 컴포넌트, hooks, 디자인 토큰, 타입을 시맨틱하게 인덱싱하여
새 코드 생성 시 기존 자산을 자동 매칭한다.

### 현재 코드
- `skills/vibe.figma/SKILL.md` Phase 0 (line 47~70): 기존 컴포넌트 스캔
- `skills/vibe.figma/SKILL.md` Phase 3 (line 259~342): 퍼즐 조립
- `skills/vibe.figma.convert/SKILL.md`: 코드 생성 규칙
- `src/infra/lib/figma/extract.ts`: Figma 데이터 추출

### 참고
- Kombai Context Graphs: 컴포넌트, hooks/stores, 디자인 토큰, 타입, 상수를 인덱싱
- Kombai ContextRules.md: 사용자 정의 인덱싱 힌트
- vector DB 없이, Grep + Glob + Read 패턴으로 경량 구현
</context>

## Task
<task>
### 실행 순서 (문서 번호와 다름 — 의존성 기반)

> **실행 순서**: 1-3 (Types/Constants/Hooks) → 1-1 (Components) → 1-2 (Phase 3 매칭) → 1-4 (convert 지침)
> 이유: 컴포넌트의 외부 타입 참조 해결에 types 인덱스가 필요하므로 1-3이 선행되어야 함.
> (문서 번호는 논리적 그룹핑, 실행 순서는 의존성 기반)

### 1-1. 컴포넌트 인덱서 스킬 섹션 추가 (`skills/vibe.figma/SKILL.md`)

Phase 0 "기존 컴포넌트 스캔" (line 67~69) 확장:

1. [ ] 기존 Glob 스캔 후, 2단계 추출 — Grep으로 시작 줄 번호 탐색(`defineProps|interface Props|<slot|@description|class=|className=`) → 해당 파일의 시작줄~+30줄을 Read로 완전 추출. Vue/Svelte 등 template+script 분리 파일은 첫 300줄 전체 Read:
   - **Props/Interface**: `defineProps<{...}>` 또는 `interface Props {...}` 에서 prop 이름+타입
     ※ 외부 타입 참조 시 (`defineProps<ButtonProps>()`) → types 인덱스에서 해당 타입 교차 참조하여 필드 추출
   - **Slots**: `<slot>` 또는 `{children}` 패턴
   - **스타일 클래스**: `class="..."` 또는 `className={styles.xxx}` 에서 최상위 요소의 모든 클래스명
   - **용도 힌트**: JSDoc `@description` 또는 컴포넌트 파일 첫 번째 주석
   - File: `skills/vibe.figma/SKILL.md` Phase 0 섹션
   - Verify: 스킬 문서에 인덱싱 절차가 명시됨

2. [ ] 인덱스 결과를 `component-index` 재료로 Phase 3에 전달:
   ```
   component-index (임시 JSON 파일 저장 → Phase 3에서 Read):
   저장 경로: /tmp/{feature}/component-index.json
     - name: BaseButton
       path: components/common/BaseButton.vue
       props: [label: string, variant: 'primary'|'secondary', disabled: boolean]
       slots: [default]
       description: "공통 버튼 컴포넌트"
     - name: GNB
       path: components/layout/GNB.vue
       props: [menuItems: MenuItem[]]
       slots: []
       description: "글로벌 네비게이션 바"

   컨텍스트 관리:
     - 컴포넌트 20개 이하: 전체 인덱스를 프롬프트에 포함
     - 컴포넌트 20개 초과: 이름+설명+축약 props 시그니처(이름만, 타입 생략) 요약 포함, 매칭 후보 발견 시 해당 파일 Read로 상세 확인
     - classes 필드는 요약에서 제외 (매칭 시 파일 Read로 확인)
   ```
   - File: `skills/vibe.figma/SKILL.md` Phase 0 → Phase 3 전달 구조
   - Verify: 인덱스 포맷이 정의됨

### 1-2. Phase 3 재사용 매칭 로직 추가 (`skills/vibe.figma/SKILL.md`)

Phase 3 "섹션 조립 프로세스" (line 285~316) 확장:

1. [ ] 섹션 스크린샷 분석 후, 기존 컴포넌트 매칭 단계 추가:
   ```
   3-0.5. 컴포넌트 매칭 (각 섹션 조립 전)
     1. 스크린샷에서 식별된 UI 요소를 component-index와 대조
     2. 매칭 기준:
        - 버튼 → BaseButton (props.variant로 스타일 분기)
        - 네비게이션 → GNB (이미 있으면 import만)
        - 카드 패턴 → 기존 Card 컴포넌트
        - 모달/팝업 → 기존 Modal 컴포넌트
     3. 매칭된 컴포넌트: import하여 props 전달
     4. 매칭 안 됨: 새로 생성 (기존 방식)
   ```
   - File: `skills/vibe.figma/SKILL.md` Phase 3 섹션
   - Verify: 매칭 로직이 스킬 문서에 명시됨

2. [ ] 재사용 시 스타일 충돌 방지 규칙 추가:
   ```
   재사용 규칙:
     - 기존 컴포넌트의 내부 스타일 수정 금지
     - 래퍼 클래스로 위치/크기만 오버라이드
     - props로 변형 가능한 것은 props 사용
     - 불가능하면 새 컴포넌트 생성 (강제 재사용 금지)
   ```
   - File: `skills/vibe.figma/SKILL.md` Phase 3 섹션
   - Verify: 충돌 방지 규칙이 명시됨

### 1-3. Hooks/Types 인덱싱 확장 (`skills/vibe.figma/SKILL.md`)

1. [ ] Phase 0에서 추가 스캔 대상:
   ```
   추가 인덱싱:
     - Composables/Hooks: composables/**/*.ts, hooks/**/*.ts
       → export 함수명 + 파라미터 + 반환 타입
       → 예: useAuth() → { user: User, login: (email, pw) => Promise<void> }
     - 타입 정의: types/**/*.ts, types.ts
       → export interface/type 이름 + export된 최상위 필드 (이름+타입)
     - 상수: constants/**/*.ts
       → export const 이름 + 값 (또는 타입)
   ```
   - File: `skills/vibe.figma/SKILL.md` Phase 0 섹션
   - Verify: hooks/types/constants 스캔이 추가됨

   저장: /tmp/{feature}/context-index.json에 hooks, types, constants 인덱스 저장
   (component-index.json과 별도 파일, Phase 3에서 Read로 로드)

### 1-4. convert 스킬 재사용 지침 추가 (`skills/vibe.figma.convert/SKILL.md`)

1. [ ] 코드 생성 프로세스에 재사용 우선 규칙 추가:
   ```
   0. 재사용 확인 (코드 작성 전)
     component-index에서 매칭되는 컴포넌트가 있으면:
       ✅ import하여 사용 (새로 만들지 않음)
       ✅ props로 커스터마이즈
       ✅ 래퍼 클래스로 위치만 조정
       ❌ 기존 컴포넌트 내부 수정
       ❌ 90% 유사한데 새로 만들기
   ```
   - File: `skills/vibe.figma.convert/SKILL.md`
   - Verify: 재사용 우선 규칙이 섹션 1 앞에 추가됨
</task>

## Constraints
<constraints>
- 스킬 파일(`.md`)만 수정 — TypeScript 인프라 코드 변경 없음
- 인덱싱은 Glob + Read 기반 (AST 파서 라이브러리 추가 없음)
- 인덱싱 대상 파일이 50개 초과 시 최대 50개 파일 스캔 (우선순위: barrel file index.ts → components/ui/ → components/common/ → components/shared/ → 나머지)
- 인덱싱 타임아웃: 파일당 Read 최대 300줄 (barrel file index.ts는 전체 Read), 전체 인덱싱 2분 이내 완료
- component-index는 /tmp/{feature}/component-index.json에 임시 저장 후 Phase 3에서 Read로 로드 (Phase 간 컨텍스트 유실 방지)
- 기존 Phase 0~4 흐름 변경 최소화
</constraints>

## Output Format
<output_format>
### Files to Modify
- `skills/vibe.figma/SKILL.md` — Phase 0 인덱싱 확장, Phase 3 매칭 추가
- `skills/vibe.figma.convert/SKILL.md` — 재사용 우선 규칙 추가

### Files to Create
- 없음

### Verification Commands
- `grep -c "component-index" skills/vibe.figma/SKILL.md` → 3 이상
- `grep -c "재사용" skills/vibe.figma.convert/SKILL.md` → 1 이상
- `npm run build` (타입 에러 없음 — 스킬 파일이므로 빌드 무관하지만 확인)
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] Phase 0에서 컴포넌트의 props/slots/클래스/용도를 추출하는 절차가 명시됨
- [ ] Phase 0에서 hooks/types/constants도 인덱싱하는 절차가 명시됨
- [ ] component-index 포맷이 정의되고 Phase 3으로 전달 구조가 명확함
- [ ] Phase 3에서 섹션 조립 전 기존 컴포넌트 매칭 단계가 추가됨
- [ ] 재사용 시 스타일 충돌 방지 규칙이 명시됨
- [ ] convert 스킬에 재사용 우선 규칙이 추가됨
- [ ] 강제 재사용 금지 (불일치 시 새로 생성) 원칙이 명시됨
</acceptance>
