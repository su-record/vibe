/**
 * Skill Frontmatter System
 * YAML metadata for declarative skill configuration
 */
export interface SkillSectionMeta {
    name: string;
    triggers?: string[];
}
export type SkillTier = 'core' | 'standard' | 'optional';
export interface SkillMetadata {
    name: string;
    description: string;
    tier?: SkillTier;
    model?: 'haiku' | 'sonnet' | 'opus';
    agent?: string;
    argumentHint?: string;
    userInvocable?: boolean;
    subtask?: boolean;
    allowedTools?: string[];
    triggers?: string[];
    priority?: number;
    chainNext?: string[];
    mcpConfig?: McpConfig;
    sections?: SkillSectionMeta[];
}
export interface McpConfig {
    servers?: string[];
    tools?: string[];
}
export interface ParsedSkill {
    metadata: SkillMetadata;
    template: string;
    raw: string;
}
/**
 * Parse YAML frontmatter from skill file
 */
export declare function parseSkillFrontmatter(content: string): ParsedSkill | null;
/**
 * Generate skill frontmatter
 */
export declare function generateSkillFrontmatter(metadata: SkillMetadata): string;
/**
 * Create full skill file content
 */
export declare function createSkillFile(metadata: SkillMetadata, template: string): string;
/**
 * Validate skill metadata
 */
export declare function validateSkillMetadata(metadata: Partial<SkillMetadata>): {
    valid: boolean;
    errors: string[];
};
/**
 * Merge skill metadata with defaults
 */
export declare function mergeWithDefaults(metadata: Partial<SkillMetadata>): SkillMetadata;
/**
 * Extract triggers from skill template
 */
export declare function extractTriggersFromTemplate(template: string): string[];
/**
 * Substitute template variables
 */
export declare function substituteTemplateVars(template: string, vars: Record<string, string>): string;
/**
 * Example skill template
 */
export declare const SKILL_TEMPLATE_EXAMPLE = "---\nname: example-skill\ndescription: \"An example skill demonstrating the frontmatter system\"\nmodel: sonnet\nagent: implementer\nargument-hint: \"task description\"\nuser-invocable: true\ntriggers: [example, demo, test]\npriority: 50\n---\n\n# Example Skill\n\nThis skill demonstrates the frontmatter metadata system.\n\n## Arguments\n\n$ARGUMENTS\n\n## Process\n\n1. Parse the arguments\n2. Execute the task\n3. Return the result\n\n## Output\n\nProvide a clear summary of what was done.\n";
//# sourceMappingURL=SkillFrontmatter.d.ts.map