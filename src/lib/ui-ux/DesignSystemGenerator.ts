// Design System Generator — 5-stage pipeline
// Stage 1: Category Detection → Stage 2: Reasoning → Stage 3: Multi-domain Search
// → Stage 4: Best Match Selection → Stage 5: Build DesignSystem

import type {
  DesignSystem,
  DesignSystemColorPalette,
  DesignSystemTypography,
  DesignSystemStyle,
  DesignSystemLayout,
  DecisionRules,
  SearchResultItem,
} from './types.js';
import { SearchService } from './SearchService.js';
import {
  HEX_COLOR_REGEX,
  DEFAULT_COLOR_PRIMARY,
  DEFAULT_COLOR_SECONDARY,
  DEFAULT_COLOR_CTA,
  DEFAULT_COLOR_BACKGROUND,
  DEFAULT_COLOR_TEXT,
  DEFAULT_COLOR_BORDER,
  PRIORITY_SCORE_EXACT,
  PRIORITY_SCORE_KEYWORD,
  PRIORITY_SCORE_OTHER,
  PROJECT_NAME_REGEX,
  WINDOWS_RESERVED_NAMES,
} from './constants.js';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export class DesignSystemGenerator {
  private searchService: SearchService;

  constructor(searchService?: SearchService) {
    this.searchService = searchService ?? new SearchService();
  }

  /**
   * Full 5-stage pipeline to generate design system
   */
  generate(query: string, projectName: string): DesignSystem {
    const { category, dashboardLayout } = this.detectCategory(query);
    const reasoning = this.applyReasoning(category);
    const multiDomain = this.multiDomainSearch(query, reasoning.stylePriority);

    return this.buildDesignSystem({
      projectName,
      category,
      reasoning,
      multiDomain,
      dashboardLayout,
    });
  }

  /**
   * Stage 1: Detect product category from query
   */
  detectCategory(query: string): {
    category: string;
    dashboardLayout: string | null;
  } {
    const searchResult = this.searchService.search(query, 'product', 3);

    if (searchResult.results.length === 0) {
      return { category: 'General', dashboardLayout: null };
    }

    const firstItem = searchResult.results[0].item;
    const category = firstItem['Product Type'] ?? 'General';
    const dashboardLayout =
      firstItem['Dashboard Style (if applicable)'] || null;

    return { category, dashboardLayout };
  }

  /**
   * Stage 2: Apply reasoning rules from ui-reasoning.csv
   */
  applyReasoning(category: string): {
    stylePriority: string[];
    colorMood: string;
    typographyMood: string;
    decisionRules: DecisionRules;
    antiPatterns: string[];
    severity: string;
  } {
    const searchResult = this.searchService.search(
      category,
      'ui-reasoning',
      1
    );

    if (searchResult.results.length === 0) {
      return this.getDefaultReasoning();
    }

    const row = searchResult.results[0].item;

    return {
      stylePriority: this.parseDelimited(row['Style_Priority']),
      colorMood: row['Color_Mood'] ?? 'neutral',
      typographyMood: row['Typography_Mood'] ?? 'modern',
      decisionRules: this.parseDecisionRules(row['Decision_Rules']),
      antiPatterns: this.parseDelimited(row['Anti_Patterns']),
      severity: row['Severity'] ?? 'medium',
    };
  }

  /**
   * Stage 3: Multi-domain search (style, color, typography, landing)
   */
  multiDomainSearch(
    query: string,
    stylePriority: string[]
  ): {
    style: DesignSystemStyle | null;
    colorPalette: DesignSystemColorPalette | null;
    typography: DesignSystemTypography | null;
    layout: DesignSystemLayout | null;
  } {
    const styleQuery = stylePriority[0] ?? query;
    const styleRow = this.selectBestMatch(
      this.searchService.search(styleQuery, 'style', 5).results,
      stylePriority
    );

    const colorRow = this.selectBestMatch(
      this.searchService.search(query, 'color', 5).results,
      [query]
    );

    const typoRow = this.selectBestMatch(
      this.searchService.search(query, 'typography', 5).results,
      [query]
    );

    const layoutRow = this.selectBestMatch(
      this.searchService.search(query, 'landing', 5).results,
      [query]
    );

    return {
      style: styleRow ? this.mapToStyle(styleRow) : null,
      colorPalette: colorRow ? this.mapToColorPalette(colorRow) : null,
      typography: typoRow ? this.mapToTypography(typoRow) : null,
      layout: layoutRow ? this.mapToLayout(layoutRow) : null,
    };
  }

  /**
   * Stage 4: Select best match using priority scoring
   */
  private selectBestMatch(
    results: SearchResultItem<Record<string, string>>[],
    priority: string[]
  ): Record<string, string> | null {
    if (results.length === 0) {
      return null;
    }

    let bestScore = -1;
    let bestItem: Record<string, string> | null = null;

    for (const result of results) {
      let score = result.score + PRIORITY_SCORE_OTHER;

      if (
        priority.length > 0 &&
        this.hasExactMatch(result.item, priority[0])
      ) {
        score += PRIORITY_SCORE_EXACT;
      }

      if (this.hasKeywordMatch(result.item, priority)) {
        score += PRIORITY_SCORE_KEYWORD;
      }

      if (score > bestScore) {
        bestScore = score;
        bestItem = result.item;
      }
    }

    return bestItem;
  }

  /**
   * Stage 5: Build unified DesignSystem object
   */
  private buildDesignSystem(params: {
    projectName: string;
    category: string;
    reasoning: ReturnType<DesignSystemGenerator['applyReasoning']>;
    multiDomain: ReturnType<DesignSystemGenerator['multiDomainSearch']>;
    dashboardLayout: string | null;
  }): DesignSystem {
    const { projectName, category, reasoning, multiDomain, dashboardLayout } =
      params;

    const cssVariables = this.buildCssVariables(
      multiDomain.colorPalette,
      multiDomain.typography,
      multiDomain.style
    );

    return {
      projectName,
      category,
      stylePriority: reasoning.stylePriority,
      colorMood: reasoning.colorMood,
      typographyMood: reasoning.typographyMood,
      antiPatterns: reasoning.antiPatterns,
      severity: reasoning.severity,
      decisionRules: reasoning.decisionRules,
      colorPalette: multiDomain.colorPalette,
      typography: multiDomain.typography,
      style: multiDomain.style,
      layout: multiDomain.layout,
      dashboardLayout,
      cssVariables,
    };
  }

  /**
   * Format DesignSystem to MASTER.md markdown
   */
  formatMarkdown(ds: DesignSystem): string {
    const lines: string[] = [];

    lines.push(`# ${ds.projectName} - Design System`);
    lines.push('');
    lines.push(`**Category:** ${ds.category}`);
    lines.push(`**Severity:** ${ds.severity}`);
    lines.push(`**Color Mood:** ${ds.colorMood}`);
    lines.push(`**Typography Mood:** ${ds.typographyMood}`);
    lines.push('');

    // CSS Variables
    lines.push('## CSS Variables');
    lines.push('');
    lines.push('```css');
    lines.push(':root {');
    for (const [key, value] of Object.entries(ds.cssVariables)) {
      lines.push(`  ${key}: ${value};`);
    }
    lines.push('}');
    lines.push('```');
    lines.push('');

    // Color Palette
    if (ds.colorPalette) {
      lines.push('## Color Palette');
      lines.push('');
      lines.push('| Role | Hex |');
      lines.push('|------|-----|');
      lines.push(`| Primary | ${ds.colorPalette.primary} |`);
      lines.push(`| Secondary | ${ds.colorPalette.secondary} |`);
      lines.push(`| CTA | ${ds.colorPalette.cta} |`);
      lines.push(`| Background | ${ds.colorPalette.background} |`);
      lines.push(`| Text | ${ds.colorPalette.text} |`);
      lines.push(`| Border | ${ds.colorPalette.border} |`);
      if (ds.colorPalette.notes) {
        lines.push('');
        lines.push(`**Notes:** ${ds.colorPalette.notes}`);
      }
      lines.push('');
    }

    // Typography
    if (ds.typography) {
      lines.push('## Typography');
      lines.push('');
      if (ds.typography.pairingName) {
        lines.push(`**Pairing:** ${ds.typography.pairingName}`);
      }
      lines.push(`**Heading Font:** ${ds.typography.headingFont}`);
      lines.push(`**Body Font:** ${ds.typography.bodyFont}`);
      if (ds.typography.googleFontsUrl) {
        lines.push(`**Google Fonts URL:** ${ds.typography.googleFontsUrl}`);
      }
      if (ds.typography.cssImport) {
        lines.push(`**CSS Import:** \`${ds.typography.cssImport}\``);
      }
      lines.push('');
    }

    // Style
    if (ds.style) {
      lines.push('## Style');
      lines.push('');
      lines.push(`**Name:** ${ds.style.name}`);
      if (ds.style.keywords) {
        lines.push(`**Keywords:** ${ds.style.keywords}`);
      }
      if (ds.style.primaryColors) {
        lines.push(`**Primary Colors:** ${ds.style.primaryColors}`);
      }
      if (ds.style.effects) {
        lines.push(`**Effects:** ${ds.style.effects}`);
      }
      if (ds.style.cssKeywords) {
        lines.push(`**CSS Keywords:** ${ds.style.cssKeywords}`);
      }
      if (ds.style.checklist) {
        lines.push('');
        lines.push('**Implementation Checklist:**');
        const items = ds.style.checklist
          .split(/[,;\n]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        for (const item of items) {
          lines.push(`- [ ] ${item}`);
        }
      }
      lines.push('');
    }

    // Layout
    if (ds.layout) {
      lines.push('## Layout');
      lines.push('');
      lines.push(`**Pattern:** ${ds.layout.pattern}`);
      if (ds.layout.sections) {
        lines.push(`**Sections:** ${ds.layout.sections}`);
      }
      if (ds.layout.ctaPlacement) {
        lines.push(`**CTA Placement:** ${ds.layout.ctaPlacement}`);
      }
      if (ds.layout.colorStrategy) {
        lines.push(`**Color Strategy:** ${ds.layout.colorStrategy}`);
      }
      if (ds.layout.effects) {
        lines.push(`**Effects:** ${ds.layout.effects}`);
      }
      if (ds.layout.conversionTips) {
        lines.push(`**Conversion Tips:** ${ds.layout.conversionTips}`);
      }
      lines.push('');
    }

    // Dashboard
    if (ds.dashboardLayout) {
      lines.push('## Dashboard Layout');
      lines.push('');
      lines.push(ds.dashboardLayout);
      lines.push('');
    }

    // Anti-Patterns
    if (ds.antiPatterns.length > 0) {
      lines.push('## Anti-Patterns');
      lines.push('');
      for (const pattern of ds.antiPatterns) {
        lines.push(`- ${pattern}`);
      }
      lines.push('');
    }

    // Decision Rules
    if (Object.keys(ds.decisionRules).length > 0) {
      lines.push('## Decision Rules');
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(ds.decisionRules, null, 2));
      lines.push('```');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format page override markdown
   */
  formatPageOverride(
    ds: DesignSystem,
    pageName: string,
    pageQuery: string
  ): string {
    const lines: string[] = [];

    lines.push(`# ${pageName} - Page Override`);
    lines.push('');
    lines.push(`**Query:** ${pageQuery}`);
    lines.push(`**Base Design System:** ${ds.projectName}`);
    lines.push('');
    lines.push('## Page-Specific Overrides');
    lines.push('');
    lines.push('Add page-specific CSS variable overrides here:');
    lines.push('');
    lines.push('```css');
    lines.push(`.page-${this.slugify(pageName)} {`);
    lines.push('  /* Override variables as needed */');
    lines.push('  /* Example: --color-primary: #ff6600; */');
    lines.push('}');
    lines.push('```');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Persist design system to filesystem
   */
  persist(ds: DesignSystem, projectName: string, page?: string): string {
    if (!this.validateProjectName(projectName)) {
      throw new Error(`Invalid project name: ${projectName}`);
    }

    if (page && !this.validateProjectName(page)) {
      throw new Error(`Invalid page name: ${page}`);
    }

    const baseDir = join(
      process.cwd(),
      '.claude',
      'vibe',
      'design-system',
      projectName
    );

    if (!existsSync(baseDir)) {
      mkdirSync(baseDir, { recursive: true });
    }

    let outputPath: string;
    let content: string;

    if (page) {
      const pagesDir = join(baseDir, 'pages');
      if (!existsSync(pagesDir)) {
        mkdirSync(pagesDir, { recursive: true });
      }
      outputPath = join(pagesDir, `${page}.md`);
      content = this.formatPageOverride(ds, page, '');
    } else {
      outputPath = join(baseDir, 'MASTER.md');
      content = this.formatMarkdown(ds);
    }

    writeFileSync(outputPath, content, 'utf-8');

    return outputPath;
  }

  // ─── Private Helpers ─────────────────────────────────────────────

  /**
   * Map CSV row to DesignSystemStyle (styles.csv columns)
   */
  private mapToStyle(row: Record<string, string>): DesignSystemStyle {
    return {
      name: row['Style Category'] ?? 'Modern',
      keywords: row['Keywords'] ?? '',
      primaryColors: row['Primary Colors'] ?? '',
      effects: row['Effects & Animation'] ?? '',
      cssKeywords: row['CSS/Technical Keywords'] ?? '',
      variables: row['Design System Variables'] ?? '',
      checklist: row['Implementation Checklist'] ?? '',
    };
  }

  /**
   * Map CSV row to DesignSystemColorPalette (colors.csv columns)
   */
  private mapToColorPalette(
    row: Record<string, string>
  ): DesignSystemColorPalette {
    return {
      primary: row['Primary (Hex)'] ?? DEFAULT_COLOR_PRIMARY,
      secondary: row['Secondary (Hex)'] ?? DEFAULT_COLOR_SECONDARY,
      cta: row['CTA (Hex)'] ?? DEFAULT_COLOR_CTA,
      background: row['Background (Hex)'] ?? DEFAULT_COLOR_BACKGROUND,
      text: row['Text (Hex)'] ?? DEFAULT_COLOR_TEXT,
      border: row['Border (Hex)'] ?? DEFAULT_COLOR_BORDER,
      notes: row['Notes'] ?? '',
    };
  }

  /**
   * Map CSV row to DesignSystemTypography (typography.csv columns)
   */
  private mapToTypography(
    row: Record<string, string>
  ): DesignSystemTypography {
    return {
      pairingName: row['Font Pairing Name'] ?? '',
      headingFont: row['Heading Font'] ?? 'Inter',
      bodyFont: row['Body Font'] ?? 'Inter',
      googleFontsUrl: row['Google Fonts URL'] ?? '',
      cssImport: row['CSS Import'] ?? '',
    };
  }

  /**
   * Map CSV row to DesignSystemLayout (landing.csv columns)
   */
  private mapToLayout(row: Record<string, string>): DesignSystemLayout {
    return {
      pattern: row['Pattern Name'] ?? '',
      sections: row['Section Order'] ?? '',
      ctaPlacement: row['Primary CTA Placement'] ?? '',
      colorStrategy: row['Color Strategy'] ?? '',
      effects: row['Recommended Effects'] ?? '',
      conversionTips: row['Conversion Optimization'] ?? '',
    };
  }

  /**
   * Build CSS variables from design system components
   */
  private buildCssVariables(
    color: DesignSystemColorPalette | null,
    typo: DesignSystemTypography | null,
    style: DesignSystemStyle | null
  ): Record<string, string> {
    const vars: Record<string, string> = {};

    if (color) {
      vars['--color-primary'] = this.validateHexColor(
        color.primary,
        DEFAULT_COLOR_PRIMARY
      );
      vars['--color-secondary'] = this.validateHexColor(
        color.secondary,
        DEFAULT_COLOR_SECONDARY
      );
      vars['--color-cta'] = this.validateHexColor(
        color.cta,
        DEFAULT_COLOR_CTA
      );
      vars['--color-background'] = this.validateHexColor(
        color.background,
        DEFAULT_COLOR_BACKGROUND
      );
      vars['--color-text'] = this.validateHexColor(
        color.text,
        DEFAULT_COLOR_TEXT
      );
      vars['--color-border'] = this.validateHexColor(
        color.border,
        DEFAULT_COLOR_BORDER
      );
    } else {
      vars['--color-primary'] = DEFAULT_COLOR_PRIMARY;
      vars['--color-secondary'] = DEFAULT_COLOR_SECONDARY;
      vars['--color-cta'] = DEFAULT_COLOR_CTA;
      vars['--color-background'] = DEFAULT_COLOR_BACKGROUND;
      vars['--color-text'] = DEFAULT_COLOR_TEXT;
      vars['--color-border'] = DEFAULT_COLOR_BORDER;
    }

    if (typo) {
      vars['--font-heading'] = this.escapeCssValue(typo.headingFont);
      vars['--font-body'] = this.escapeCssValue(typo.bodyFont);
    } else {
      vars['--font-heading'] = 'Inter';
      vars['--font-body'] = 'Inter';
    }

    // Parse additional variables from CSV 'Design System Variables' column
    if (style?.variables) {
      this.parseDesignSystemVariables(style.variables, vars);
    }

    return vars;
  }

  /**
   * Parse design system variables string from CSV
   * Format: "--var-name: value, --var-name2: value2" or semicolon/newline separated
   */
  private parseDesignSystemVariables(
    raw: string,
    vars: Record<string, string>
  ): void {
    const parts = raw
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const part of parts) {
      const colonIdx = part.indexOf(':');
      if (colonIdx > 0) {
        const key = part.substring(0, colonIdx).trim();
        const value = part.substring(colonIdx + 1).trim();
        if (key.startsWith('--') && value) {
          vars[key] = this.escapeCssValue(value);
        }
      }
    }
  }

  /**
   * Validate hex color, return fallback if invalid
   */
  private validateHexColor(hex: string, fallback: string): string {
    if (!HEX_COLOR_REGEX.test(hex)) {
      return fallback;
    }
    return hex;
  }

  /**
   * Escape CSS value to prevent injection
   */
  private escapeCssValue(value: string): string {
    return value.replace(/[;{}()<>]/g, '').trim();
  }

  /**
   * Validate project/page name
   */
  private validateProjectName(name: string): boolean {
    if (!PROJECT_NAME_REGEX.test(name)) {
      return false;
    }
    return !WINDOWS_RESERVED_NAMES.has(name.toLowerCase());
  }

  /**
   * Parse delimited string (+ or , separated) to array
   */
  private parseDelimited(value: string | undefined): string[] {
    if (!value) {
      return [];
    }
    return value
      .split(/[+,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /**
   * Parse decision rules from JSON string
   */
  private parseDecisionRules(value: string | undefined): DecisionRules {
    if (!value) {
      return {};
    }

    try {
      const parsed = JSON.parse(value) as unknown;
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as DecisionRules;
      }
      return {};
    } catch {
      return {};
    }
  }

  /**
   * Get default reasoning when no match found
   */
  private getDefaultReasoning(): {
    stylePriority: string[];
    colorMood: string;
    typographyMood: string;
    decisionRules: DecisionRules;
    antiPatterns: string[];
    severity: string;
  } {
    return {
      stylePriority: ['Modern'],
      colorMood: 'neutral',
      typographyMood: 'modern',
      decisionRules: {},
      antiPatterns: [],
      severity: 'medium',
    };
  }

  /**
   * Check if row has exact match with query
   */
  private hasExactMatch(
    row: Record<string, string>,
    query: string
  ): boolean {
    const lowerQuery = query.toLowerCase();
    return Object.values(row).some(
      (val) => typeof val === 'string' && val.toLowerCase() === lowerQuery
    );
  }

  /**
   * Check if row has keyword match with any priority
   */
  private hasKeywordMatch(
    row: Record<string, string>,
    priority: string[]
  ): boolean {
    const lowerPriority = priority.map((p) => p.toLowerCase());
    return Object.values(row).some((val) => {
      if (typeof val !== 'string') return false;
      const lowerVal = val.toLowerCase();
      return lowerPriority.some((p) => lowerVal.includes(p));
    });
  }

  /**
   * Slugify string for CSS class names
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
