---
description: Preview UI with ASCII art
argument-hint: "UI description"
---

# /vibe.ui

Preview UI with ASCII art.

## Usage

```
/vibe.ui "login page"
/vibe.ui "dashboard" --layout grid
```

## Process

### 1. Analyze UI Description

Analyze user's requested UI description:
- Page/component name
- Required UI elements (buttons, inputs, cards, etc.)
- Layout structure (header-footer, sidebar, grid, etc.)

### 2. Generate ASCII Art

Generate ASCII art based on the UI description:

**Input format:**
- Page name
- Layout type (centered, sidebar, grid, header-footer)
- Components list (type, label, position)

### 3. Output ASCII Art

Output generated ASCII art:

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

### 4. Generate Component List

Suggest list of components needed for UI:

**Required Components:**
- `Header.tsx` - Header ("Welcome")
- `LoginForm.tsx` - Form container
- `Input.tsx` - Reusable input field
- `Button.tsx` - Login button

**Expected File Structure:**
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
User: /vibe.ui "Dashboard page - header, sidebar, main content (3 cards), footer"

Claude: Generating dashboard UI preview...

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

**Required Components:**
1. Header (logo, user menu)
2. Sidebar (navigation)
3. StatsCard (reusable card)
4. Footer (copyright, links)
5. DashboardLayout (overall layout)

**Layout Structure:**
- Layout: sidebar (fixed left)
- Main: grid (3 columns)
- Responsive: Changes to 1 column on mobile

Next step:
  vibe spec "dashboard page"
```

## Notes

- For complex UI, request in multiple parts
- Layout options: `sidebar`, `header-footer`, `grid`, `centered`, `split`
- ASCII art is for quick visualization before actual implementation

---

ARGUMENTS: $ARGUMENTS
