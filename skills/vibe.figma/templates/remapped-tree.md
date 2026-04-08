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
      "bg": {
        "mo": { "nodeId": "...", "file": "mo-main/bg/hero-bg.png" },
        "pc": { "nodeId": "...", "file": "pc-main/bg/hero-bg.png" }
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
                "mo": { "nodeId": "...", "file": "mo-main/content/hero-title.png", "size": { "w": 620, "h": 174 } },
                "pc": { "nodeId": "...", "file": "pc-main/content/hero-title.png", "size": { "w": 1200, "h": 340 } }
              },
              "alt": "추운 겨울, 따뜻한 보상이 펑펑"
            },
            {
              "role": "subtitle-image",
              "type": "node-render",
              "render": {
                "mo": { "nodeId": "...", "file": "mo-main/content/hero-subtitle.png", "size": { "w": 586, "h": 32 } },
                "pc": { "nodeId": "...", "file": "pc-main/content/hero-subtitle.png", "size": { "w": 1100, "h": 60 } }
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
            "mo": { "nodeId": "...", "file": "mo-main/bg/period-bg.png" },
            "pc": { "nodeId": "...", "file": "pc-main/bg/period-bg.png" }
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
Phase 2 완료 후, Phase 3 시작 전에 실행:

1. 모든 BP의 tree.json 로드
2. 1depth 자식으로 섹션 목록 생성
3. BP 간 섹션 name 매칭
4. 각 섹션에 대해 재귀적으로:
   a. 노드 타입 분류 (위 테이블)
   b. BG 프레임 식별 → frame-render로 마킹
   c. 콘텐츠 이미지/벡터 그룹 → node-render로 마킹
   d. TEXT 노드 → content + css 추출
   e. skip 대상 제거
   f. 각 BP의 CSS 값을 mo/pc로 분리 저장
5. remapped.json 출력
```
