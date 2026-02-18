/**
 * UI/UX Design Intelligence — Constants
 *
 * Stopwords, domain keyword map, domain-to-CSV file mapping, chart compatibility matrix
 */

import type { SearchDomain, DomainConfig, StackConfig } from './types.js';

// ─── Stopwords (80 English + 20 Korean) ─────────────────────────

export const STOPWORDS_EN: ReadonlySet<string> = new Set([
  'the', 'be', 'to', 'of', 'and', 'in', 'that', 'have', 'it', 'for',
  'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but',
  'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an',
  'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up',
  'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make',
  'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into',
  'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then',
  'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after',
]);

export const STOPWORDS_KO: ReadonlySet<string> = new Set([
  '은', '는', '이', '가', '을', '를', '에', '의', '로', '와',
  '과', '도', '만', '까지', '에서', '으로', '부터', '하고', '이나', '든지',
]);

export const STOPWORDS: ReadonlySet<string> = new Set([
  ...STOPWORDS_EN,
  ...STOPWORDS_KO,
]);

// ─── BM25 Parameters ────────────────────────────────────────────

export const BM25_K1 = 1.5;
export const BM25_B = 0.75;

// ─── Query Limits ───────────────────────────────────────────────

export const MAX_QUERY_LENGTH = 200;
export const MAX_QUERY_TOKENS = 20;
export const MIN_TOKEN_LENGTH = 2;

// ─── Cache Configuration ────────────────────────────────────────

export const LRU_MAX_SIZE = 100;
export const LRU_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Search Result Limits ───────────────────────────────────────

export const DEFAULT_MAX_RESULTS = 10;
export const MAX_RESULTS_UPPER_BOUND = 50;

// ─── Domain → CSV File Mapping ──────────────────────────────────

export const DOMAIN_CONFIG: Record<SearchDomain, DomainConfig> = {
  product: {
    file: 'products.csv',
    searchColumns: ['Product Type', 'Keywords', 'Key Considerations'],
  },
  'ui-reasoning': {
    file: 'ui-reasoning.csv',
    searchColumns: ['UI_Category', 'Recommended_Pattern', 'Style_Priority', 'Anti_Patterns'],
  },
  style: {
    file: 'styles.csv',
    searchColumns: ['Style Category', 'Keywords', 'Best For', 'AI Prompt Keywords'],
  },
  color: {
    file: 'colors.csv',
    searchColumns: ['Product Type', 'Notes'],
  },
  typography: {
    file: 'typography.csv',
    searchColumns: ['Font Pairing Name', 'Mood/Style Keywords', 'Best For'],
  },
  landing: {
    file: 'landing.csv',
    searchColumns: ['Pattern Name', 'Keywords', 'Conversion Optimization'],
  },
  chart: {
    file: 'charts.csv',
    searchColumns: ['Data Type', 'Keywords', 'Best Chart Type'],
  },
  icons: {
    file: 'icons.csv',
    searchColumns: ['Icon Name', 'Keywords', 'Best For'],
  },
  react: {
    file: 'react-performance.csv',
    searchColumns: ['Category', 'Issue', 'Keywords', 'Description'],
  },
  web: {
    file: 'web-interface.csv',
    searchColumns: ['Category', 'Issue', 'Keywords', 'Description'],
  },
  ux: {
    file: 'ux-guidelines.csv',
    searchColumns: ['Category', 'Issue', 'Description'],
  },
  prompt: {
    file: 'styles.csv',
    searchColumns: ['AI Prompt Keywords', 'CSS/Technical Keywords'],
  },
};

// ─── Stack → CSV File Mapping ───────────────────────────────────

export const STACK_CONFIG: Record<string, StackConfig> = {
  nextjs: { file: 'stacks/nextjs.csv', searchColumns: ['Category', 'Guideline', 'Description'] },
  react: { file: 'stacks/react.csv', searchColumns: ['Category', 'Guideline', 'Description'] },
  shadcn: { file: 'stacks/shadcn.csv', searchColumns: ['Category', 'Guideline', 'Description'] },
  'html-tailwind': { file: 'stacks/html-tailwind.csv', searchColumns: ['Category', 'Guideline', 'Description'] },
  svelte: { file: 'stacks/svelte.csv', searchColumns: ['Category', 'Guideline', 'Description'] },
  vue: { file: 'stacks/vue.csv', searchColumns: ['Category', 'Guideline', 'Description'] },
  nuxtjs: { file: 'stacks/nuxtjs.csv', searchColumns: ['Category', 'Guideline', 'Description'] },
  'nuxt-ui': { file: 'stacks/nuxt-ui.csv', searchColumns: ['Category', 'Guideline', 'Description'] },
  astro: { file: 'stacks/astro.csv', searchColumns: ['Category', 'Guideline', 'Description'] },
  flutter: { file: 'stacks/flutter.csv', searchColumns: ['Category', 'Guideline', 'Description'] },
  'react-native': { file: 'stacks/react-native.csv', searchColumns: ['Category', 'Guideline', 'Description'] },
  swiftui: { file: 'stacks/swiftui.csv', searchColumns: ['Category', 'Guideline', 'Description'] },
  'jetpack-compose': { file: 'stacks/jetpack-compose.csv', searchColumns: ['Category', 'Guideline', 'Description'] },
};

// ─── Domain Auto-Detection Keywords ─────────────────────────────

export const DOMAIN_KEYWORDS: Record<SearchDomain, readonly string[]> = {
  style: [
    'glassmorphism', 'neumorphism', 'brutalism', 'minimalism', 'aurora',
    'liquid glass', 'flat design', 'material', 'css style', 'design style',
    'theme', 'aesthetic', 'visual style', 'ui style',
  ],
  color: [
    'color', 'palette', 'hex', 'rgb', 'hue', 'saturation', 'dark mode',
    'light mode', 'contrast', 'brand color', 'accent', 'primary color',
  ],
  chart: [
    'chart', 'graph', 'visualization', 'data viz', 'plot', 'histogram',
    'pie chart', 'bar chart', 'line chart', 'scatter', 'heatmap', 'treemap',
    'dashboard chart', 'analytics',
  ],
  landing: [
    'landing', 'hero', 'cta', 'call to action', 'conversion', 'above fold',
    'landing page', 'section order', 'page layout',
  ],
  product: [
    'saas', 'e-commerce', 'ecommerce', 'fintech', 'healthcare', 'education',
    'portfolio', 'blog', 'cms', 'crm', 'erp', 'marketplace',
  ],
  ux: [
    'form', 'validation', 'navigation', 'onboarding', 'feedback', 'error',
    'loading', 'empty state', 'search', 'filter', 'pagination', 'scroll',
    'usability', 'user experience', 'ux guideline',
  ],
  typography: [
    'font', 'typography', 'heading', 'body text', 'google fonts', 'typeface',
    'font pairing', 'serif', 'sans-serif', 'monospace',
  ],
  icons: [
    'icon', 'lucide', 'menu icon', 'arrow icon', 'navigation icon',
    'action icon', 'status icon',
  ],
  react: [
    'react performance', 'memo', 'usecallback', 'usememo', 'virtualization',
    'lazy loading', 'code splitting', 'bundle size', 'react optimization',
  ],
  web: [
    'web interface', 'responsive', 'mobile first', 'accessibility',
    'semantic html', 'aria', 'keyboard', 'screen reader',
  ],
  prompt: [
    'ai prompt', 'prompt keywords', 'design prompt', 'css prompt',
    'technical keywords',
  ],
  'ui-reasoning': [
    'reasoning', 'decision', 'anti-pattern', 'recommendation',
    'severity', 'priority', 'decision rules',
  ],
};

// ─── Hot Cache Domains ──────────────────────────────────────────

export const HOT_CACHE_DOMAINS: readonly SearchDomain[] = ['product', 'ui-reasoning'];

// ─── Chart Library Compatibility Matrix ─────────────────────────

export const CHART_LIBRARY_COMPATIBILITY: Record<string, readonly string[]> = {
  'Chart.js': ['react', 'vue', 'svelte', 'nextjs', 'nuxtjs', 'astro', 'html-tailwind'],
  Recharts: ['react', 'nextjs'],
  'D3.js': ['react', 'vue', 'svelte', 'nextjs', 'nuxtjs', 'astro', 'html-tailwind'],
  ApexCharts: ['react', 'vue', 'svelte', 'nextjs', 'nuxtjs', 'html-tailwind'],
  Plotly: ['react', 'vue', 'nextjs', 'html-tailwind'],
  Nivo: ['react', 'nextjs'],
  Mapbox: ['react', 'vue', 'nextjs', 'nuxtjs', 'html-tailwind'],
};

// ─── UI/UX Trigger Keywords (for workflow detection) ────────────

export const UI_UX_TRIGGER_KEYWORDS: readonly string[] = [
  'website', 'landing', 'dashboard', 'app', 'e-commerce', 'portfolio',
  'saas', 'mobile app', 'web app', 'ui', 'ux', 'frontend', '디자인',
];

// ─── DataViz Trigger Keywords ───────────────────────────────────

export const DATAVIZ_TRIGGER_KEYWORDS: readonly string[] = [
  'chart', 'dashboard', 'data visualization', 'analytics', 'graph',
  'visualization', 'metrics', 'report', 'statistics', 'kpi',
  '차트', '대시보드', '시각화', '분석',
];

// ─── Hex Color Validation ───────────────────────────────────────

export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

// ─── Default Fallback Colors ────────────────────────────────────

export const DEFAULT_COLOR_PRIMARY = '#3B82F6';
export const DEFAULT_COLOR_SECONDARY = '#6366F1';
export const DEFAULT_COLOR_CTA = '#F97316';
export const DEFAULT_COLOR_BACKGROUND = '#FFFFFF';
export const DEFAULT_COLOR_TEXT = '#1E293B';
export const DEFAULT_COLOR_BORDER = '#E2E8F0';

// ─── Project Name Validation ────────────────────────────────────

export const PROJECT_NAME_REGEX = /^[a-zA-Z0-9_-]{1,50}$/;
export const PAGE_NAME_REGEX = /^[a-zA-Z0-9_-]{1,30}$/;

export const WINDOWS_RESERVED_NAMES: ReadonlySet<string> = new Set([
  'con', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9',
]);

// ─── Design System Priority Scoring ─────────────────────────────

export const PRIORITY_SCORE_EXACT = 10;
export const PRIORITY_SCORE_KEYWORD = 3;
export const PRIORITY_SCORE_OTHER = 1;
