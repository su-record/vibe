# Remapped Tree Template

tree.json을 코드 생성에 최적화된 구조로 리매핑한다.
모든 브레이크포인트의 tree.json을 동시에 입력받아, 노드 매칭 + CSS diff까지 포함.

---

## 입력

```
/tmp/{feature}/
  mo-main/tree.json    ← 모바일 Figma tree
  pc-main/tree.json    ← 데스크탑 Figma tree (있으면)
```

## 출력

```
/tmp/{feature}/remapped.json
```

---

## 구조 정의

```json
{
  "feature": "winter-pcbang",
  "designWidth": {
    "mo": 720,
    "pc": 2560
  },
  "minWidth": 340,
  "breakpoint": 1025,
  "sections": [
    {
      "section": "hero",
      "tag": "section",
      "storyboard": {
        "name": "Hero (키비주얼)",
        "features": ["키비주얼 + 이벤트 정보 + 공유 버튼"],
        "interactions": ["공유 버튼 클릭 → 공유 다이얼로그"],
        "states": ["default"]
      },
      "bg": {
        "mo": { "nodeId": "...", "file": "mo-main/bg/hero-bg.webp" },
        "pc": { "nodeId": "...", "file": "pc-main/bg/hero-bg.webp" }
      },
      "size": {
        "mo": { "w": 720, "h": 1280 },
        "pc": { "w": 2560, "h": 1080 }
      },
      "children": [
        {
          "role": "title-group",
          "type": "flex-column",
          "css": {
            "mo": { "alignItems": "center", "gap": "24px", "width": "620px" },
            "pc": { "alignItems": "center", "gap": "40px", "width": "1200px" }
          },
          "children": [
            {
              "role": "title-image",
              "type": "node-render",
              "render": {
                "mo": { "nodeId": "...", "file": "mo-main/content/hero-title.webp", "size": { "w": 620, "h": 174 } },
                "pc": { "nodeId": "...", "file": "pc-main/content/hero-title.webp", "size": { "w": 1200, "h": 340 } }
              },
              "alt": "추운 겨울, 따뜻한 보상이 펑펑"
            },
            {
              "role": "subtitle-image",
              "type": "node-render",
              "render": {
                "mo": { "nodeId": "...", "file": "mo-main/content/hero-subtitle.webp", "size": { "w": 586, "h": 32 } },
                "pc": { "nodeId": "...", "file": "pc-main/content/hero-subtitle.webp", "size": { "w": 1100, "h": 60 } }
              },
              "alt": "겨울을 녹일 보상, 지금 PC방에서 획득하세요!"
            }
          ]
        },
        {
          "role": "share-button",
          "type": "interactive",
          "tag": "button",
          "css": {
            "mo": { "width": "72px", "height": "72px", "borderRadius": "500px", "backgroundColor": "rgba(13,40,61,0.5)", "border": "1px solid #fff" },
            "pc": { "width": "96px", "height": "96px", "borderRadius": "500px", "backgroundColor": "rgba(13,40,61,0.5)", "border": "1px solid #fff" }
          },
          "event": "share"
        },
        {
          "role": "period-panel",
          "type": "content-with-bg",
          "bg": {
            "mo": { "nodeId": "...", "file": "mo-main/bg/period-bg.webp" },
            "pc": { "nodeId": "...", "file": "pc-main/bg/period-bg.webp" }
          },
          "size": {
            "mo": { "w": 720, "h": 500 },
            "pc": { "w": 2560, "h": 400 }
          },
          "children": [
            {
              "role": "target-label",
              "type": "text",
              "tag": "p",
              "content": "참여 대상 : PC 유저 (Steam, Kakao)",
              "css": {
                "mo": { "fontSize": "24px", "fontWeight": "600", "color": "#ffffff", "textAlign": "center" },
                "pc": { "fontSize": "32px", "fontWeight": "600", "color": "#ffffff", "textAlign": "center" }
              }
            },
            {
              "role": "info-group",
              "type": "flex-column",
              "css": {
                "mo": { "gap": "10px", "padding": "22px 14px" },
                "pc": { "gap": "16px", "padding": "30px 40px" }
              },
              "children": [
                {
                  "role": "info-row",
                  "type": "flex-column",
                  "css": {
                    "mo": { "gap": "4px" },
                    "pc": { "gap": "8px" }
                  },
                  "children": [
                    {
                      "role": "label",
                      "type": "text",
                      "tag": "span",
                      "content": "이벤트 기간 (이벤트 참여 및 미션 수행)",
                      "css": {
                        "mo": { "fontSize": "24px", "fontWeight": "700", "color": "#003879" },
                        "pc": { "fontSize": "28px", "fontWeight": "700", "color": "#003879" }
                      }
                    },
                    {
                      "role": "value",
                      "type": "text",
                      "tag": "span",
                      "content": "2025.12.22. 11:00 ~ 2026.01.18. 11:00 [KST]",
                      "css": {
                        "mo": { "fontSize": "28px", "fontWeight": "500", "color": "#171716", "fontFamily": "'Roboto Condensed', sans-serif" },
                        "pc": { "fontSize": "36px", "fontWeight": "500", "color": "#171716", "fontFamily": "'Roboto Condensed', sans-serif" }
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

---

## 노드 타입 분류

tree.json의 각 노드를 다음 타입 중 하나로 분류:

| type | 판별 기준 | 코드 출력 |
|------|----------|---------|
| `section` | 1depth 자식 프레임 | `<section>` + background-image |
| `flex-column` | Auto Layout VERTICAL | `<div>` + flex-direction: column |
| `flex-row` | Auto Layout HORIZONTAL | `<div>` + flex-direction: row |
| `text` | TEXT 노드 | `<span>/<p>/<h2>` + typography CSS |
| `node-render` | 콘텐츠 이미지 (타이틀, 아이콘) | `<img>` + 노드 렌더링 |
| `vector-group` | VECTOR 3+ 자식 (커스텀 폰트) | `<img>` + GROUP 렌더링 |
| `interactive` | name에 btn/CTA/link | `<button>/<a>` + event |
| `content-with-bg` | 콘텐츠 + 배경 프레임 | `<div>` + background-image + children |
| `repeat` | 같은 구조 INSTANCE 3+ | `v-for` / `.map()` |
| `skip` | 장식선, 0px, BG 하위 개별 레이어 | 제외 |

---

## 브레이크포인트 노드 매칭

```
MO tree.json 1depth 자식:
  Hero (720x1280) ──────── PC tree.json에서 "Hero" name 매칭
  KID (720x487)   ──────── PC: "KID" 매칭
  Daily (720x3604) ─────── PC: "Daily" 매칭

매칭 기준:
  1순위: name 완전 일치
  2순위: name prefix 일치 (Hero_MO → Hero_PC)
  3순위: 순서 기반 (같은 위치의 자식)
  매칭 불가: 해당 BP에만 존재하는 섹션으로 표시
```

---

## CSS diff → SCSS 출력 규칙

```
remapped.json의 mo/pc CSS를 비교:

같은 값:
  → 기본 스타일로 출력 (vw 기반, mo designWidth 사용)

다른 값:
  → 기본: mo 값 (vw 기반)
  → @media (min-width: {breakpoint}px): pc 값 (vw 기반, pc designWidth 사용)

예시:
  "gap": { "mo": "24px", "pc": "40px" }
  →
  gap: 3.33vw;                    // 24 / 720 × 100
  @media (min-width: 1025px) {
    gap: 1.56vw;                  // 40 / 2560 × 100
  }

  "color": { "mo": "#003879", "pc": "#003879" }
  → (같으므로 @media 없음)
  color: #003879;
```

---

## 리매핑 프로세스

```
입력:
  - Phase 1 스토리보드 스펙 (섹션 목록 + 기능 정의 + 인터랙션)
  - Phase 2 추출 데이터 (모든 BP의 tree.json + 렌더링 이미지)

1. 스토리보드 × tree.json 섹션 매칭
   스토리보드에서 정의한 섹션 목록을 tree.json 1depth 자식과 매칭:

   | 스토리보드 섹션 | tree.json name | 매칭 방법 |
   |---------------|---------------|----------|
   | Hero (키비주얼) | "Hero" | name 일치 |
   | KID (로그인) | "KID" | name 일치 |
   | Daily (출석 미션) | "Daily" | name 일치 |
   | PlayTime (플레이타임) | "Frame 633371" | name 불일치 → 순서 기반 |

   name이 "Frame 633372" 같은 무의미한 이름이면:
   → 스토리보드의 섹션 순서로 매칭
   → 매칭 후 스토리보드의 role/기능을 remapped.json에 기록

2. 스토리보드 기능 정의 → 노드 역할 확정
   스토리보드에서 정의한 기능/인터랙션으로 tree 노드의 role을 확정:

   스토리보드: "STEP 1. 일일 출석 - 출석하기 버튼"
   tree.json: Daily > Contents > FRAME > children 중 name="Btn_CheckIn"
   → role: "interactive", event: "check-in", tag: "button"

   스토리보드: "누적 출석 보상 - DAY2, DAY3, DAY5, DAY10"
   tree.json: Daily > Contents > FRAME > INSTANCE × 4
   → role: "repeat", items: 4, template: first INSTANCE

   스토리보드가 없는 노드:
   → name/type 기반 추정 (기존 방식 유지)
   → 장식/BG는 스토리보드에 없으므로 자동 분류

3. BP 간 섹션 매칭
   모든 BP의 tree.json에서 같은 섹션 찾기:
   → name 일치 또는 스토리보드 매칭 결과로 연결
   → MO Hero ↔ PC Hero

4. 각 섹션에 대해 재귀적으로:
   a. 노드 타입 분류 (위 테이블) — 스토리보드로 확정된 role 우선
   b. BG 프레임 식별 → frame-render로 마킹
   c. 콘텐츠 이미지/벡터 그룹 → node-render로 마킹
   d. TEXT 노드 → content + css 추출
   e. skip 대상 제거
   f. 각 BP의 CSS 값을 mo/pc로 분리 저장

5. remapped.json 출력
```
