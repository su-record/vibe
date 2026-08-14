/**
 * CLI Commands: vibe figma <subcommand>
 *
 * Figma configuration management.
 * Extraction is handled by src/infra/lib/figma/ (Figma REST API direct).
 * Token stored in ~/.vibe/config.json is required for API access.
 */
/**
 * vibe figma setup <token>
 */
export declare function figmaSetup(token?: string): void;
/**
 * vibe figma status
 */
export declare function figmaStatus(): void;
/**
 * vibe figma logout
 */
export declare function figmaLogout(): void;
/**
 * vibe figma breakpoints [--set key=value]
 * Show or update responsive breakpoint defaults.
 */
export declare function figmaBreakpoints(setArg?: string): void;
/**
 * vibe figma help
 */
export declare function figmaHelp(): void;
//# sourceMappingURL=figma.d.ts.map