---
description: Sync UI code with design files (Gemini or Claude)
argument-hint: "design folder path"
---

# /vibe.ui-sync

Analyze design files and update existing UI code to match.

- **Gemini enabled**: Gemini analyzes designs and generates code
- **Gemini disabled**: Claude handles directly

## Usage

```
/vibe.utils --ui-sync ./design/ui/
/vibe.utils --ui-sync ./mockups/
/vibe.utils --ui-sync ./design/homepage.html
```

## Process

### 0. Check Gemini Status

**FIRST: Check if Gemini is available.**

```bash
vibe gemini status
```

Or check: `~/.config/vibe/gemini.json` or `~/.config/vibe/gemini-apikey.json`

- **Gemini available** → Use Gemini for code generation (Step 1A)
- **Gemini NOT available** → Claude handles directly (Step 1B)

---

## Path A: Gemini Enabled

### 1A. Collect ALL Design Files

Scan folder and collect all files to send to Gemini:

| Format | What to Collect |
| ------ | --------------- |
| `*.html` | Full HTML content |
| `*.png` / `*.jpg` / `*.webp` | Image as base64 |
| `*.json` | Design tokens, theme config |
| `*.css` / `*.scss` | Style variables |
| `*.md` | Design guidelines |
| `*.svg` | Vector content |

### 2A. Send to Gemini

Use the Gemini UI Generator script:

```bash
node hooks/scripts/gemini-ui-gen.js \
  --design-folder ./design/ui/ \
  --framework react \
  --output ./src/components
```

**Or call Gemini API directly with all files:**

```javascript
// Prepare multipart content
const parts = [
  // Images as inline data
  { inlineData: { mimeType: "image/png", data: imageBase64 } },
  // HTML/CSS/JSON as text
  { text: `HTML Mockup:\n${htmlContent}` },
  { text: `CSS Styles:\n${cssContent}` },
  { text: `Design Tokens:\n${jsonContent}` },
  // Prompt
  { text: `
    Analyze these design files and generate production-ready React components.

    Requirements:
    1. Match the visual design exactly
    2. Use Tailwind CSS
    3. TypeScript with proper types
    4. Responsive and accessible

    Output complete component code.
  ` }
];
```

### 3A. Apply Gemini's Output

1. Parse Gemini's code output
2. Extract component files
3. Compare with existing code
4. Show diff to user
5. Apply with confirmation

---

## Path B: Gemini NOT Available (Claude Fallback)

### 1B. Read ALL Design Files

**MANDATORY: Read every file in the design folder.**

| Format | What to Extract |
| ------ | --------------- |
| `*.html` | Structure, components, layout, classes |
| `*.png` / `*.jpg` / `*.webp` | Visual layout, colors, spacing, typography |
| `*.json` | Design tokens, theme config, component props |
| `*.css` / `*.scss` | Variables, colors, spacing, typography |
| `*.md` | Design guidelines, component specs |
| `*.svg` | Icons, vector assets |

**Reading order:**

1. `*.md` files first (design specs/guidelines)
2. `*.html` files (structure reference)
3. `*.png` / `*.jpg` images (visual reference - use Read tool)
4. `*.json` (design tokens)
5. `*.css` / `*.scss` (styles)

**CRITICAL:** Do NOT skip any file. Read images with the Read tool.

### 2B. Analyze Design Intent (Claude)

From all design files, extract:

**Layout:**
- Page structure (header, sidebar, main, footer)
- Grid system (columns, gaps)
- Responsive breakpoints

**Components:**
- Component hierarchy
- Component names and types
- Props and variants

**Styling:**
- Color palette (primary, secondary, accent, background, text)
- Typography (font family, sizes, weights)
- Spacing system (padding, margin, gaps)
- Border radius, shadows
- Dark/light theme support

### 3B. Generate Code (Claude)

Claude generates the code directly based on analysis.

---

## Common Steps (Both Paths)

### 4. Find Existing UI Code

Search for existing UI implementation:

```
src/components/
src/pages/
src/views/
src/ui/
app/components/
app/(routes)/
```

Detect framework:
- React: `*.tsx`, `*.jsx`
- Vue: `*.vue`
- Svelte: `*.svelte`
- Angular: `*.component.ts`

### 5. Compare Design vs Code

Create a diff report:

| Aspect | Design | Current Code | Action |
| ------ | ------ | ------------ | ------ |
| Colors | #2F6BFF | #3B82F6 | Update |
| Font | Inter | system-ui | Update |
| Border radius | 12px | 8px | Update |
| Component X | Exists | Missing | Create |

### 6. Generate Update Plan

List all changes needed:

**Style Updates:**
```css
/* Before */
--primary: #3B82F6;
--radius: 8px;

/* After */
--primary: #2F6BFF;
--radius: 12px;
```

**Component Updates:**
```tsx
// Before: Missing hover state
<Button>Click</Button>

// After: Add hover state from design
<Button className="hover:bg-primary-600">Click</Button>
```

**New Components:**
- List components that exist in design but not in code

### 7. Execute Updates

**Ask user before making changes:**

```
Found 12 differences between design and code:
- 3 color updates
- 2 spacing changes
- 1 new component
- 6 style adjustments

Proceed with updates? [Y/n]
```

**Apply changes:**

1. Update CSS/SCSS variables
2. Update Tailwind config (if applicable)
3. Update component styles
4. Create new components (if needed)
5. Update imports

### 8. Verify Changes

After updates:

1. Run build to check for errors
2. Show before/after comparison
3. List all files modified

## Output Format

```
📂 Design Analysis: ./design/ui/
🤖 Mode: Gemini (or Claude fallback)

Files Read:
  ✓ homepage.html (structure)
  ✓ homepage.png (visual)
  ✓ tokens.json (design tokens)
  ✓ styles.css (variables)

Design Specs Extracted:
  Colors: #2F6BFF (primary), #1E293B (text), #F8FAFC (bg)
  Typography: Inter, 14px base, 1.5 line-height
  Spacing: 4px base unit
  Border Radius: 12px (cards), 8px (buttons)

Differences Found: 8

| File | Change | Status |
|------|--------|--------|
| tailwind.config.js | Update primary color | ⏳ Pending |
| src/components/Button.tsx | Add hover state | ⏳ Pending |
| src/styles/globals.css | Update CSS variables | ⏳ Pending |

Apply changes? [Y/n]

✅ Updated 3 files
  - tailwind.config.js
  - src/components/Button.tsx
  - src/styles/globals.css

Next: Run `npm run build` to verify
```

## Example (with Gemini)

```
User: /vibe.utils --ui-sync ./design/dashboard/

Claude: Checking Gemini status...
✅ Gemini: OAuth authenticated (user@example.com)

📂 Collecting design files...
  - dashboard.html
  - dashboard-dark.png
  - dashboard-light.png
  - tokens.json
  - components.md

🤖 Sending to Gemini for analysis...

Gemini Response:
  Layout: Header + Sidebar + 3-column main
  Theme: Dark (#0F172A bg, #F8FAFC text)
  Components: Header, Sidebar, StatCard, DataTable

Generated code:
  - Header.tsx (64 lines)
  - Sidebar.tsx (45 lines)
  - StatCard.tsx (32 lines)
  - DataTable.tsx (78 lines)

🔍 Comparing with existing code...

Found: src/pages/Dashboard.tsx
Found: src/components/StatCard.tsx
Missing: src/components/DataTable.tsx

Differences:
1. StatCard border-radius: design=16px, code=8px
2. Sidebar width: design=240px, code=200px
3. Primary color: design=#6366F1, code=#3B82F6
4. DataTable component: missing

Apply 3 updates + create 1 component? [Y/n]
```

## Example (Claude Fallback)

```
User: /vibe.utils --ui-sync ./design/dashboard/

Claude: Checking Gemini status...
⚠️ Gemini not configured. Using Claude fallback.

📂 Reading design files...

Reading dashboard.html...
[Extracts: header, sidebar, 3-column grid]

Reading dashboard-dark.png...
[Analyzes: dark theme colors, spacing]

Reading tokens.json...
[Extracts: color palette, spacing scale]

📊 Design Analysis Complete (Claude):

Layout: Header + Sidebar + 3-column main
Theme: Dark (#0F172A bg, #F8FAFC text)

🔍 Comparing with existing code...
...
```

## Notes

- Always check Gemini status first
- Gemini handles image analysis better than Claude for visual matching
- Claude fallback works but may be less accurate for complex visuals
- Always read ALL files including images
- Ask for confirmation before making changes
- Preserve existing functionality while updating styles

---

ARGUMENTS: $ARGUMENTS
