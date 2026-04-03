---
name: vibe-figma
description: Step A — 스토리보드 추출 + 프로젝트 Base 구조 설계
triggers: []
tier: standard
---

# Skill: vibe-figma — Step A: 스토리보드 + Base 구조

## 스토리보드에서 추출하는 정보

| 항목 | 활용 |
|------|------|
| 브레이크포인트 / 해상도 가이드 | base 레이아웃 설계 |
| 인터랙션 스펙 (호버, 클릭, 스크롤) | 이벤트 핸들러 + CSS states |
| 애니메이션 스펙 (타이밍, 이징) | transition/animation |
| 상태별 UI (로딩, 에러, 성공) | 조건부 렌더링 |
| 반응형 동작 설명 | responsive 코드 |
| 컬러/타이포 가이드 | 토큰 생성 |

---

## A-1. 스토리보드 URL 입력

AskUserQuestion (options 사용 금지, 자유 텍스트만):
```
question: "스토리보드 Figma URL을 입력해주세요. (없으면 '없음')"
→ 응답 대기 (응답 받기 전 다음 진행 금지)
→ figma.com URL → storyboardUrl 저장
→ "없음" → storyboardUrl = null
```

## A-2. 스토리보드 추출 (storyboardUrl이 있을 때)

```
URL에서 fileKey, nodeId 추출:
  https://www.figma.com/design/:fileKey/:fileName?node-id=:nodeId
  → nodeId: 하이픈을 콜론으로 ("1-109" → "1:109")

1. get_metadata(fileKey, nodeId) → 전체 프레임 목록
2. 관련 섹션별 get_design_context 또는 get_screenshot:
   - "해상도 대응" / "Media Query" → 브레이크포인트 + 디자인 시안 사이즈
   - "인터랙션" / "Interaction" → 호버/클릭/스크롤 스펙
   - "애니메이션" / "Animation" / "Motion" → 트랜지션 스펙
   - "상태" / "State" → 로딩/에러/성공 UI
   - "컬러" / "Color" / "타이포" / "Typography" → 디자인 가이드
```

### 해상도 대응 프레임 추출

해상도 프레임에서 브레이크포인트 + 스케일 팩터 정보를 추출한다.
계산 공식과 기본값은 **vibe-figma-rules R-3** 참조.

```
추출 결과를 storyboardSpec으로 저장:

storyboardSpec = {
  breakpoints: { pcTarget, breakpoint, mobilePortrait, mobileMinimum, designPc, designMobile },
  scaleFactor: { pc, mobile },
  interactions: [ ... ],
  animations: [ ... ],
  states: { ... },
  colorGuide: { ... },
  typographyGuide: { ... }
}
```

## A-3. 프로젝트 스택 감지 + Base 구조 설계

```
1. 프로젝트 스택 감지 (vibe-figma-rules R-2 참조)
2. 디자인 시스템 감지 (--new 미지정 시)
3. 브레이크포인트 로드 (vibe-figma-rules R-3 참조, 스토리보드 우선)
4. 피처명 결정 (Figma 파일명에서 추출)
5. → 파일 생성은 vibe-figma-analyze 스킬에서 실행 (이 스킬은 추출까지만)
```

### 피처명 결정

Figma 파일명에서 피처명 자동 추출 → kebab-case 변환.

```
예: "Winter Sale Campaign" → winter-sale
예: "Dashboard Redesign v2" → dashboard-redesign
```

### 파일 구조 생성

디렉토리는 **vibe-figma-rules R-2.2** 감지 결과에 따라 결정.

**생성 예시 (Nuxt):**
```
pages/{feature-name}.vue                      ← 루트 페이지 (빈 shell)
components/{feature-name}/                    ← 컴포넌트 디렉토리 (빈 폴더)
assets/scss/_{feature-name}-tokens.scss       ← 스토리보드 기반 초기 토큰
```

**생성 예시 (Next.js):**
```
app/{feature-name}/page.tsx                   ← 루트 페이지 (빈 shell)
components/{feature-name}/                    ← 컴포넌트 디렉토리 (빈 폴더)
styles/{feature-name}-tokens.css              ← 스토리보드 기반 초기 토큰
```

Step A 완료 후 → Step B (vibe-figma-frame) 로 진행.
