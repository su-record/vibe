/**
 * kimi_analyze Tool - 코드/문서 분석
 * Phase 3: Function Calling Tool Definitions
 *
 * AZ Kimi K2.5 coreAzOrchestrate() 활용
 */

import { z } from 'zod';
import type { ToolRegistrationInput } from '../ToolRegistry.js';

const ANALYSIS_TYPES = ['code-review', 'architecture', 'security', 'general'] as const;

const SYSTEM_PROMPTS: Record<typeof ANALYSIS_TYPES[number], string> = {
  'code-review': 'You are an expert code reviewer. Analyze the following code for bugs, best practices, and improvements. Be specific and actionable.',
  'architecture': 'You are a software architect. Analyze the following for architectural patterns, SOLID principles, coupling/cohesion, and scalability concerns.',
  'security': 'You are a security expert. Analyze the following for OWASP Top 10 vulnerabilities, injection risks, authentication issues, and data exposure.',
  'general': 'You are an AI analyst. Analyze the following content and provide insights, key points, and recommendations.',
};

export const kimiAnalyzeSchema = z.object({
  content: z.string().describe('Content to analyze (code, document, etc.)'),
  analysisType: z.enum(ANALYSIS_TYPES).describe('Type of analysis to perform'),
});

async function handleKimiAnalyze(args: Record<string, unknown>): Promise<string> {
  const { content, analysisType } = args as z.infer<typeof kimiAnalyzeSchema>;

  try {
    const { coreAzOrchestrate } = await import('../../lib/az/orchestration.js');
    const systemPrompt = SYSTEM_PROMPTS[analysisType];
    const result = await coreAzOrchestrate(content, systemPrompt, {
      maxTokens: 4096,
      jsonMode: false,
    });
    return result || '(no analysis result)';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Analysis failed: ${msg}`;
  }
}

export const kimiAnalyzeTool: ToolRegistrationInput = {
  name: 'kimi_analyze',
  description: 'Analyze code or documents using Kimi K2.5 (supports: code-review, architecture, security, general)',
  schema: kimiAnalyzeSchema,
  handler: handleKimiAnalyze,
  scope: 'read',
};
