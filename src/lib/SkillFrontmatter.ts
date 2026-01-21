/**
 * Skill Frontmatter System
 * YAML metadata for declarative skill configuration
 */

export interface SkillMetadata {
  name: string;
  description: string;
  model?: 'haiku' | 'sonnet' | 'opus';
  agent?: string;
  argumentHint?: string;
  userInvocable?: boolean;
  subtask?: boolean;
  allowedTools?: string[];
  triggers?: string[];
  priority?: number;
  mcpConfig?: McpConfig;
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
export function parseSkillFrontmatter(content: string): ParsedSkill | null {
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
    metadata: metadata as SkillMetadata,
    template,
    raw: content,
  };
}

/**
 * Simple YAML parser for frontmatter
 */
function parseSimpleYaml(yaml: string): Partial<SkillMetadata> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIndex = trimmed.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    let value: unknown = trimmed.slice(colonIndex + 1).trim();

    // Handle different value types
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (/^\d+$/.test(value as string)) value = parseInt(value as string, 10);
    else if ((value as string).startsWith('[') && (value as string).endsWith(']')) {
      // Parse simple array
      value = (value as string)
        .slice(1, -1)
        .split(',')
        .map(v => v.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else if ((value as string).startsWith('"') || (value as string).startsWith("'")) {
      // Remove quotes
      value = (value as string).slice(1, -1);
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
export function generateSkillFrontmatter(metadata: SkillMetadata): string {
  const lines = ['---'];

  lines.push(`name: ${metadata.name}`);
  lines.push(`description: "${metadata.description}"`);

  if (metadata.model) {
    lines.push(`model: ${metadata.model}`);
  }

  if (metadata.agent) {
    lines.push(`agent: ${metadata.agent}`);
  }

  if (metadata.argumentHint) {
    lines.push(`argument-hint: "${metadata.argumentHint}"`);
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

  lines.push('---');

  return lines.join('\n');
}

/**
 * Create full skill file content
 */
export function createSkillFile(metadata: SkillMetadata, template: string): string {
  const frontmatter = generateSkillFrontmatter(metadata);
  return `${frontmatter}\n\n${template}`;
}

/**
 * Validate skill metadata
 */
export function validateSkillMetadata(metadata: Partial<SkillMetadata>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!metadata.name) {
    errors.push('Missing required field: name');
  }

  if (!metadata.description) {
    errors.push('Missing required field: description');
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
export function mergeWithDefaults(metadata: Partial<SkillMetadata>): SkillMetadata {
  return {
    name: metadata.name || 'unnamed-skill',
    description: metadata.description || 'No description',
    model: metadata.model,
    agent: metadata.agent,
    argumentHint: metadata.argumentHint,
    userInvocable: metadata.userInvocable ?? true,
    subtask: metadata.subtask ?? false,
    allowedTools: metadata.allowedTools,
    triggers: metadata.triggers,
    priority: metadata.priority ?? 50,
    mcpConfig: metadata.mcpConfig,
  };
}

/**
 * Extract triggers from skill template
 */
export function extractTriggersFromTemplate(template: string): string[] {
  const triggers: string[] = [];

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
export function substituteTemplateVars(
  template: string,
  vars: Record<string, string>
): string {
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
