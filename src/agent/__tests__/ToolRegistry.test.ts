/**
 * ToolRegistry 테스트
 * Phase 1: Scenarios 4, 5, 6, 7
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ToolRegistry } from '../ToolRegistry.js';

describe('ToolRegistry', () => {
  function createRegistry(): ToolRegistry {
    return new ToolRegistry();
  }

  function registerGoogleSearch(registry: ToolRegistry): void {
    registry.register({
      name: 'google_search',
      description: 'Search the web',
      schema: z.object({
        query: z.string().describe('Search query'),
        maxResults: z.number().optional().describe('Max results'),
      }),
      handler: async () => 'search results',
      scope: 'read',
    });
  }

  // Scenario 4: Tool 등록 및 조회
  describe('Scenario 4: Register and retrieve tool', () => {
    it('should register a tool and retrieve by name', () => {
      const registry = createRegistry();
      registerGoogleSearch(registry);

      const tool = registry.get('google_search');
      expect(tool).toBeDefined();
      expect(tool!.name).toBe('google_search');
      expect(tool!.description).toBe('Search the web');
      expect(tool!.scope).toBe('read');
    });

    it('should include tool in list()', () => {
      const registry = createRegistry();
      registerGoogleSearch(registry);

      const tools = registry.list();
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('google_search');
      expect(tools[0].parameters.type).toBe('object');
    });

    it('should reject duplicate registration', () => {
      const registry = createRegistry();
      registerGoogleSearch(registry);

      expect(() => registerGoogleSearch(registry)).toThrow(
        "Tool 'google_search' is already registered",
      );
    });

    it('should return undefined for unknown tool', () => {
      const registry = createRegistry();
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });

  // Scenario 5: Zod → OpenAI JSON Schema 변환
  describe('Scenario 5: Zod to OpenAI format', () => {
    it('should convert to OpenAI function calling format', () => {
      const registry = createRegistry();
      registerGoogleSearch(registry);

      const tools = registry.toOpenAIFormat();
      expect(tools).toHaveLength(1);

      const tool = tools[0];
      expect(tool.type).toBe('function');
      expect(tool.function.name).toBe('google_search');
      expect(tool.function.description).toBe('Search the web');
      expect(tool.function.parameters.type).toBe('object');
      expect(tool.function.parameters.properties).toBeDefined();
      expect(tool.function.parameters.properties!.query).toBeDefined();
      expect(tool.function.parameters.properties!.query.type).toBe('string');
    });

    it('should mark required fields correctly', () => {
      const registry = createRegistry();
      registerGoogleSearch(registry);

      const tools = registry.toOpenAIFormat();
      const params = tools[0].function.parameters;

      expect(params.required).toContain('query');
      expect(params.required).not.toContain('maxResults');
    });
  });

  // Scenario 6: Zod → Anthropic input_schema 변환
  describe('Scenario 6: Zod to Anthropic format', () => {
    it('should convert to Anthropic tool use format', () => {
      const registry = createRegistry();
      registerGoogleSearch(registry);

      const tools = registry.toAnthropicFormat();
      expect(tools).toHaveLength(1);

      const tool = tools[0];
      expect(tool.name).toBe('google_search');
      expect(tool.description).toBe('Search the web');
      expect(tool.input_schema.type).toBe('object');
      expect(tool.input_schema.properties).toBeDefined();
    });
  });

  // Scenario 7: Tool argument 런타임 검증
  describe('Scenario 7: Runtime argument validation', () => {
    it('should reject invalid arguments', () => {
      const registry = createRegistry();
      registerGoogleSearch(registry);

      const result = registry.validate('google_search', { query: 123 as unknown as string });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeTruthy();
      }
    });

    it('should accept valid arguments', () => {
      const registry = createRegistry();
      registerGoogleSearch(registry);

      const result = registry.validate('google_search', { query: 'test' });
      expect(result.success).toBe(true);
    });

    it('should accept optional fields', () => {
      const registry = createRegistry();
      registerGoogleSearch(registry);

      const result = registry.validate('google_search', {
        query: 'test',
        maxResults: 5,
      });
      expect(result.success).toBe(true);
    });

    it('should return error for nonexistent tool', () => {
      const registry = createRegistry();
      const result = registry.validate('nonexistent', {});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain('not found');
      }
    });
  });

  // Utility methods
  describe('Utility methods', () => {
    it('has() returns correct boolean', () => {
      const registry = createRegistry();
      expect(registry.has('google_search')).toBe(false);
      registerGoogleSearch(registry);
      expect(registry.has('google_search')).toBe(true);
    });

    it('size returns tool count', () => {
      const registry = createRegistry();
      expect(registry.size).toBe(0);
      registerGoogleSearch(registry);
      expect(registry.size).toBe(1);
    });

    it('names() returns tool names', () => {
      const registry = createRegistry();
      registerGoogleSearch(registry);
      expect(registry.names()).toEqual(['google_search']);
    });
  });

  // Enum schema
  describe('Enum schema support', () => {
    it('should handle enum types in JSON Schema', () => {
      const registry = createRegistry();
      registry.register({
        name: 'kimi_analyze',
        description: 'Analyze code',
        schema: z.object({
          content: z.string(),
          analysisType: z.enum(['code-review', 'architecture', 'security', 'general']),
        }),
        handler: async () => 'analysis',
        scope: 'read',
      });

      const tools = registry.toOpenAIFormat();
      const params = tools[0].function.parameters;
      expect(params.properties!.analysisType.enum).toEqual([
        'code-review',
        'architecture',
        'security',
        'general',
      ]);
    });
  });
});
