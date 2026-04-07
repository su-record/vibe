---
status: pending
phase: 4
parent: _index.md
---

# SPEC: Phase 4 — 멀티 프레임 컨텍스트

## Persona
<role>
vibe.figma 스킬 개발자. 여러 Figma 프레임을 동시에 입력받아
공통 패턴/컴포넌트를 자동 식별하고 공유 컴포넌트로 추출하여,
페이지 간 일관성을 보장하고 중복 코드를 제거한다.
</role>

## Context
<context>
### Background
현재 vibe.figma는 하나의 Figma URL을 받아 순차 처리한다:
- Phase 2: 하나의 디자인 URL에서 재료 확보
- Phase 3: 해당 재료로 섹션별 퍼즐 조립
- 반응형 추가: 완료 후 다른 브레이크포인트 URL 추가

문제:
- 여러 페이지(메인, 서브1, 서브2)를 만들 때 각각 별도로 처리
- 페이지 간 공통 요소(헤더, 푸터, 카드, 버튼)를 각 페이지에서 중복 생성
- 색상/폰트/간격이 페이지마다 미세하게 달라 일관성 깨짐

Kombai는 "multiple design inputs simultaneously for context-aware UI building"을 지원하여
여러 프레임을 동시에 분석하고 공통 패턴을 자동 추출한다.

### 현재 코드
- `skills/vibe.figma/SKILL.md` Phase 2 (line 188~253): 단일 URL 재료 확보
- `skills/vibe.figma/SKILL.md` 반응형 섹션 (line 346~354): 추가 URL 처리
- `skills/vibe.figma.extract/SKILL.md`: 단일 프레임 추출 도구
- `hooks/scripts/figma-extract.js`: CLI 추출 (단일 URL)
</context>

## Task
<task>
### 4-1. 멀티 URL 입력 플로우 (`skills/vibe.figma/SKILL.md`)

Phase 2 "재료 확보" (line 188~253) 수정:

1. [ ] 여러 URL 동시 입력 지원:
   ```
   Phase 2: 재료 확보 (멀티 프레임)

   사용자에게 질문:
     question: "디자인 Figma URL을 입력해주세요. 여러 페이지는 줄바꿈으로 구분."
     예시:
       https://figma.com/file/xxx?node-id=100:1  (메인)
       https://figma.com/file/xxx?node-id=100:2  (서브1)
       https://figma.com/file/xxx?node-id=100:3  (서브2)

   URL 개수에 따른 처리:
     1개: 기존 방식 (변경 없음)
     2개 이상: 멀티 프레임 모드 활성화
   ```
   - File: `skills/vibe.figma/SKILL.md` Phase 2 입력 부분
   - Verify: 멀티 URL 입력 방식이 명시됨

### 4-2. 병렬 재료 확보 (`skills/vibe.figma/SKILL.md`)

1. [ ] 여러 URL의 재료를 동시에 확보:
   ```
   멀티 프레임 재료 확보:

   각 URL에 대해 순차적으로 추출 (Figma API rate limit 준수, 요청 간 500ms):
     URL 1 → /tmp/{feature}/frame-1/ (full-screenshot, tree, images, sections)
     URL 2 → /tmp/{feature}/frame-2/ (URL 1 완료 후 500ms 대기)
     URL 3 → /tmp/{feature}/frame-3/ (URL 2 완료 후 500ms 대기)
     ※ 추출 완료 후 후처리(섹션 분할 등)는 병렬 가능

   결과:
     /tmp/{feature}/
     ├── frame-1/           ← 메인 페이지
     │   ├── full-screenshot.png
     │   ├── tree.json
     │   ├── images/
     │   └── sections/
     ├── frame-2/           ← 서브 페이지 1
     │   └── ...
     ├── frame-3/           ← 서브 페이지 2
     │   └── ...
     └── shared/            ← 공통 분석 결과 (4-3에서 생성)
   ```
   - File: `skills/vibe.figma/SKILL.md` Phase 2
   - Verify: 병렬 추출 구조와 디렉토리 레이아웃이 명시됨

### 4-3. 공통 패턴 분석 (`skills/vibe.figma/SKILL.md`)

Phase 2 완료 후, Phase 3 시작 전에 공통 분석 단계 추가:

1. [ ] 프레임 간 공통 요소 식별:
   ```
   Phase 2.5: 공통 패턴 분석

   1. 시각 비교 — 각 프레임의 스크린샷을 순차 Read:
      - frame-1/full-screenshot.png → frame-2/full-screenshot.png → ...
      - 시각적으로 반복되는 요소 식별:
        상단 영역 (GNB/Header), 하단 영역 (Footer),
        카드 패턴, 버튼 스타일, 섹션 레이아웃

   2. 구조 비교 — 각 tree.json의 1depth 자식 비교:
      - 동일한 name 또는 prefix 일치 (예: "GNB", "Header", "Footer", "Nav")
      - 동일한 size (±10% 이내): 같은 컴포넌트 후보
      - 동일한 CSS 패턴: 같은 스타일 사용 (색상, 폰트, 레이아웃)

   3. 공통 컴포넌트 후보 목록:
      shared-components:
        - name: GNB
          frames: [frame-1, frame-2, frame-3]
          consistency: 100% (모든 프레임에서 동일)
          action: 공유 컴포넌트로 1회만 생성
        - name: Footer
          frames: [frame-1, frame-3]
          consistency: 67% (2/3 프레임)
          action: 공유 컴포넌트 + frame-2는 다른 Footer
        - name: CardItem
          frames: [frame-1, frame-2]
          size-match: 95%
          action: 공유 컴포넌트 (props로 변형)

   4. 공통 토큰 추출:
      - 모든 프레임의 색상 팔레트 합집합 → 공유 _tokens.scss
      - 모든 프레임의 폰트 목록 합집합
      - 모든 프레임의 간격 패턴 합집합
      → 프레임별 고유 값만 프레임 로컬 토큰으로 분리
   ```
   - File: `skills/vibe.figma/SKILL.md` Phase 2와 Phase 3 사이
   - Verify: 공통 패턴 분석 절차가 3단계로 명시됨

### 4-4. 멀티 프레임 퍼즐 조립 순서 (`skills/vibe.figma/SKILL.md`)

Phase 3 수정:

1. [ ] 공유 → 개별 순서로 조립:
   ```
   멀티 프레임 Phase 3 순서:

   1단계: 공유 컴포넌트 먼저 생성
     - shared-components 목록의 컴포넌트를 components/shared/에 생성
     - 가장 일관적인 프레임의 스크린샷을 기준으로 조립
     - 프레임별 변형은 props로 처리

   2단계: 프레임별 고유 섹션 조립
     - frame-1 고유 섹션: 공유 컴포넌트 import + 고유 섹션 신규 생성
     - frame-2 고유 섹션: 동일
     - frame-3 고유 섹션: 동일
     - 각 프레임의 페이지 파일에서 공유 + 고유 컴포넌트 배치

   3단계: 스타일 구조
     styles/{feature}/
     ├── _tokens.scss          ← 공유 토큰 (합집합)
     ├── shared/               ← 공유 컴포넌트 스타일
     │   ├── layout/_gnb.scss
     │   └── components/_gnb.scss
     ├── frame-1/              ← 메인 고유 스타일
     │   ├── layout/
     │   └── components/
     └── frame-2/
   ```
   - File: `skills/vibe.figma/SKILL.md` Phase 3
   - Verify: 공유→개별 순서와 스타일 구조가 명시됨

### 4-5. 단일 URL 역호환 (`skills/vibe.figma/SKILL.md`)

1. [ ] URL 1개일 때 기존 동작 보장:
   ```
   역호환:
     URL 1개 → 기존 방식 그대로 (frame-N/ 하위 디렉토리 없이 /tmp/{feature}/ 직접)
     URL 2개 이상 → 멀티 프레임 모드
     Phase 2.5 (공통 분석)은 URL 2개 이상일 때만 실행
   ```
   - File: `skills/vibe.figma/SKILL.md`
   - Verify: 역호환 조건이 명시됨
</task>

## Constraints
<constraints>
- 스킬 파일(`.md`)만 수정 — TypeScript 인프라 코드 변경 없음
- 단일 URL 시 기존 동작 100% 보장 (역호환)
- 공통 패턴 분석은 시각 + 구조 기반 (ML 모델 없음)
- 동일 fileKey의 다른 nodeId만 지원 (서로 다른 Figma 파일 간 비교 미지원)
- 최대 5개 URL까지 지원 (메모리/시간 제한)
- 병렬 추출 시 Figma API rate limit 고려 (요청 간 500ms 간격)
- /tmp/{feature}/ 경로에 path traversal 방지: feature명에서 `/`, `..`, 특수문자 제거 후 사용
- URL 유효성 검증: figma.com 도메인 + node-id 파라미터 존재 확인 후 추출 시작
</constraints>

## Output Format
<output_format>
### Files to Modify
- `skills/vibe.figma/SKILL.md` — Phase 2 멀티 URL, Phase 2.5 공통 분석, Phase 3 조립 순서

### Files to Create
- 없음

### Verification Commands
- `grep "멀티 프레임" skills/vibe.figma/SKILL.md` → 매칭
- `grep "shared-components" skills/vibe.figma/SKILL.md` → 매칭
- `grep "Phase 2.5" skills/vibe.figma/SKILL.md` → 매칭
</output_format>

## Acceptance Criteria
<acceptance>
- [ ] Phase 2에서 여러 URL을 줄바꿈으로 입력받는 방식이 명시됨
- [ ] URL별 병렬 재료 확보 (frame-N/ 구조)가 정의됨
- [ ] Phase 2.5 공통 패턴 분석이 3단계로 명시됨 (시각 비교, 구조 비교, 후보 목록)
- [ ] 공통 토큰 추출 (합집합 → 공유 + 프레임별 로컬) 방식이 정의됨
- [ ] Phase 3 조립 순서가 공유→개별 순서로 변경됨
- [ ] 공유 컴포넌트 스타일 디렉토리 구조가 정의됨
- [ ] 단일 URL 역호환이 보장됨
- [ ] 최대 5개 URL, Figma API rate limit 고려가 명시됨
</acceptance>
