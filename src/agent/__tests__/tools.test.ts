/**
 * Tool Definitions 테스트
 * Phase 3: Scenarios 5, 8, 9, 10
 */

import { describe, it, expect, vi } from 'vitest';
import { getAllTools } from '../tools/index.js';
import { isPrivateIP, validateUrl } from '../tools/web-browse.js';
import { bindSendTelegram, unbindSendTelegram, runInChatContext } from '../tools/send-telegram.js';
import type { ToolDefinition, OpenAITool, AnthropicTool, JsonSchema } from '../types.js';
import Ajv from 'ajv';

// Helper functions for validation and conversion
function validateToolArgs(tool: ToolDefinition, args: Record<string, unknown>): { success: boolean; error?: string } {
  const ajv = new Ajv();
  const validate = ajv.compile(tool.parameters);
  const valid = validate(args);
  return valid ? { success: true } : { success: false, error: ajv.errorsText(validate.errors) };
}

function toOpenAIFormat(tools: ToolDefinition[]): OpenAITool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

function toAnthropicFormat(tools: ToolDefinition[]): AnthropicTool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

describe('Phase 3: Tool Definitions', () => {
  // Scenario 5: web_browse SSRF 방지
  describe('Scenario 5: SSRF Protection', () => {
    it('should detect private IPv4 addresses', () => {
      expect(isPrivateIP('10.0.0.1')).toBe(true);
      expect(isPrivateIP('172.16.0.1')).toBe(true);
      expect(isPrivateIP('172.31.255.255')).toBe(true);
      expect(isPrivateIP('192.168.1.1')).toBe(true);
      expect(isPrivateIP('127.0.0.1')).toBe(true);
      expect(isPrivateIP('169.254.169.254')).toBe(true);
      expect(isPrivateIP('0.0.0.0')).toBe(true);
    });

    it('should allow public IPv4 addresses', () => {
      expect(isPrivateIP('8.8.8.8')).toBe(false);
      expect(isPrivateIP('1.1.1.1')).toBe(false);
      expect(isPrivateIP('172.32.0.1')).toBe(false);
    });

    it('should detect private IPv6 addresses', () => {
      expect(isPrivateIP('::1')).toBe(true);
      expect(isPrivateIP('fc00::1')).toBe(true);
      expect(isPrivateIP('fd12::1')).toBe(true);
      expect(isPrivateIP('fe80::1')).toBe(true);
    });

    it('should block non-http schemes', () => {
      expect(() => validateUrl('ftp://example.com')).toThrow('Blocked scheme');
      expect(() => validateUrl('file:///etc/passwd')).toThrow('Blocked scheme');
    });

    it('should block non-standard ports', () => {
      expect(() => validateUrl('http://example.com:8080')).toThrow('Blocked port');
      expect(() => validateUrl('https://example.com:9443')).toThrow('Blocked port');
    });

    it('should allow standard ports', () => {
      expect(() => validateUrl('http://example.com')).not.toThrow();
      expect(() => validateUrl('https://example.com')).not.toThrow();
      expect(() => validateUrl('http://example.com:80')).not.toThrow();
      expect(() => validateUrl('https://example.com:443')).not.toThrow();
    });
  });

  // Scenario 8: Tool argument validation
  describe('Scenario 8: Tool argument validation', () => {
    it('should reject invalid google_search arguments', () => {
      const tools = getAllTools();
      const googleSearchTool = tools.find((t) => t.name === 'google_search')!;

      const result = validateToolArgs(googleSearchTool, { query: 123 as unknown });
      expect(result.success).toBe(false);
    });

    it('should accept valid google_search arguments', () => {
      const tools = getAllTools();
      const googleSearchTool = tools.find((t) => t.name === 'google_search')!;

      const result = validateToolArgs(googleSearchTool, { query: 'test' });
      expect(result.success).toBe(true);
    });

    it('should validate kimi_analyze analysis types', () => {
      const tools = getAllTools();
      const kimiAnalyzeTool = tools.find((t) => t.name === 'kimi_analyze')!;

      const valid = validateToolArgs(kimiAnalyzeTool, {
        content: 'code here',
        analysisType: 'security',
      });
      expect(valid.success).toBe(true);

      const invalid = validateToolArgs(kimiAnalyzeTool, {
        content: 'code here',
        analysisType: 'invalid-type',
      });
      expect(invalid.success).toBe(false);
    });
  });

  // Scenario 10: 전체 Tool 일괄 등록
  describe('Scenario 10: Register all tools', () => {
    it('should have all 12 tools', () => {
      const tools = getAllTools();

      expect(tools.length).toBe(12);

      const expectedTools = [
        'claude_code',
        'gemini_stt',
        'google_search',
        'kimi_analyze',
        'web_browse',
        'send_telegram',
        'save_memory',
        'recall_memory',
        'vision_capture',
        'vision_analyze',
        'send_slack',
        'dm_pair',
      ];

      const toolNames = tools.map((t) => t.name);
      for (const name of expectedTools) {
        expect(toolNames).toContain(name);
      }
    });

    it('should have correct scopes', () => {
      const tools = getAllTools();
      const toolMap = new Map(tools.map((t) => [t.name, t]));

      expect(toolMap.get('google_search')?.scope).toBe('read');
      expect(toolMap.get('recall_memory')?.scope).toBe('read');
      expect(toolMap.get('kimi_analyze')?.scope).toBe('read');
      expect(toolMap.get('web_browse')?.scope).toBe('read');
      expect(toolMap.get('save_memory')?.scope).toBe('write');
      expect(toolMap.get('send_telegram')?.scope).toBe('write');
      expect(toolMap.get('claude_code')?.scope).toBe('execute');
      expect(toolMap.get('gemini_stt')?.scope).toBe('execute');
    });

    it('should generate valid OpenAI format for all tools', () => {
      const tools = getAllTools();
      const openAITools = toOpenAIFormat(tools);
      expect(openAITools).toHaveLength(12);

      for (const tool of openAITools) {
        expect(tool.type).toBe('function');
        expect(tool.function.name).toBeTruthy();
        expect(tool.function.description).toBeTruthy();
        expect(tool.function.parameters.type).toBe('object');
      }
    });

    it('should generate valid Anthropic format for all tools', () => {
      const tools = getAllTools();
      const anthropicTools = toAnthropicFormat(tools);
      expect(anthropicTools).toHaveLength(12);

      for (const tool of anthropicTools) {
        expect(tool.name).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.input_schema.type).toBe('object');
      }
    });
  });

  // send_telegram binding test
  describe('send_telegram binding', () => {
    it('should fail when not bound', async () => {
      unbindSendTelegram('nonexistent');
      const tools = getAllTools();
      const sendTelegramTool = tools.find((t) => t.name === 'send_telegram')!;

      const result = await sendTelegramTool.handler({ text: 'test' });
      expect(result).toContain('not bound');
    });

    it('should succeed when bound', async () => {
      const mockSend = vi.fn().mockResolvedValue(undefined);
      bindSendTelegram('chat-123', mockSend);

      const tools = getAllTools();
      const sendTelegramTool = tools.find((t) => t.name === 'send_telegram')!;

      // AsyncLocalStorage 컨텍스트 내에서 실행해야 chatId 접근 가능
      const result = await runInChatContext('chat-123', () => sendTelegramTool.handler({ text: 'hello' }));
      expect(result).toContain('Message sent');
      expect(mockSend).toHaveBeenCalledWith('chat-123', 'hello', { format: 'text' });

      unbindSendTelegram('chat-123');
    });
  });
});
