/**
 * DESIGN.md parser — Stitch 9-section format
 *
 * SSOT for /vibe.design lint + verify. Pure functions, no I/O.
 */
export declare const STITCH_SECTIONS: readonly ["Visual Theme", "Color Palette", "Typography", "Components", "Layout", "Depth", "Do's & Don'ts", "Responsive", "Agent Prompt Guide"];
export type StitchSection = typeof STITCH_SECTIONS[number];
export interface DesignMdSection {
    index: number;
    title: StitchSection;
    body: string;
}
export interface HardcodedHex {
    file: string;
    line: number;
    hex: string;
}
export declare function parseSections(content: string): DesignMdSection[];
export declare function lintMissingSections(content: string): StitchSection[];
export declare function extractHexTokens(designMd: string): string[];
export declare function findHardcodedColors(files: ReadonlyArray<{
    path: string;
    content: string;
}>, allowedTokens: ReadonlyArray<string>): HardcodedHex[];
//# sourceMappingURL=design-md-parser.d.ts.map