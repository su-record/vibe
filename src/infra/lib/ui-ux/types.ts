/**
 * UI/UX Design Intelligence — Type Definitions
 *
 * CSV 데이터 행별 인터페이스 + 검색/디자인 시스템 타입
 */

// ─── Search Domains & Stacks ────────────────────────────────────

export type SearchDomain =
  | 'style'
  | 'color'
  | 'chart'
  | 'landing'
  | 'product'
  | 'ux'
  | 'typography'
  | 'icons'
  | 'react'
  | 'web'
  | 'prompt'
  | 'ui-reasoning';

export type StackName =
  | 'nextjs'
  | 'react'
  | 'shadcn'
  | 'html-tailwind'
  | 'svelte'
  | 'vue'
  | 'nuxtjs'
  | 'nuxt-ui'
  | 'astro'
  | 'flutter'
  | 'react-native'
  | 'swiftui'
  | 'jetpack-compose';

// ─── CSV Row Interfaces ─────────────────────────────────────────

export interface ProductRow {
  No: string;
  'Product Type': string;
  Keywords: string;
  'Primary Style Recommendation': string;
  'Secondary Styles': string;
  'Landing Page Pattern': string;
  'Dashboard Style (if applicable)': string;
  'Color Palette Focus': string;
  'Key Considerations': string;
}

export interface UiReasoningRow {
  No: string;
  UI_Category: string;
  Recommended_Pattern: string;
  Style_Priority: string;
  Color_Mood: string;
  Typography_Mood: string;
  Key_Effects: string;
  Decision_Rules: string;
  Anti_Patterns: string;
  Severity: string;
}

export interface StyleRow {
  No: string;
  'Style Category': string;
  Type: string;
  Keywords: string;
  'Primary Colors': string;
  'Secondary Colors': string;
  'Effects & Animation': string;
  'Best For': string;
  'Do Not Use For': string;
  'Light Mode ✓': string;
  'Dark Mode ✓': string;
  Performance: string;
  Accessibility: string;
  'Mobile-Friendly': string;
  'Conversion-Focused': string;
  'Framework Compatibility': string;
  'Era/Origin': string;
  Complexity: string;
  'AI Prompt Keywords': string;
  'CSS/Technical Keywords': string;
  'Implementation Checklist': string;
  'Design System Variables': string;
}

export interface ColorRow {
  No: string;
  'Product Type': string;
  'Primary (Hex)': string;
  'Secondary (Hex)': string;
  'CTA (Hex)': string;
  'Background (Hex)': string;
  'Text (Hex)': string;
  'Border (Hex)': string;
  Notes: string;
}

export interface TypographyRow {
  No: string;
  'Font Pairing Name': string;
  Category: string;
  'Heading Font': string;
  'Body Font': string;
  'Mood/Style Keywords': string;
  'Best For': string;
  'Google Fonts URL': string;
  'CSS Import': string;
  'Tailwind Config': string;
  Notes: string;
}

export interface LandingRow {
  No: string;
  'Pattern Name': string;
  Keywords: string;
  'Section Order': string;
  'Primary CTA Placement': string;
  'Color Strategy': string;
  'Recommended Effects': string;
  'Conversion Optimization': string;
}

export interface ChartRow {
  No: string;
  'Data Type': string;
  Keywords: string;
  'Best Chart Type': string;
  'Secondary Options': string;
  'Color Guidance': string;
  'Performance Impact': string;
  'Accessibility Notes': string;
  'Library Recommendation': string;
  'Interactive Level': string;
}

export interface IconRow {
  No: string;
  Category: string;
  'Icon Name': string;
  Keywords: string;
  Library: string;
  'Import Code': string;
  Usage: string;
  'Best For': string;
  Style: string;
}

export interface ReactPerfRow {
  No: string;
  Category: string;
  Issue: string;
  Keywords: string;
  Platform: string;
  Description: string;
  Do: string;
  "Don't": string;
  'Code Example Good': string;
  'Code Example Bad': string;
  Severity: string;
}

export interface UxGuidelineRow {
  No: string;
  Category: string;
  Issue: string;
  Platform: string;
  Description: string;
  Do: string;
  "Don't": string;
  'Code Example Good': string;
  'Code Example Bad': string;
  Severity: string;
}

export interface WebInterfaceRow {
  No: string;
  Category: string;
  Issue: string;
  Keywords: string;
  Platform: string;
  Description: string;
  Do: string;
  "Don't": string;
  'Code Example Good': string;
  'Code Example Bad': string;
  Severity: string;
}

export interface StackGuidelineRow {
  No: string;
  Category: string;
  Guideline: string;
  Description: string;
  Do: string;
  "Don't": string;
  'Code Good': string;
  'Code Bad': string;
  Severity: string;
  'Docs URL': string;
}

// ─── CSV Row Union ──────────────────────────────────────────────

export type CsvRow =
  | ProductRow
  | UiReasoningRow
  | StyleRow
  | ColorRow
  | TypographyRow
  | LandingRow
  | ChartRow
  | IconRow
  | ReactPerfRow
  | UxGuidelineRow
  | WebInterfaceRow
  | StackGuidelineRow;

// ─── Search Result ──────────────────────────────────────────────

export interface SearchResultItem<T> {
  item: T;
  score: number;
  index: number;
}

export interface SearchResult<T = Record<string, string>> {
  domain: string;
  query: string;
  file: string;
  count: number;
  results: SearchResultItem<T>[];
}

// ─── BM25 Engine ────────────────────────────────────────────────

export interface Bm25ScoreItem {
  index: number;
  score: number;
}

// ─── Design System ──────────────────────────────────────────────

export interface DesignSystemColorPalette {
  primary: string;
  secondary: string;
  cta: string;
  background: string;
  text: string;
  border: string;
  notes: string;
}

export interface DesignSystemTypography {
  pairingName: string;
  headingFont: string;
  bodyFont: string;
  googleFontsUrl: string;
  cssImport: string;
}

export interface DesignSystemStyle {
  name: string;
  keywords: string;
  primaryColors: string;
  effects: string;
  cssKeywords: string;
  variables: string;
  checklist: string;
}

export interface DesignSystemLayout {
  pattern: string;
  sections: string;
  ctaPlacement: string;
  colorStrategy: string;
  effects: string;
  conversionTips: string;
}

export interface DecisionRules {
  [key: string]: string;
}

export interface DesignSystem {
  projectName: string;
  category: string;
  stylePriority: string[];
  colorMood: string;
  typographyMood: string;
  antiPatterns: string[];
  severity: string;
  decisionRules: DecisionRules;
  colorPalette: DesignSystemColorPalette | null;
  typography: DesignSystemTypography | null;
  style: DesignSystemStyle | null;
  layout: DesignSystemLayout | null;
  dashboardLayout: string | null;
  cssVariables: Record<string, string>;
}

// ─── Domain CSV File Mapping ────────────────────────────────────

export interface DomainConfig {
  file: string;
  searchColumns: string[];
}

export interface StackConfig {
  file: string;
  searchColumns: string[];
}

// ─── LRU Cache ──────────────────────────────────────────────────

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
}
