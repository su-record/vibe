# /vibe.ui

UI를 ASCII 아트로 미리보기합니다.

## Usage

```
/vibe.ui "로그인 페이지"
/vibe.ui "대시보드" --layout grid
```

## Process

### 1. UI 설명 분석

사용자가 요청한 UI 설명을 분석합니다:
- 페이지/컴포넌트 이름
- 필요한 UI 요소 (버튼, 입력, 카드 등)
- 레이아웃 구조 (header-footer, sidebar, grid 등)

### 2. MCP 도구 사용

`mcp__su-record-hi-ai__preview_ui_ascii` 도구를 사용하여 ASCII 아트 생성:

```javascript
{
  page_name: "로그인 페이지",
  layout_type: "centered",
  components: [
    { type: "header", label: "Welcome", position: "top" },
    { type: "input", label: "Email", position: "center" },
    { type: "input", label: "Password", position: "center" },
    { type: "button", label: "Login", position: "center" }
  ]
}
```

### 3. ASCII 아트 출력

생성된 ASCII 아트를 출력:

```
┌─────────────────────────────────────────┐
│               Welcome                    │
├─────────────────────────────────────────┤
│                                          │
│         ┌─────────────────────┐          │
│  Email: │                     │          │
│         └─────────────────────┘          │
│                                          │
│         ┌─────────────────────┐          │
│  Pass:  │                     │          │
│         └─────────────────────┘          │
│                                          │
│         ┌─────────────────────┐          │
│         │       Login         │          │
│         └─────────────────────┘          │
│                                          │
└─────────────────────────────────────────┘
```

### 4. 컴포넌트 목록 생성

UI에 필요한 컴포넌트 목록 제안:

**필요한 컴포넌트:**
- `Header.tsx` - 헤더 ("Welcome")
- `LoginForm.tsx` - 폼 컨테이너
- `Input.tsx` - 재사용 가능한 입력 필드
- `Button.tsx` - 로그인 버튼

**예상 파일 구조:**
```
src/
├── components/
│   ├── common/
│   │   ├── Input.tsx
│   │   └── Button.tsx
│   └── auth/
│       ├── Header.tsx
│       └── LoginForm.tsx
└── pages/
    └── LoginPage.tsx
```

## Example

```
User: /vibe.ui "대시보드 페이지 - 헤더, 사이드바, 메인 콘텐츠 (3개 카드), 푸터"

Claude: 대시보드 UI 미리보기를 생성합니다...

┌────────────────────────────────────────────────────────┐
│  [Logo]  Dashboard                    [User] [Logout]  │
├────────┬───────────────────────────────────────────────┤
│        │                                               │
│ Home   │  ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│ Stats  │  │  Card 1  │ │  Card 2  │ │  Card 3  │      │
│ Users  │  │          │ │          │ │          │      │
│ Settings│  │  100     │ │  200     │ │  50      │      │
│        │  └──────────┘ └──────────┘ └──────────┘      │
│        │                                               │
│        │                                               │
├────────┴───────────────────────────────────────────────┤
│  © 2025 Company                    Privacy | Terms    │
└────────────────────────────────────────────────────────┘

**필요한 컴포넌트:**
1. Header (로고, 사용자 메뉴)
2. Sidebar (네비게이션)
3. StatsCard (재사용 카드)
4. Footer (저작권, 링크)
5. DashboardLayout (전체 레이아웃)

**레이아웃 구조:**
- Layout: sidebar (왼쪽 고정)
- Main: grid (3열)
- Responsive: 모바일에서는 1열로 변경

다음 단계:
  vibe spec "대시보드 페이지"
```

## Notes

- 복잡한 UI는 여러 번 나누어서 요청하세요
- 레이아웃 옵션: `sidebar`, `header-footer`, `grid`, `centered`, `split`
- ASCII 아트는 실제 구현 전 빠른 시각화 목적입니다
