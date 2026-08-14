# vibe.design — Code Extract Heuristics

`/vibe.design init --from=code` 가 기존 코드에서 시각 토큰을 역추출할 때 따르는 패턴.

## v1 Required Patterns

v1 에서 **반드시 동작**해야 하는 추출기 (테스트 픽스처 보장):

### 1. Tailwind config

대상: `tailwind.config.{ts,js,cjs,mjs}` · `tailwind.config.*` · `app.config.ts` (Nuxt)

```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        primary: '#5E6AD2',
        accent: '#10B981',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui'],
      },
      spacing: { '18': '4.5rem' },
    },
  },
};
```

추출 결과:
- `§2 Color Palette` ← `theme.extend.colors.*`
- `§3 Typography` ← `theme.extend.fontFamily.*`
- `§5 Layout spacing scale` ← `theme.extend.spacing.*`

### 2. CSS custom properties (CSS variables)

대상: `**/*.css` · `**/*.scss` 의 `:root { --... }`

```css
:root {
  --color-primary: #5E6AD2;
  --color-bg: #FFFFFF;
  --font-sans: 'Inter', sans-serif;
  --space-md: 16px;
}
```

추출 결과:
- `--color-*` → `§2 Color Palette` (semantic 이름 유지)
- `--font-*` → `§3 Typography`
- `--space-*` · `--size-*` → `§5 Layout`
- `--shadow-*` · `--elevation-*` → `§6 Depth`

### 3. styled-components theme

대상: `**/theme.{ts,tsx,js}` · `ThemeProvider` 의 `theme={...}`

```ts
export const theme = {
  colors: { primary: '#5E6AD2', bg: '#FFFFFF' },
  typography: { fontFamily: 'Inter, sans-serif' },
  spacing: [4, 8, 16, 24, 32],
};
```

추출 결과: 위 CSS-vars 와 동일 매핑.

## Documented-only Patterns (v1 비범위, Phase 2+)

문서로만 정리. 실제 추출기는 Phase 2 에서 구현.

| 패턴 | 위치 | Phase 2 계획 |
|-----|------|------------|
| PostCSS custom properties | `postcss.config.*` + `@custom-media` | Tailwind 추출기 확장 |
| SCSS variables | `**/*.scss` 의 `$variable` | CSS-vars 추출기 확장 |
| Emotion theme | `@emotion/react` ThemeProvider | styled-components 추출기 확장 |
| Vanilla Extract | `*.css.ts` `createTheme` | 신규 추출기 |
| Panda CSS / Linaria | `panda.config.ts` / `*.linaria.ts` | 신규 추출기 |
| Flutter ThemeData | `theme.dart` | 모바일 트랙 (Phase 3) |
| iOS asset catalog | `*.xcassets/Colors.xcassets` | 모바일 트랙 (Phase 3) |
| Android styles.xml | `res/values/colors.xml` | 모바일 트랙 (Phase 3) |

## Stack 매핑

`.vibe/config.json#stacks[].type` 으로 추출기 선택:

| Stack | v1 활성 추출기 |
|------|--------------|
| `typescript-react` / `typescript-nextjs` | Tailwind + CSS-vars + styled-components |
| `typescript-vue` / `typescript-nuxt` | Tailwind + CSS-vars |
| `typescript-svelte` / `typescript-astro` | Tailwind + CSS-vars |
| `typescript-angular` | CSS-vars (Tailwind 옵션) |
| `typescript-react-native` | styled-components (Theme 객체) |
| `dart-flutter` · `swift-ios` · `kotlin-android` | (Phase 3 — 문서만) |

## Fallback

추출 실패 또는 토큰 0 개 → 인터뷰 모드로 자동 폴백 (`--from=interview` 처럼 동작).
사용자에게 한 줄 안내: "코드에서 토큰을 찾지 못해 인터뷰로 전환합니다."
