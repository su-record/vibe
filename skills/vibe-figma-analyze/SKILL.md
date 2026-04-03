---
name: vibe-figma-analyze
tier: standard
description: "스토리보드 세밀 분석 → 실제 레이아웃 코드 + 기능 주석 + 컴포넌트 구조 생성. Step A에서 vibe-figma 이후 실행."
triggers: []
---

# Storyboard Deep Analysis & Layout Generation

스토리보드 URL 하나로 **실제 동작하는 레이아웃 코드**를 생성.
빈 shell이 아니라, 스토리보드에서 파악 가능한 모든 정보를 코드에 반영.

> **실행 지시: 이 스킬은 분석만 하는 게 아님. 반드시 Write 도구로 파일을 생성해야 함.**
> A-1~A-4에서 분석 → A-5에서 **Write 도구로 실제 파일 생성** → A-6에서 인터랙션 테이블 출력.

## 입력

- 스토리보드 URL의 get_metadata 결과 (전체 프레임 목록)
- storyboardSpec (브레이크포인트 등, vibe-figma에서 추출)

## A-1. 프레임 전수 조사

get_metadata에서 얻은 **모든 최상위 프레임**을 분류:

```
SKIP    — "개요", "Cover", "변경 이력" (문서 관리용)
SPEC    — "기능 정의", "정책" → 기능 스펙 텍스트 추출 대상
CONFIG  — "해상도", "Media Query", "브라우저" → 설정값 추출
SHARED  — "공통", "GNB", "Footer", "Popup", "Dialog" → 공통 컴포넌트
FLOW    — "Event Flow", "플로우" → 유저 플로우 파악
ASSET   — "OG", "배너", "어셋" → 스킵 (메타 이미지)
PAGE    — "메인", "화면설계" 하위 → 핵심 섹션 (코드 생성 대상)

서브 프레임 (3.x.1, 3.x.2 등):
  → 해당 PAGE 섹션의 상태 변형 / 인터랙션 결과 화면
```

## A-2. SPEC 프레임 세밀 분석

**기능 정의서 프레임**에 대해 get_design_context 호출:

```
추출 대상:
  - Overview: 개요, 대상, 일정
  - Spec: 각 섹션별 기능 정의 (로직, 조건, 보상 구조)
  - 일정: 시작/종료 시간, 단계별 기간

추출한 텍스트를 섹션별로 분리:
  {
    "overview": "...",
    "sections": {
      "hero": "키 비주얼 영역, CTA 버튼...",
      "featureA": "섹션 A 기능 설명...",
      "featureB": "섹션 B 기능 설명..."
    }
  }

→ A-5에서 각 컴포넌트의 기능 주석이 됨
```

## A-3. SHARED 프레임 분석

공통 요소 프레임들의 get_screenshot으로 구조 파악:

```
GNB: 네비게이션 구조, 메뉴 항목, 로그인 버튼
Footer: 링크, 법적 고지
Popup: 패턴 분류 (확인/취소, 상세 모달, 알림, 입력 폼)

→ 프로젝트에 이미 있는 컴포넌트 확인 (Glob으로 탐색)
→ 있으면 import 재사용, 없으면 새로 생성
```

## A-4. PAGE 프레임 세밀 분석

> **모든 PAGE 프레임을 빠짐없이 분석한다. 일부만 처리하고 넘어가면 안 됨.**
> A-1에서 PAGE로 분류된 프레임 수 = A-5에서 생성하는 섹션 컴포넌트 수.

**각 PAGE 프레임**에 대해 get_screenshot + get_design_context:

```
각 프레임에서 추출:

1. 레이아웃 구조 (get_screenshot 비주얼 분석):
   - 섹션 경계 (배경 변화 지점)
   - 요소 배치 방향 (vertical stack / grid / positioned)
   - 이미지 배경 영역 vs 콘텐츠 영역

2. 인터랙션 스펙 (우측 주석):
   - 번호 태그 (①②③) → 인터랙션 ID
   - 동작 설명 → 이벤트 타입 + 결과
   - 조건 분기 (로그인 여부, 기간 내/외 등)

3. 상태 변형 (서브 프레임):
   - 기본 → 클릭 후 → 성공 → 에러 등
   - 팝업 트리거 조건

결과를 섹션별로 저장:
  sections[sectionName] = {
    layout: "vertical-stack, bg-image + overlay + content",
    children: ["Title", "Description", "Grid", "CTAButton"],
    interactions: [
      { id: "①", trigger: "클릭", action: "처리", result: "결과 표시" }
    ],
    states: ["default", "active", "completed"],
    popups: ["ConfirmDialog"]
  }
```

## A-5. 파일 생성 (Write 도구 사용 — 필수)

> **Write 도구로 아래 파일들을 실제로 생성한다. 코드를 보여주기만 하면 안 됨.**

디렉토리는 **vibe-figma-rules R-2.2** 감지 결과에 따라 결정.

### 생성할 파일 목록

```
필수 생성 (Write 도구):
  1. pages/{feature-name}.{vue|tsx}              ← 루트 페이지
  2. components/{feature-name}/각섹션.{vue|tsx}   ← 섹션별 컴포넌트
  3. components/{feature-name}/popups/각팝업      ← 팝업 컴포넌트
  4. styles/{feature-name}/index.scss            ← 스타일 진입점 (빈 import 목록)
  5. styles/{feature-name}/_tokens.scss          ← 빈 토큰 파일 (Step B에서 채움)
```

### 루트 페이지 구조

```
- 모든 섹션 컴포넌트 import
- 팝업 조건부 렌더링 (v-if/&&)
- 개요 JSDoc 주석 (A-2에서 추출한 overview)
```

### 섹션 컴포넌트 필수 포함 사항

```
각 섹션 컴포넌트에 반드시 포함:

1. JSDoc 주석:
   - [기능 정의] — A-2에서 추출한 기능 설명
   - [인터랙션] — ①②③ 번호 + 동작 설명
   - [상태] — 해당 섹션의 상태 목록

2. TypeScript 인터페이스:
   - 섹션에서 사용하는 데이터 구조 정의

3. 이벤트 핸들러:
   - 인터랙션 스펙에 맞는 함수 (body는 // TODO:)

4. 목 데이터 (빈 배열 금지):
   - 기능 정의서에서 추출한 아이템/보상/상품 정보로 채움
   - 빈 배열 = UI가 안 보임 = Step A 미완성
```

### 스타일 분리 규칙

```
컴포넌트 파일에 <style> 블록을 작성하지 않는다.
스타일은 Step B에서 외부 파일로 생성.
컴포넌트는 template + script 만 포함.
```

### 핵심 원칙: 스타일 없이 동작하는 코드

```
✅ 클릭/탭/아코디언 등 인터랙션이 실제로 동작
✅ 모달/팝업 open/close가 연결됨
✅ 리스트 렌더링이 목 데이터로 동작
✅ 조건부 렌더링이 상태에 따라 전환
✅ emit으로 부모-자식 이벤트 연결
→ 브라우저에서 열면 스타일은 없지만 인터랙션은 동작하는 상태

Step A에서는 이미지 자리에 빈 영역이 있을 수 있다.
→ Step B에서 반드시 실제 이미지로 교체해야 함.
→ Step B 완료 후 "placeholder", "Key Visual Image", 빈 dashed box가
   코드에 남아있으면 = 미완성 (vibe-figma-frame HARD RULES 참조)
```

## A-6. 인터랙션 매핑 테이블

코드 생성 후, 전체 인터랙션을 테이블로 출력:

```markdown
| 섹션 | ID | 트리거 | 동작 | 컴포넌트 | 함수 |
|------|-----|--------|------|---------|------|
| Hero | ① | 클릭 | 공유하기 팝업 | HeroSection | handleShare() |
| 섹션A | ① | 클릭 | API 호출 | FeatureASection | handleAction() |

→ Step B/C에서 이 함수들의 body를 구현
```

## A-7. Step A 검증

> **아래 검증을 도구로 실제 실행해야 함.**

### 검증 항목

```
1. 파일 존재 확인 (Glob 도구):
   □ 루트 페이지 파일 존재
   □ PAGE 프레임 수 = 컴포넌트 파일 수
   □ styles 디렉토리 존재
   □ 팝업 컴포넌트 존재 (스토리보드에 팝업이 있었으면)
   → 누락 시 Write로 생성

2. 기능 주석 확인 (Read 도구):
   □ 모든 컴포넌트에 [기능 정의] + [인터랙션] + [상태] JSDoc
   → 누락 시 Edit으로 추가

3. 목 데이터 확인 (Grep 도구):
   □ 빈 배열 (ref([]) 패턴) 검색 → 0건
   → 발견 시 목 데이터 채움

4. 스타일 분리 확인 (Grep 도구):
   □ 컴포넌트 내 <style> 블록 0건
   → 발견 시 제거

5. 빌드 확인 (Bash 도구):
   □ npm run build 성공
   → 에러 시 수정 후 재빌드
```

### 완료 조건

```
✅ 파일 수 = PAGE 프레임 수
✅ 모든 JSDoc 주석 완비
✅ 빈 배열 0개
✅ <style> 블록 0개
✅ 빌드 성공
→ Step B 진행 가능
```
