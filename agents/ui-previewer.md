---
description: Preview UI with Gemini image or ASCII art fallback
argument-hint: "UI description or design folder path"
---

# /su.ui

Preview UI from description or design guide folder.

- **Gemini enabled**: Generate actual UI image
- **Gemini disabled**: ASCII art fallback

## Usage

```
/su.ui "login page"                    # Text description
/su.ui "dashboard" --layout grid       # With layout option
/su.ui ./design/                       # Design guide folder
/su.ui ./mockups/login.html            # Single HTML file
```

## Process

### 0. Detect Input Type

First, determine if input is:

- **Text description**: Generate UI from description
- **Folder path**: Read design files and generate UI
- **File path**: Read single file and generate UI

**Detection logic:**

```
if (input starts with "./" or "/" or contains "/" or "\") → path
else → text description
```

### 1. If Folder/File Path: Read Design Files

**Supported file formats:**

| Format | Purpose | How to read |
| ------ | ------- | ----------- |
| `*.html` | HTML mockups/prototypes | Read and parse structure |
| `*.md` | Design guide documents | Read content |
| `*.json` | Design tokens, theme config | Parse JSON |
| `*.css` / `*.scss` | Style variables, colors | Extract variables |
| `*.png` / `*.jpg` / `*.webp` | UI screenshots, mockups | **Use Read tool** (multimodal) |
| `*.svg` | Icons, vector graphics | Read as XML |
| `*.figma.json` | Figma export | Parse components |

**Reading images:**

Claude can read images using the Read tool. When encountering image files:

1. Use Read tool to view the image
2. Analyze UI structure, colors, layout from the image
3. Extract component hierarchy

**Folder scanning priority:**

1. `*.html` files first (main structure)
2. `*.png` / `*.jpg` images (visual reference)
3. `*.json` (design tokens)
4. `*.css` / `*.scss` (styles)
5. `*.md` (documentation)

**Example folder structure:**

```
design/
├── mockup.html          # Main HTML mockup
├── screenshot.png       # UI screenshot
├── tokens.json          # Design tokens
├── variables.css        # CSS variables
└── style-guide.md       # Documentation
```

### 2. Analyze UI (from description or files)

Analyze the UI structure:

- Page/component name
- Required UI elements (buttons, inputs, cards, etc.)
- Layout structure (header-footer, sidebar, grid, etc.)
- **Colors and typography** (from design tokens/CSS)
- **Component hierarchy** (from HTML/images)

### 3. Check Gemini Status and Generate

**Check Gemini authentication:**

```bash
su-core gemini status
```

Or check config file: `~/.config/core/gemini.json`

#### If Gemini Enabled: Generate UI Image + Code

##### A. UI Mockup Image Generation

```bash
node "$(node -p "process.env.APPDATA || require('os').homedir() + '/.config'")/core/hooks/scripts/llm-orchestrate.js" gemini image "Modern UI mockup: [UI Description from step 2]. Clean design, [colors/typography if available], mobile-first responsive layout" --output "./ui-preview.png"
```

##### B. UI Code Generation (from design files)

When design files (image/HTML/folder) are provided, use Gemini to generate production-ready component code:

```bash
node "$(node -p "process.env.APPDATA || require('os').homedir() + '/.config'")/core/hooks/scripts/llm-orchestrate.js" gemini orchestrate "You are a UI code generator. Analyze the provided design and generate production-ready React TypeScript components with Tailwind CSS. Output complete component code with proper types, responsive layout, and accessibility attributes."
```

Pass the design context (file contents, extracted colors, layout structure from step 2) as the user prompt via stdin or arguments.

**When to use each:**

| Input | Image (Step A) | Code (Step B) |
| ----- | -------------- | ------------- |
| Text description | Generate mockup | Skip |
| Image/HTML/Folder | Generate mockup | Generate component code |

#### If Gemini Disabled: ASCII Art Fallback

Generate ASCII art based on the UI description:

**Input format:**

- Page name
- Layout type (centered, sidebar, grid, header-footer)
- Components list (type, label, position)

**Example ASCII output:**

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

## Example (with Gemini)

```
User: /su.ui ./design/dashboard/

Claude: Reading design folder...
  - Found: mockup.png, tokens.json, style-guide.md

Analyzing design files...
  - Layout: Sidebar + Main content
  - Colors: Primary #2F6BFF, Background #F5F5F5
  - Components: Header, Sidebar, 3 StatCards, Footer

Generating UI mockup with Gemini...

✅ UI Preview generated: ./ui-preview-1706234567.png

[Image displayed]

**Component Breakdown:**
1. Header (logo, user menu)
2. Sidebar (navigation)
3. StatsCard (reusable card)
4. Footer (copyright, links)
5. DashboardLayout (overall layout)

Next step: /su.spec "dashboard page"
```

## Example (ASCII Fallback)

```
User: /su.ui "Dashboard page - header, sidebar, main content (3 cards), footer"

Claude: Gemini not configured. Using ASCII preview...

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

💡 Tip: Run `su-core gemini auth` for actual UI image generation

Next step: /su.spec "dashboard page"
```

## Notes

- For complex UI, request in multiple parts
- Layout options: `sidebar`, `header-footer`, `grid`, `centered`, `split`
- Gemini generates high-quality mockups; ASCII is for quick visualization
- Design folder input extracts colors, typography, and component structure automatically

---

ARGUMENTS: $ARGUMENTS
