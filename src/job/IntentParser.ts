/**
 * IntentParser - Natural Language → Structured Intent
 * Phase 2: Job/Order System
 *
 * Heuristic-based parsing (< 500ms)
 * LLM-based parsing available via external integration
 */

import { ParsedIntent, IntentType } from './types.js';

/** Keyword patterns for intent classification */
const INTENT_PATTERNS: { type: IntentType; patterns: RegExp[] }[] = [
  {
    type: 'fix',
    patterns: [
      /\bfix\b/i, /\bbug\b/i, /\berror\b/i, /\bcrash\b/i,
      /\b수정\b/, /\b버그\b/, /\b에러\b/, /\b오류\b/, /\b고치/,
    ],
  },
  {
    type: 'test',
    patterns: [
      /\btest\b/i, /\bspec\b/i, /\bunit test\b/i, /\be2e\b/i,
      /\b테스트\b/, /\b검증\b/,
    ],
  },
  {
    type: 'review',
    patterns: [
      /\breview\b/i, /\bcheck\b/i, /\baudit\b/i, /\binspect\b/i,
      /\b리뷰\b/, /\b검토\b/, /\b점검\b/,
    ],
  },
  {
    type: 'analyze',
    patterns: [
      /\banalyze?\b/i, /\bexplore\b/i, /\binvestigat/i, /\bunderstand\b/i,
      /\b분석\b/, /\b탐색\b/, /\b조사\b/,
    ],
  },
  {
    type: 'refactor',
    patterns: [
      /\brefactor\b/i, /\bclean ?up\b/i, /\brestructure\b/i, /\boptimize\b/i,
      /\b리팩[토터]링?\b/, /\b최적화\b/, /\b정리\b/,
    ],
  },
  {
    type: 'deploy',
    patterns: [
      /\bdeploy\b/i, /\brelease\b/i, /\bpublish\b/i, /\bship\b/i,
      /\b배포\b/, /\b릴리스\b/,
    ],
  },
  {
    type: 'docs',
    patterns: [
      /\bdocument/i, /\breadme\b/i, /\bcomment\b/i, /\bjsdoc\b/i,
      /\b문서\b/, /\b주석\b/,
    ],
  },
  {
    type: 'code',
    patterns: [
      /\badd\b/i, /\bcreate\b/i, /\bimplement\b/i, /\bbuild\b/i,
      /\bwrite\b/i, /\bmake\b/i, /\bgenerate\b/i,
      /\b추가\b/, /\b생성\b/, /\b구현\b/, /\b만들/,
    ],
  },
];

/** File path extraction pattern */
const FILE_PATH_PATTERN = /(?:^|\s)((?:\.{0,2}\/)?(?:[\w.-]+\/)*[\w.-]+\.\w+)/g;

export class IntentParser {
  /** Parse natural language into structured intent */
  parse(text: string, projectPath: string): ParsedIntent {
    const type = this.classifyIntent(text);
    const targets = this.extractTargets(text);
    const confidence = this.calculateConfidence(text, type, targets);

    return {
      type,
      rawText: text,
      summary: this.summarize(text),
      projectPath,
      targets,
      confidence,
    };
  }

  /** Classify intent type from text */
  private classifyIntent(text: string): IntentType {
    let bestType: IntentType = 'general';
    let bestScore = 0;

    for (const { type, patterns } of INTENT_PATTERNS) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }

    return bestType;
  }

  /** Extract file/directory targets from text */
  private extractTargets(text: string): string[] {
    const targets: string[] = [];
    let match: RegExpExecArray | null;

    const pattern = new RegExp(FILE_PATH_PATTERN.source, 'g');
    while ((match = pattern.exec(text)) !== null) {
      const target = match[1].trim();
      if (target && !targets.includes(target)) {
        targets.push(target);
      }
    }

    return targets;
  }

  /** Calculate confidence score */
  private calculateConfidence(text: string, type: IntentType, targets: string[]): number {
    let confidence = 0.5;

    // Higher confidence if intent type was clearly classified
    if (type !== 'general') confidence += 0.2;

    // Higher confidence if file targets were found
    if (targets.length > 0) confidence += 0.15;

    // Higher confidence for longer, more detailed requests
    if (text.length > 50) confidence += 0.1;

    // Lower confidence for very short requests
    if (text.length < 10) confidence -= 0.2;

    return Math.max(0, Math.min(1, confidence));
  }

  /** Create a summary of the intent */
  private summarize(text: string): string {
    // Truncate to first sentence or 100 chars
    const firstSentence = text.split(/[.!?\n]/)[0].trim();
    if (firstSentence.length <= 100) return firstSentence;
    return firstSentence.slice(0, 97) + '...';
  }
}
