/**
 * Skill Frontmatter System
 * YAML metadata for declarative skill configuration
 */
/**
 * Parse YAML frontmatter from skill file
 */
export function parseSkillFrontmatter(content) {
    // Check for frontmatter delimiter
    if (!content.startsWith('---')) {
        return null;
    }
    // Find end of frontmatter
    const endIndex = content.indexOf('---', 3);
    if (endIndex === -1) {
        return null;
    }
    const frontmatter = content.slice(3, endIndex).trim();
    const template = content.slice(endIndex + 3).trim();
    // Parse YAML (simple implementation)
    const metadata = parseSimpleYaml(frontmatter);
    if (!metadata.name) {
        return null;
    }
    return {
        metadata: metadata,
        template,
        raw: content,
    };
}
/**
 * Simple YAML parser for frontmatter
 */
function parseSimpleYaml(yaml) {
    const result = {};
    const lines = yaml.split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#'))
            continue;
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex === -1)
            continue;
        const key = trimmed.slice(0, colonIndex).trim();
        let value = trimmed.slice(colonIndex + 1).trim();
        // Handle different value types
        if (value === 'true')
            value = true;
        else if (value === 'false')
            value = false;
        else if (/^\d+$/.test(value))
            value = parseInt(value, 10);
        else if (value.startsWith('[') && value.endsWith(']')) {
            // Parse simple array
            value = value
                .slice(1, -1)
                .split(',')
                .map(v => v.trim().replace(/^["']|["']$/g, ''))
                .filter(Boolean);
        }
        else if (value.startsWith('"') && value.endsWith('"')) {
            try {
                value = JSON.parse(value);
            }
            catch {
                value = value.slice(1, -1);
            }
        }
        else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.slice(1, -1).replace(/''/g, "'");
        }
        // Convert kebab-case to camelCase
        const camelKey = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        result[camelKey] = value;
    }
    return result;
}
/**
 * Generate skill frontmatter
 */
export function generateSkillFrontmatter(metadata) {
    const lines = ['---'];
    lines.push(`name: ${metadata.name}`);
    lines.push(`description: ${quoteYamlString(metadata.description)}`);
    if (metadata.tier) {
        lines.push(`tier: ${metadata.tier}`);
    }
    if (metadata.model) {
        lines.push(`model: ${metadata.model}`);
    }
    if (metadata.agent) {
        lines.push(`agent: ${metadata.agent}`);
    }
    if (metadata.argumentHint) {
        lines.push(`argument-hint: ${quoteYamlString(metadata.argumentHint)}`);
    }
    if (metadata.userInvocable !== undefined) {
        lines.push(`user-invocable: ${metadata.userInvocable}`);
    }
    if (metadata.subtask !== undefined) {
        lines.push(`subtask: ${metadata.subtask}`);
    }
    if (metadata.allowedTools && metadata.allowedTools.length > 0) {
        lines.push(`allowed-tools: [${metadata.allowedTools.join(', ')}]`);
    }
    if (metadata.triggers && metadata.triggers.length > 0) {
        lines.push(`triggers: [${metadata.triggers.join(', ')}]`);
    }
    if (metadata.priority !== undefined) {
        lines.push(`priority: ${metadata.priority}`);
    }
    if (metadata.chainNext !== undefined) {
        lines.push(`chain-next: [${metadata.chainNext.join(', ')}]`);
    }
    lines.push('---');
    return lines.join('\n');
}
function quoteYamlString(value) {
    return JSON.stringify(value);
}
/**
 * Create full skill file content
 */
export function createSkillFile(metadata, template) {
    const frontmatter = generateSkillFrontmatter(metadata);
    return `${frontmatter}\n\n${template}`;
}
/**
 * Validate skill metadata
 */
export function validateSkillMetadata(metadata) {
    const errors = [];
    if (!metadata.name) {
        errors.push('Missing required field: name');
    }
    if (!metadata.description) {
        errors.push('Missing required field: description');
    }
    if (metadata.tier && !['core', 'standard', 'optional'].includes(metadata.tier)) {
        errors.push(`Invalid tier: ${metadata.tier}. Must be core, standard, or optional`);
    }
    if (metadata.model && !['haiku', 'sonnet', 'opus'].includes(metadata.model)) {
        errors.push(`Invalid model: ${metadata.model}. Must be haiku, sonnet, or opus`);
    }
    if (metadata.priority !== undefined && (metadata.priority < 0 || metadata.priority > 100)) {
        errors.push('Priority must be between 0 and 100');
    }
    return {
        valid: errors.length === 0,
        errors,
    };
}
/**
 * Merge skill metadata with defaults
 */
export function mergeWithDefaults(metadata) {
    return {
        name: metadata.name || 'unnamed-skill',
        description: metadata.description || 'No description',
        tier: metadata.tier ?? 'standard',
        model: metadata.model,
        agent: metadata.agent,
        argumentHint: metadata.argumentHint,
        userInvocable: metadata.userInvocable ?? true,
        subtask: metadata.subtask ?? false,
        allowedTools: metadata.allowedTools,
        triggers: metadata.triggers,
        priority: metadata.priority ?? 50,
        chainNext: metadata.chainNext,
        mcpConfig: metadata.mcpConfig,
    };
}
/**
 * Extract triggers from skill template
 */
export function extractTriggersFromTemplate(template) {
    const triggers = [];
    // Look for keyword patterns in template
    const keywordPatterns = [
        /\bwhen\s+(\w+)/gi,
        /\bif\s+(\w+)/gi,
        /\b(\w+)\s+detected/gi,
        /trigger:\s*(\w+)/gi,
    ];
    for (const pattern of keywordPatterns) {
        let match;
        while ((match = pattern.exec(template)) !== null) {
            const keyword = match[1].toLowerCase();
            if (keyword.length > 2 && !triggers.includes(keyword)) {
                triggers.push(keyword);
            }
        }
    }
    return triggers;
}
/**
 * Substitute template variables
 */
export function substituteTemplateVars(template, vars) {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
        // Support both {{VAR}} and $VAR patterns
        result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        result = result.replace(new RegExp(`\\$${key}\\b`, 'g'), value);
    }
    return result;
}
/**
 * Example skill template
 */
export const SKILL_TEMPLATE_EXAMPLE = `---
name: example-skill
description: "An example skill demonstrating the frontmatter system"
model: sonnet
agent: implementer
argument-hint: "task description"
user-invocable: true
triggers: [example, demo, test]
priority: 50
---

# Example Skill

This skill demonstrates the frontmatter metadata system.

## Arguments

$ARGUMENTS

## Process

1. Parse the arguments
2. Execute the task
3. Return the result

## Output

Provide a clear summary of what was done.
`;
//# sourceMappingURL=SkillFrontmatter.js.map