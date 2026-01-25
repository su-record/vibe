---
description: Sync UI code with design files
argument-hint: "design folder path"
---

# /vibe.ui-sync

Analyze design files and update existing UI code to match.

## Usage

```
/vibe.utils --ui-sync ./design/ui/
/vibe.utils --ui-sync ./mockups/
/vibe.utils --ui-sync ./design/homepage.html
```

## Process

### 1. Read ALL Design Files

**MANDATORY: Read every file in the design folder.**

Scan folder and read ALL supported files:

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

### 2. Analyze Design Intent

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

**Interactions:**
- Button states (hover, active, disabled)
- Form validation styles
- Animations/transitions

### 3. Find Existing UI Code

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

### 4. Compare Design vs Code

Create a diff report:

| Aspect | Design | Current Code | Action |
| ------ | ------ | ------------ | ------ |
| Colors | #2F6BFF | #3B82F6 | Update |
| Font | Inter | system-ui | Update |
| Border radius | 12px | 8px | Update |
| Component X | Exists | Missing | Create |

### 5. Generate Update Plan

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

### 6. Execute Updates

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

### 7. Verify Changes

After updates:

1. Run build to check for errors
2. Show before/after comparison
3. List all files modified

## Output Format

```
📂 Design Analysis: ./design/ui/

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

## Example

```
User: /vibe.utils --ui-sync ./design/dashboard/

Claude: Reading design folder...

📂 Files found:
  - dashboard.html
  - dashboard-dark.png
  - dashboard-light.png
  - tokens.json
  - components.md

Reading dashboard.html...
[Extracts: header, sidebar, 3-column grid, card components]

Reading dashboard-dark.png...
[Analyzes: dark theme colors, spacing, typography]

Reading tokens.json...
[Extracts: color palette, spacing scale, typography scale]

📊 Design Analysis Complete:

Layout: Header + Sidebar + 3-column main
Theme: Dark (#0F172A bg, #F8FAFC text)
Components: Header, Sidebar, StatCard, DataTable

🔍 Comparing with existing code...

Found: src/pages/Dashboard.tsx
Found: src/components/StatCard.tsx
Missing: src/components/DataTable.tsx

Differences:
1. StatCard border-radius: design=16px, code=8px
2. Sidebar width: design=240px, code=200px
3. Header height: design=64px, code=56px
4. Primary color: design=#6366F1, code=#3B82F6
5. DataTable component: missing

Apply 4 updates + create 1 component? [Y/n]

User: Y

✅ Changes applied:
  - src/components/StatCard.tsx (border-radius)
  - src/components/Sidebar.tsx (width)
  - src/components/Header.tsx (height)
  - tailwind.config.js (primary color)
  - src/components/DataTable.tsx (created)

Run `npm run dev` to preview changes.
```

## Notes

- Always read ALL files including images
- Ask for confirmation before making changes
- Preserve existing functionality while updating styles
- Create backup recommendation for large changes
- Support both CSS-in-JS and traditional CSS

---

ARGUMENTS: $ARGUMENTS
