/**
 * ToolRegistry - Tool 등록/조회/변환/검증
 * Phase 1: Head Model Selection & Tool Registry
 *
 * Zod v4 기반 타입 안전 Tool 스키마 → JSON Schema 자동 생성
 * Provider-agnostic: OpenAI/Anthropic 양쪽 형식 변환 지원
 */

import { z } from 'zod';
import type {
  AgentToolDefinition,
  AnthropicTool,
  JsonSchema,
  OpenAITool,
  RegisteredTool,
  ToolScope,
} from './types.js';

// === Zod → JSON Schema (Zod v4 native) ===

function zodToJsonSchema(schema: z.ZodType): JsonSchema {
  const raw = z.toJSONSchema(schema) as Record<string, unknown>;
  return cleanJsonSchema(raw);
}

function cleanJsonSchema(raw: Record<string, unknown>): JsonSchema {
  const result: JsonSchema = {};

  if (typeof raw.type === 'string') result.type = raw.type;
  if (typeof raw.description === 'string') result.description = raw.description;
  if (Array.isArray(raw.enum)) result.enum = raw.enum;
  if (raw.default !== undefined) result.default = raw.default;
  if (raw.const !== undefined) result.const = raw.const;
  if (typeof raw.minimum === 'number') result.minimum = raw.minimum;
  if (typeof raw.maximum === 'number') result.maximum = raw.maximum;
  if (typeof raw.minLength === 'number') result.minLength = raw.minLength;
  if (typeof raw.maxLength === 'number') result.maxLength = raw.maxLength;

  if (isRecord(raw.properties)) {
    result.properties = {};
    for (const [key, value] of Object.entries(raw.properties)) {
      if (isRecord(value)) {
        result.properties[key] = cleanJsonSchema(value);
      }
    }
  }

  if (Array.isArray(raw.required)) {
    result.required = raw.required.filter((r): r is string => typeof r === 'string');
  }

  if (isRecord(raw.items)) {
    result.items = cleanJsonSchema(raw.items);
  }

  if (Array.isArray(raw.oneOf)) {
    result.oneOf = raw.oneOf
      .filter((item): item is Record<string, unknown> => isRecord(item))
      .map(cleanJsonSchema);
  }

  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// === Tool Registration Input ===

export interface ToolRegistrationInput {
  name: string;
  description: string;
  schema: z.ZodType;
  handler: (args: Record<string, unknown>) => Promise<string>;
  scope: ToolScope;
}

// === ToolRegistry Class ===

export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  register(input: ToolRegistrationInput): void {
    if (this.tools.has(input.name)) {
      throw new Error(`Tool '${input.name}' is already registered`);
    }
    this.tools.set(input.name, {
      name: input.name,
      description: input.description,
      schema: input.schema,
      handler: input.handler,
      scope: input.scope,
    });
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  list(): AgentToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.schema),
      scope: tool.scope,
    }));
  }

  toOpenAIFormat(): OpenAITool[] {
    return Array.from(this.tools.values()).map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: zodToJsonSchema(tool.schema),
      },
    }));
  }

  toAnthropicFormat(): AnthropicTool[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: zodToJsonSchema(tool.schema),
    }));
  }

  validate(
    name: string,
    args: Record<string, unknown>,
  ): { success: true; data: Record<string, unknown> } | { success: false; error: string } {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Tool '${name}' not found` };
    }

    const result = tool.schema.safeParse(args);
    if (!result.success) {
      const issues = result.error?.issues;
      const msg = issues?.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') || 'Validation failed';
      return { success: false, error: msg };
    }
    return { success: true, data: result.data as Record<string, unknown> };
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  get size(): number {
    return this.tools.size;
  }

  names(): string[] {
    return Array.from(this.tools.keys());
  }
}

export { zodToJsonSchema };
