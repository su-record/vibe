/**
 * Multi-LLM Race Review
 *
 * 같은 리뷰 작업을 Claude + GPT + Gemini가 병렬로 수행하고
 * 교차 검증하여 신뢰도 기반 우선순위를 부여합니다.
 *
 * @example
 * ```typescript
 * import { raceReview, formatRaceResult } from '@su-record/vibe/lib/ReviewRace';
 *
 * const result = await raceReview({
 *   reviewType: 'security',
 *   code: diffContent,
 *   context: 'Authentication module changes',
 * });
 *
 * console.log(formatRaceResult(result));
 * ```
 */

import * as gptApi from './gpt-api.js';
import * as geminiApi from './gemini-api.js';

// ============================================================================
// Types
// ============================================================================

export type LLMProvider = 'claude' | 'gpt' | 'gemini';
export type Priority = 'P1' | 'P2' | 'P3';
export type ReviewType =
  | 'security'
  | 'performance'
  | 'architecture'
  | 'complexity'
  | 'data-integrity'
  | 'test-coverage'
  | 'general';

export interface ReviewIssue {
  id: string;
  title: string;
  description: string;
  location?: string;  // file:line
  severity: 'critical' | 'high' | 'medium' | 'low';
  suggestion?: string;
}

export interface LLMReviewResult {
  provider: LLMProvider;
  issues: ReviewIssue[];
  duration: number;  // ms
  error?: string;
}

export interface CrossValidatedIssue {
  issue: ReviewIssue;
  foundBy: LLMProvider[];
  confidence: number;  // 0-1 (foundBy.length / totalProviders)
  priority: Priority;
  consensusTitle: string;  // 가장 상세한 제목 선택
}

export interface RaceReviewResult {
  reviewType: ReviewType;
  llmResults: LLMReviewResult[];
  crossValidated: CrossValidatedIssue[];
  summary: {
    totalIssues: number;
    p1Count: number;
    p2Count: number;
    p3Count: number;
    consensusRate: number;  // P1+P2 비율
  };
  duration: number;  // 총 소요 시간
}

export interface RaceReviewOptions {
  reviewType: ReviewType;
  code: string;
  context?: string;
  includeClaudeSubagent?: boolean;  // Claude Code 서브에이전트 포함 여부
}

// ============================================================================
// Constants
// ============================================================================

const REVIEW_PROMPTS: Record<ReviewType, string> = {
  security: `You are a security expert reviewing code changes.
Identify security vulnerabilities including:
- SQL injection, XSS, CSRF
- Authentication/authorization flaws
- Sensitive data exposure
- Insecure dependencies
- OWASP Top 10 issues

For each issue found, respond in this exact JSON format:
{
  "issues": [
    {
      "id": "SEC-001",
      "title": "Brief title",
      "description": "Detailed description",
      "location": "file.ts:42",
      "severity": "critical|high|medium|low",
      "suggestion": "How to fix"
    }
  ]
}

If no issues found, respond: {"issues": []}`,

  performance: `You are a performance expert reviewing code changes.
Identify performance issues including:
- N+1 queries
- Memory leaks
- Unnecessary re-renders
- Blocking operations
- Large bundle size impacts
- Missing caching opportunities

Respond in JSON format:
{
  "issues": [
    {
      "id": "PERF-001",
      "title": "Brief title",
      "description": "Detailed description",
      "location": "file.ts:42",
      "severity": "critical|high|medium|low",
      "suggestion": "How to fix"
    }
  ]
}`,

  architecture: `You are an architecture expert reviewing code changes.
Identify architecture issues including:
- Circular dependencies
- Layer violations (e.g., UI calling DB directly)
- Missing abstractions
- Tight coupling
- Single Responsibility violations
- DRY violations

Respond in JSON format with issues array.`,

  complexity: `You are a code quality expert reviewing complexity.
Identify complexity issues including:
- Functions > 30 lines
- Nesting depth > 3 levels
- Cyclomatic complexity > 10
- Too many parameters (> 5)
- Long files (> 300 lines)

Respond in JSON format with issues array.`,

  'data-integrity': `You are a data integrity expert reviewing code changes.
Identify data integrity issues including:
- Missing validations
- Race conditions
- Inconsistent state handling
- Missing error handling
- Data loss scenarios

Respond in JSON format with issues array.`,

  'test-coverage': `You are a testing expert reviewing code changes.
Identify missing test coverage including:
- Untested edge cases
- Missing error case tests
- Missing integration tests
- Untested business logic

Respond in JSON format with issues array.`,

  general: `You are a senior code reviewer.
Review this code for any issues including security, performance, maintainability, and best practices.

Respond in JSON format with issues array.`,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 이슈 ID에서 숫자 추출
 */
function extractIssueNumber(id: string): number {
  const match = id.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

/**
 * 두 이슈가 유사한지 판단 (제목/설명 기반)
 */
function areIssuesSimilar(a: ReviewIssue, b: ReviewIssue): boolean {
  // 1. 위치가 같으면 유사
  if (a.location && b.location && a.location === b.location) {
    return true;
  }

  // 2. 제목 유사도 (Jaccard similarity)
  const aWords = new Set(a.title.toLowerCase().split(/\s+/));
  const bWords = new Set(b.title.toLowerCase().split(/\s+/));
  const intersection = new Set([...aWords].filter(x => bWords.has(x)));
  const union = new Set([...aWords, ...bWords]);
  const similarity = intersection.size / union.size;

  if (similarity > 0.5) return true;

  // 3. 설명에서 키워드 매칭
  const aDesc = a.description.toLowerCase();
  const bDesc = b.description.toLowerCase();

  // 공통 보안 키워드
  const keywords = ['injection', 'xss', 'csrf', 'auth', 'leak', 'overflow', 'validation', 'null', 'undefined'];
  const aKeywords = keywords.filter(k => aDesc.includes(k));
  const bKeywords = keywords.filter(k => bDesc.includes(k));

  if (aKeywords.length > 0 && bKeywords.length > 0) {
    const commonKeywords = aKeywords.filter(k => bKeywords.includes(k));
    if (commonKeywords.length > 0) return true;
  }

  return false;
}

/**
 * JSON 파싱 (LLM 응답에서)
 */
function parseIssuesFromResponse(response: string): ReviewIssue[] {
  try {
    // JSON 블록 추출
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as { issues?: ReviewIssue[] };
    return parsed.issues || [];
  } catch {
    // JSON 파싱 실패 시 빈 배열
    return [];
  }
}

/**
 * 신뢰도에서 우선순위 계산
 */
function calculatePriority(confidence: number, severity: string): Priority {
  // 3/3 동의 (100%) + critical/high → P1
  // 2/3 동의 (67%) 또는 medium → P2
  // 1/3 동의 (33%) 또는 low → P3

  if (confidence >= 0.9 && (severity === 'critical' || severity === 'high')) {
    return 'P1';
  }
  if (confidence >= 0.6 || severity === 'medium') {
    return 'P2';
  }
  return 'P3';
}

/**
 * 가장 상세한 제목 선택
 */
function selectBestTitle(issues: ReviewIssue[]): string {
  return issues.reduce((best, issue) =>
    issue.title.length > best.length ? issue.title : best
  , issues[0]?.title || 'Unknown Issue');
}

/**
 * 가장 상세한 설명 선택
 */
function selectBestDescription(issues: ReviewIssue[]): string {
  return issues.reduce((best, issue) =>
    issue.description.length > best.length ? issue.description : best
  , issues[0]?.description || '');
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * GPT로 리뷰 수행
 */
async function reviewWithGPT(
  reviewType: ReviewType,
  code: string,
  context?: string
): Promise<LLMReviewResult> {
  const startTime = Date.now();

  try {
    const prompt = `${REVIEW_PROMPTS[reviewType]}

Context: ${context || 'Code review'}

Code to review:
\`\`\`
${code}
\`\`\`

Respond with JSON only.`;

    const response = await gptApi.ask(prompt, {
      model: 'gpt-5.2-codex',
      temperature: 0.3,
    });

    const issues = parseIssuesFromResponse(response);

    return {
      provider: 'gpt',
      issues,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      provider: 'gpt',
      issues: [],
      duration: Date.now() - startTime,
      error: (error as Error).message,
    };
  }
}

/**
 * Gemini로 리뷰 수행
 */
async function reviewWithGemini(
  reviewType: ReviewType,
  code: string,
  context?: string
): Promise<LLMReviewResult> {
  const startTime = Date.now();

  try {
    const prompt = `${REVIEW_PROMPTS[reviewType]}

Context: ${context || 'Code review'}

Code to review:
\`\`\`
${code}
\`\`\`

Respond with JSON only.`;

    const response = await geminiApi.ask(prompt, {
      model: 'gemini-3-flash',
      temperature: 0.3,
    });

    const issues = parseIssuesFromResponse(response);

    return {
      provider: 'gemini',
      issues,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      provider: 'gemini',
      issues: [],
      duration: Date.now() - startTime,
      error: (error as Error).message,
    };
  }
}

/**
 * 이슈 교차 검증 (클러스터링)
 */
function crossValidateIssues(
  llmResults: LLMReviewResult[]
): CrossValidatedIssue[] {
  const validResults = llmResults.filter(r => !r.error);
  const totalProviders = validResults.length;

  if (totalProviders === 0) return [];

  // 모든 이슈를 플랫하게 펼침
  const allIssues: Array<{ issue: ReviewIssue; provider: LLMProvider }> = [];
  for (const result of validResults) {
    for (const issue of result.issues) {
      allIssues.push({ issue, provider: result.provider });
    }
  }

  // 클러스터링 (유사한 이슈 그룹화)
  const clusters: Array<Array<{ issue: ReviewIssue; provider: LLMProvider }>> = [];
  const used = new Set<number>();

  for (let i = 0; i < allIssues.length; i++) {
    if (used.has(i)) continue;

    const cluster = [allIssues[i]];
    used.add(i);

    for (let j = i + 1; j < allIssues.length; j++) {
      if (used.has(j)) continue;

      // 같은 provider의 이슈는 클러스터에 추가하지 않음
      if (allIssues[j].provider === allIssues[i].provider) continue;

      if (areIssuesSimilar(allIssues[i].issue, allIssues[j].issue)) {
        cluster.push(allIssues[j]);
        used.add(j);
      }
    }

    clusters.push(cluster);
  }

  // 클러스터를 CrossValidatedIssue로 변환
  const crossValidated: CrossValidatedIssue[] = clusters.map(cluster => {
    const issues = cluster.map(c => c.issue);
    const foundBy = [...new Set(cluster.map(c => c.provider))];
    const confidence = foundBy.length / totalProviders;

    // 가장 높은 severity 선택
    const severityOrder = ['critical', 'high', 'medium', 'low'];
    const highestSeverity = issues.reduce((highest, issue) => {
      const currentIndex = severityOrder.indexOf(issue.severity);
      const highestIndex = severityOrder.indexOf(highest);
      return currentIndex < highestIndex ? issue.severity : highest;
    }, 'low' as ReviewIssue['severity']);

    const priority = calculatePriority(confidence, highestSeverity);

    return {
      issue: {
        id: issues[0].id,
        title: selectBestTitle(issues),
        description: selectBestDescription(issues),
        location: issues.find(i => i.location)?.location,
        severity: highestSeverity,
        suggestion: issues.find(i => i.suggestion)?.suggestion,
      },
      foundBy,
      confidence,
      priority,
      consensusTitle: selectBestTitle(issues),
    };
  });

  // 우선순위 순으로 정렬 (P1 > P2 > P3, 같은 우선순위 내에서는 confidence 높은 순)
  return crossValidated.sort((a, b) => {
    const priorityOrder = { P1: 0, P2: 1, P3: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.confidence - a.confidence;
  });
}

// ============================================================================
// Main Export
// ============================================================================

/**
 * Multi-LLM Race Review 수행
 *
 * GPT + Gemini를 병렬로 실행하고 결과를 교차 검증합니다.
 * Claude는 현재 세션에서 실행 중이므로 별도의 서브에이전트로 호출됩니다.
 */
export async function raceReview(options: RaceReviewOptions): Promise<RaceReviewResult> {
  const { reviewType, code, context } = options;
  const startTime = Date.now();

  // GPT + Gemini 병렬 실행
  const [gptResult, geminiResult] = await Promise.all([
    reviewWithGPT(reviewType, code, context),
    reviewWithGemini(reviewType, code, context),
  ]);

  const llmResults = [gptResult, geminiResult];

  // 교차 검증
  const crossValidated = crossValidateIssues(llmResults);

  // 요약 생성
  const p1Count = crossValidated.filter(i => i.priority === 'P1').length;
  const p2Count = crossValidated.filter(i => i.priority === 'P2').length;
  const p3Count = crossValidated.filter(i => i.priority === 'P3').length;

  return {
    reviewType,
    llmResults,
    crossValidated,
    summary: {
      totalIssues: crossValidated.length,
      p1Count,
      p2Count,
      p3Count,
      consensusRate: crossValidated.length > 0
        ? (p1Count + p2Count) / crossValidated.length
        : 1,
    },
    duration: Date.now() - startTime,
  };
}

/**
 * Race Review 결과를 마크다운으로 포맷
 */
export function formatRaceResult(result: RaceReviewResult): string {
  const lines: string[] = [];

  lines.push(`## ${result.reviewType.toUpperCase()} Review (Race Mode)`);
  lines.push('');
  lines.push(`**Duration**: ${result.duration}ms`);
  lines.push(`**Models**: GPT-5.2-Codex, Gemini-3-Flash`);
  lines.push('');

  // LLM별 결과 요약
  lines.push('### Model Results');
  lines.push('');
  lines.push('| Model | Issues Found | Duration | Status |');
  lines.push('|-------|--------------|----------|--------|');
  for (const llm of result.llmResults) {
    const status = llm.error ? `Error: ${llm.error}` : 'OK';
    lines.push(`| ${llm.provider} | ${llm.issues.length} | ${llm.duration}ms | ${status} |`);
  }
  lines.push('');

  // 교차 검증 결과
  lines.push('### Cross-Validated Issues');
  lines.push('');
  lines.push(`**Summary**: ${result.summary.totalIssues} issues (P1: ${result.summary.p1Count}, P2: ${result.summary.p2Count}, P3: ${result.summary.p3Count})`);
  lines.push(`**Consensus Rate**: ${(result.summary.consensusRate * 100).toFixed(0)}%`);
  lines.push('');

  if (result.crossValidated.length === 0) {
    lines.push('No issues found.');
  } else {
    for (const item of result.crossValidated) {
      const priorityEmoji = item.priority === 'P1' ? '🔴' : item.priority === 'P2' ? '🟡' : '🔵';
      const confidencePct = (item.confidence * 100).toFixed(0);

      lines.push(`#### ${priorityEmoji} ${item.priority} - ${item.consensusTitle}`);
      lines.push('');
      lines.push(`- **Confidence**: ${confidencePct}% (${item.foundBy.join(', ')})`);
      lines.push(`- **Severity**: ${item.issue.severity}`);
      if (item.issue.location) {
        lines.push(`- **Location**: \`${item.issue.location}\``);
      }
      lines.push(`- **Description**: ${item.issue.description}`);
      if (item.issue.suggestion) {
        lines.push(`- **Suggestion**: ${item.issue.suggestion}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * LLM 가용성 확인
 */
export async function checkLLMAvailability(): Promise<{
  gpt: boolean;
  gemini: boolean;
}> {
  const results = await Promise.allSettled([
    gptApi.ask('ping', { maxTokens: 10 }),
    geminiApi.ask('ping', { maxTokens: 10 }),
  ]);

  return {
    gpt: results[0].status === 'fulfilled',
    gemini: results[1].status === 'fulfilled',
  };
}

// Export types
export type {
  ReviewIssue as RaceReviewIssue,
  LLMReviewResult as RaceLLMResult,
  CrossValidatedIssue as RaceCrossValidatedIssue,
};
