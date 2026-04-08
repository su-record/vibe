# Image Extraction Rules — Node Rendering Based

## Core Principle

```
❌ imageRef 개별 다운로드 금지 (텍스처 fill 공유 문제)
✅ 모든 이미지는 Figma screenshot API로 노드 렌더링
```

## Render Methods

| 이미지 유형 | 렌더링 방법 | 출력 위치 |
|-----------|-----------|---------|
| BG 프레임 (합성 배경) | `screenshot {fileKey} {bg.nodeId}` | `bg/{section}-bg.webp` |
| 콘텐츠 (타이틀, 버튼) | `screenshot {fileKey} {node.nodeId}` | `content/{name}.webp` |
| 벡터 글자 그룹 | `screenshot {fileKey} {group.nodeId}` | `content/{name}.webp` |

## BG 프레임 판별

```
BG 프레임 = 다음 중 하나:
  - name에 "BG", "bg" 포함
  - 부모와 크기 동일(±10%) + 자식 이미지 3개 이상
  - 1depth 첫 번째 자식이면서 이미지 노드 다수 보유

→ 프레임 렌더링 1장 → CSS background-image
→ 하위 개별 레이어 다운로드하지 않음
```

## 벡터 글자 판별

```
벡터 글자 그룹 = 다음 모두 충족:
  - 부모 GROUP/FRAME 아래 VECTOR 타입 3개 이상
  - 각 VECTOR 크기 < 60x60
  - 같은 imageRef 공유 (텍스처 fill)

→ 부모 GROUP 통째로 렌더링 (개별 글자 다운로드 금지)
→ 커스텀 폰트 텍스트 = 웹폰트 없음 → 이미지로 사용
```

## 렌더링 금지 노드 (HTML로 구현해야 하는 것)

```
다음 조건에 해당하는 노드는 이미지로 렌더링하지 않는다 — HTML+CSS로 구현:

1. TEXT 자식 보유 프레임:
   프레임 내부에 TEXT 노드가 1개 이상 있으면 → HTML로 구현
   ⚠️ BG 프레임 렌더링 시에도 TEXT 포함 여부 반드시 확인:
     - BG 프레임에 TEXT 자식이 있으면 → BG 하위만 렌더링 (TEXT 제외)
     - 텍스트 포함된 상위 프레임을 통째 렌더링하면 → 이미지 텍스트 + HTML 텍스트 이중 표시

2. INSTANCE 반복 패턴 (카드/아이템 그리드):
   같은 부모 아래 동일 구조 INSTANCE 2개 이상 → HTML 반복 구조 (v-for/.map())
   ❌ 카드 그리드를 통째 이미지 1장으로 렌더링 금지
   ✅ 각 카드 내부의 이미지 에셋만 개별 추출 (아이콘, 아이템 이미지)
   ✅ 카드 레이아웃, 텍스트, 버튼은 HTML로 구현

3. 인터랙티브 요소:
   name에 "btn", "button", "CTA", "link", "tab", "toggle" 포함 → HTML <button>/<a>
   ❌ 버튼을 이미지로 렌더링 금지 (클릭 이벤트 불가)

4. 정보 텍스트 영역:
   기간, 가격, 수량, 설명 등 변경 가능 데이터 → HTML 텍스트
   ❌ "1,000", "500 G-COIN", "보상 교환하기" 등을 이미지에 포함 금지
```

## 이미지로 렌더링하는 것 (HTML로 구현 불가)

```
다음만 이미지로 렌더링:

1. 커스텀 폰트 텍스트 (벡터 글자 그룹):
   - 웹폰트 없는 장식 타이틀 ("MISSION 01" 등)
   - VECTOR 타입으로 분해된 글자 → GROUP 렌더링

2. 합성 배경 (BG 프레임):
   - 눈, 나무, 파티클 등 장식 레이어 합성물
   - 텍스트 미포함 확인 필수

3. 래스터 이미지 에셋:
   - 게임 아이템 썸네일, 코인 아이콘 등
   - imageRef가 있는 개별 RECTANGLE/노드

4. 복잡한 벡터 그래픽:
   - CSS로 재현 불가능한 일러스트/아이콘
   - VECTOR/GROUP 조합의 복잡한 그래픽
```

## Format

- Output format: `.webp` (Figma API에서 png 수신 → cwebp로 webp 변환)
- cwebp 미설치 시 `.png` 폴백

## Naming

렌더링된 이미지의 파일명 = Figma 노드 name을 kebab-case로:
  - `"Hero"` BG frame → `hero-bg.webp`
  - `"Mission 01"` vector group → `mission-01.webp`
  - `"Title"` content → `hero-title.webp` (섹션명 prefix)
  - `"Btn_Login"` → `btn-login.webp`

Rules:
  - 공백 → 하이픈
  - 언더스코어 → 하이픈
  - 숫자 유지: `item11` → `item-11`
  - 대문자 → 소문자

## Destination

```
/tmp/{feature}/{bp-folder}/
  bg/                    ← BG 프레임 렌더링
  content/               ← 콘텐츠 + 벡터 글자 렌더링
  sections/              ← Phase 4 검증용 스크린샷
```

최종 배치 (Phase 5):
```
static/images/{feature}/  ← Nuxt 2
public/images/{feature}/  ← Vue/Nuxt 3
public/{feature}/         ← Next.js
```

## Size Limits

| Type | Warn threshold | Action |
|------|---------------|--------|
| BG 렌더링 | 5 MB | 정상 (합성 이미지라 큰 게 정상) |
| 콘텐츠 렌더링 | 1 MB | 경고 |
| 단일 이미지 > 5 MB | — | ⚠️ 텍스처 fill 의심 → imageRef 다운로드 실수 확인 |

## Fallback

노드 렌더링 불가 시에만 imageRef 다운로드:
  - Figma screenshot API 실패 (rate limit, 권한)
  - 다운로드 후 파일 크기 5MB 초과 → 텍스처 fill 가능성 → 경고 로그
