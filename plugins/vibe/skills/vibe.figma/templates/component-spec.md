# component-spec.json 템플릿

architect 에이전트가 sections.json을 분석하여 생성하는 설계서.
builder 에이전트는 이 설계서대로만 구현한다.

## 생성 규칙

```
입력: /tmp/{feature}/{bp}-main/sections.json
출력: /tmp/{feature}/{bp}-main/component-spec.json

⛔ CSS 값을 결정하지 않는다 (figma-to-scss.js가 담당)
⛔ SCSS 파일을 생성하지 않는다
✅ HTML 구조, 태그 선택, 컴포넌트 분리, 이미지 분류만 결정
```

## 구조

```json
{
  "meta": {
    "feature": "winter-pcbang",
    "bp": "mo",
    "designWidth": 720,
    "stack": "nuxt2-vue2-scss"
  },

  "components": [
    {
      "name": "KidSection",
      "sectionName": "KID",
      "file": "components/{feature}/KidSection.vue",
      "scssFile": "_kid.scss",
      "tag": "section",
      "id": "kid",

      "bg": {
        "image": "bg/kid-bg.webp",
        "method": "css-background"
      },

      "elements": [
        {
          "class": "btn-login",
          "tag": "button",
          "role": "interactive",
          "event": { "type": "click", "action": "emit('login')" },
          "children": [
            {
              "class": "btn-login-btn-login",
              "tag": "div",
              "role": "layout"
            },
            {
              "class": "btn-login-btn-login-krafton-id",
              "tag": "img",
              "role": "content-image",
              "src": "content/kid-krafton-id.webp",
              "alt": "KRAFTON ID 로그인"
            }
          ]
        },
        {
          "class": "krafton-id",
          "tag": "p",
          "role": "text",
          "text": "KRAFTON ID로 로그인하고 이벤트에 참여하세요!..."
        },
        {
          "class": "steam-account",
          "tag": "div",
          "role": "layout",
          "children": [
            {
              "class": "steam-account-frame-27161",
              "tag": "a",
              "role": "link",
              "href": "#",
              "children": [
                {
                  "class": "steam-account-frame-27161-krafton-id-steam",
                  "tag": "span",
                  "role": "text",
                  "text": "KRAFTON ID Steam 연동 안내"
                }
              ]
            },
            {
              "class": "steam-account-kakao-games-krafton-id",
              "tag": "p",
              "role": "text",
              "text": "Kakao games는 게임 내에서만..."
            }
          ]
        }
      ],

      "imageClassification": [
        {
          "node": "BG",
          "decision": "bg",
          "reason": "name='BG', 합성 배경, TEXT 자식 없음"
        },
        {
          "node": "KRAFTON ID 로그인",
          "decision": "content-image",
          "reason": "RENDERED_IMAGE (디자인 텍스트, outline 효과)"
        },
        {
          "node": "볼트_2",
          "decision": "skip",
          "reason": "5x5 장식 볼트, 동일 imageRef 4개 → CSS로 대체 가능"
        }
      ]
    }
  ],

  "shared": [],

  "tokens": {
    "note": "figma-to-scss.js가 _tokens.scss 자동 생성. architect는 참조만."
  }
}
```

## 판단 기준

### tag 선택
| sections.json 조건 | tag |
|---|---|
| 섹션 루트 | `section` |
| type=TEXT + 제목 역할 (name에 title/heading) | `h2`~`h6` |
| type=TEXT + 설명 | `p` |
| type=TEXT + 라벨 | `span` / `strong` |
| name에 btn/button/CTA | `button` |
| name에 link/연동/안내 + href 가능 | `a` |
| type=RENDERED_IMAGE | `img` |
| imageRef 있음 + 콘텐츠 이미지 | `img` |
| INSTANCE 반복 2+ | 부모에 v-for 표시 |
| 나머지 FRAME/GROUP | `div` |

### role 종류
| role | 의미 |
|---|---|
| `bg` | 배경 (CSS background-image) |
| `layout` | 레이아웃 컨테이너 |
| `text` | 텍스트 콘텐츠 |
| `content-image` | 콘텐츠 이미지 (img 태그) |
| `interactive` | 클릭/인터랙션 가능 |
| `link` | 네비게이션 링크 |
| `decoration` | 장식 (aria-hidden) |
| `list` | 반복 구조 (v-for) |
| `skip` | 무시 (너무 작거나 불필요) |

### 이미지 분류 (imageClassification)
⛔ 모든 이미지 관련 노드에 대해 반드시 분류 기록.
| decision | 조건 |
|---|---|
| `bg` | isBGFrame, TEXT 자식 없음 |
| `content-image` | RENDERED_IMAGE, 벡터 글자, 디자인 텍스트 |
| `asset` | imageRef 있는 아이콘/썸네일 |
| `skip` | 너무 작은 장식 (≤5px), CSS로 대체 가능 |
| `html` | TEXT 자식 포함, 인터랙티브, 동적 데이터 |

### 공유 컴포넌트 (shared)
- 동일 구조 INSTANCE가 2+ 섹션에서 사용 → shared
- 3+ 사용 시 필수 분리
- Props/Slots 인터페이스 정의 필수
