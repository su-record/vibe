import type { DesignSystem, DesignSystemColorPalette, DesignSystemTypography, DesignSystemStyle, DesignSystemLayout, DecisionRules } from './types.js';
import { SearchService } from './SearchService.js';
export declare class DesignSystemGenerator {
    private searchService;
    constructor(searchService?: SearchService);
    /**
     * Full 5-stage pipeline to generate design system
     */
    generate(query: string, projectName: string): DesignSystem;
    /**
     * Stage 1: Detect product category from query
     */
    detectCategory(query: string): {
        category: string;
        dashboardLayout: string | null;
    };
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
    };
    /**
     * Stage 3: Multi-domain search (style, color, typography, landing)
     */
    multiDomainSearch(query: string, stylePriority: string[]): {
        style: DesignSystemStyle | null;
        colorPalette: DesignSystemColorPalette | null;
        typography: DesignSystemTypography | null;
        layout: DesignSystemLayout | null;
    };
    /**
     * Stage 4: Select best match using priority scoring
     */
    private selectBestMatch;
    /**
     * Stage 5: Build unified DesignSystem object
     */
    private buildDesignSystem;
    /**
     * Format DesignSystem to MASTER.md markdown
     */
    formatMarkdown(ds: DesignSystem): string;
    /**
     * Format page override markdown
     */
    formatPageOverride(ds: DesignSystem, pageName: string, pageQuery: string): string;
    /**
     * Persist design system to filesystem
     */
    persist(ds: DesignSystem, projectName: string, page?: string): string;
    /**
     * Map CSV row to DesignSystemStyle (styles.csv columns)
     */
    private mapToStyle;
    /**
     * Map CSV row to DesignSystemColorPalette (colors.csv columns)
     */
    private mapToColorPalette;
    /**
     * Map CSV row to DesignSystemTypography (typography.csv columns)
     */
    private mapToTypography;
    /**
     * Map CSV row to DesignSystemLayout (landing.csv columns)
     */
    private mapToLayout;
    /**
     * Build CSS variables from design system components
     */
    private buildCssVariables;
    /**
     * Parse design system variables string from CSV
     * Format: "--var-name: value, --var-name2: value2" or semicolon/newline separated
     */
    private parseDesignSystemVariables;
    /**
     * Validate hex color, return fallback if invalid
     */
    private validateHexColor;
    /**
     * Escape CSS value to prevent injection
     */
    private escapeCssValue;
    /**
     * Validate project/page name
     */
    private validateProjectName;
    /**
     * Parse delimited string (+ or , separated) to array
     */
    private parseDelimited;
    /**
     * Parse decision rules from JSON string
     */
    private parseDecisionRules;
    /**
     * Get default reasoning when no match found
     */
    private getDefaultReasoning;
    /**
     * Check if row has exact match with query
     */
    private hasExactMatch;
    /**
     * Check if row has keyword match with any priority
     */
    private hasKeywordMatch;
    /**
     * Slugify string for CSS class names
     */
    private slugify;
}
//# sourceMappingURL=DesignSystemGenerator.d.ts.map