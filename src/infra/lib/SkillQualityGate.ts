/**
 * Skill Quality Gate
 * 저장할 메모리/스킬의 품질을 검증
 */

export interface QualityCheckResult {
  isValid: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
  category: 'principle' | 'discovery' | 'decision' | 'code' | 'generic';
}

// 거부할 패턴 (너무 일반적이거나 쉽게 검색 가능한 정보)
const REJECT_PATTERNS = [
  // 일반적인 정보
  /^(how to|what is|definition of)/i,
  /^(npm install|pip install|cargo add)/i,
  /^(import|from .* import|require\()/i,

  // 단순 명령어
  /^(git (add|commit|push|pull|merge|checkout))/i,
  /^(docker (run|build|pull|push))/i,
  /^(kubectl (get|apply|delete))/i,

  // 너무 짧은 내용
  /^.{0,20}$/,

  // 일반적인 best practice (검색 가능)
  /^(always use|never use|prefer|avoid)/i,
  /^(use (async|await|promises))/i,
  /^(handle (errors?|exceptions?))/i,
];

// 가치 있는 패턴 (원칙, 발견, 결정)
const VALUE_PATTERNS = [
  // 프로젝트 특정 결정
  { pattern: /we (decided|chose|agreed|concluded)/i, category: 'decision' as const, score: 20 },
  { pattern: /after (debugging|investigating|researching)/i, category: 'discovery' as const, score: 25 },
  { pattern: /the root cause (is|was)/i, category: 'discovery' as const, score: 30 },

  // 원칙/휴리스틱
  { pattern: /when .* then .* because/i, category: 'principle' as const, score: 25 },
  { pattern: /if .* fails?, (check|try|verify)/i, category: 'principle' as const, score: 20 },
  { pattern: /the trick (is|was) to/i, category: 'discovery' as const, score: 25 },

  // 구체적인 파일/라인 참조
  { pattern: /in (file|path|line) [`"]?[\w/.:-]+[`"]?/i, category: 'code' as const, score: 15 },
  { pattern: /at line \d+/i, category: 'code' as const, score: 10 },
  { pattern: /error: .{20,}/i, category: 'discovery' as const, score: 15 },

  // 아키텍처/설계 결정
  { pattern: /architecture|design pattern|trade-?off/i, category: 'decision' as const, score: 20 },
  { pattern: /because (performance|security|maintainability)/i, category: 'decision' as const, score: 20 },
];

// 필수 요소 체크
const REQUIRED_ELEMENTS = [
  { name: 'context', pattern: /\b(when|if|because|since|after)\b/i, weight: 10 },
  { name: 'specificity', pattern: /\b(this|our|my|the)\s+(project|codebase|repo|app)/i, weight: 15 },
  { name: 'actionable', pattern: /\b(should|must|need to|have to|try|use|avoid)\b/i, weight: 10 },
];

/**
 * 메모리/스킬 품질 검증
 */
export function validateSkillQuality(
  key: string,
  value: string,
  category?: string
): QualityCheckResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 50; // 기본 점수
  let detectedCategory: QualityCheckResult['category'] = 'generic';

  // 1. 거부 패턴 체크
  for (const pattern of REJECT_PATTERNS) {
    if (pattern.test(value)) {
      issues.push(`Too generic or easily searchable: matches pattern ${pattern}`);
      score -= 30;
    }
  }

  // 2. 최소 길이 체크
  if (value.length < 50) {
    issues.push('Content too short (min 50 chars)');
    score -= 20;
    suggestions.push('Add more context: why, when, what was the situation?');
  }

  // 3. 가치 패턴 체크
  for (const { pattern, category: cat, score: bonus } of VALUE_PATTERNS) {
    if (pattern.test(value)) {
      score += bonus;
      detectedCategory = cat;
    }
  }

  // 4. 필수 요소 체크
  let hasRequiredElements = 0;
  for (const { name, pattern, weight } of REQUIRED_ELEMENTS) {
    if (pattern.test(value)) {
      score += weight;
      hasRequiredElements++;
    } else {
      suggestions.push(`Consider adding ${name} (${pattern.source})`);
    }
  }

  if (hasRequiredElements < 2) {
    issues.push('Missing essential elements (context, specificity, or actionability)');
    score -= 15;
  }

  // 5. 구체적인 참조 체크 (파일 경로, 라인 번호, 에러 메시지)
  const hasFilePath = /[`"]?[\w/.-]+\.(ts|js|py|go|rs|java|tsx|jsx)[`"]?/i.test(value);
  const hasLineNumber = /line\s*\d+|:\d+:/i.test(value);
  const hasErrorMessage = /error:|exception:|failed:/i.test(value);

  if (hasFilePath) score += 10;
  if (hasLineNumber) score += 10;
  if (hasErrorMessage) score += 10;

  if (!hasFilePath && !hasLineNumber && !hasErrorMessage) {
    suggestions.push('Add specific references: file paths, line numbers, or error messages');
  }

  // 6. 원칙 형태 체크 ("when X, do Y because Z")
  const isPrincipleForm = /when.*,.*because|if.*then.*because/i.test(value);
  if (isPrincipleForm) {
    score += 20;
    detectedCategory = 'principle';
  } else {
    suggestions.push('Consider reformulating as a principle: "When [situation], [action] because [reason]"');
  }

  // 7. 키 품질 체크
  if (key.length < 5) {
    issues.push('Key too short');
    score -= 10;
  }
  if (!/^[a-z0-9-]+$/i.test(key.replace(/\s+/g, '-'))) {
    suggestions.push('Use kebab-case for key (e.g., "auth-token-refresh-strategy")');
  }

  // 점수 정규화 (0-100)
  score = Math.max(0, Math.min(100, score));

  // 임계값: 60점 이상이면 통과
  const isValid = score >= 60 && issues.length === 0;

  return {
    isValid,
    score,
    issues,
    suggestions,
    category: detectedCategory,
  };
}

/**
 * 원칙 형태로 변환 도우미
 */
export function suggestPrincipleFormat(value: string): string {
  // 이미 원칙 형태면 그대로 반환
  if (/when.*because|if.*then.*because/i.test(value)) {
    return value;
  }

  // 변환 템플릿 제안
  return `Consider reformulating as:

"When [describe the situation/trigger],
[describe the action to take]
because [explain the reasoning/tradeoff]"

Example:
"When the auth token expires during a request,
retry the request after refreshing the token (not before)
because refreshing preemptively causes race conditions with concurrent requests"`;
}

/**
 * 스킬 분류
 */
export function classifySkill(value: string): {
  type: 'principle' | 'discovery' | 'decision' | 'reference' | 'generic';
  confidence: number;
} {
  const scores = {
    principle: 0,
    discovery: 0,
    decision: 0,
    reference: 0,
    generic: 20, // 기본
  };

  // 원칙
  if (/when.*then|if.*should|always.*because|never.*because/i.test(value)) {
    scores.principle += 30;
  }

  // 발견
  if (/found|discovered|realized|root cause|after debugging/i.test(value)) {
    scores.discovery += 30;
  }

  // 결정
  if (/decided|chose|agreed|will use|architecture|design/i.test(value)) {
    scores.decision += 30;
  }

  // 참조 (파일/코드 중심)
  if (/\.(ts|js|py|go)\b.*:\d+|file:|path:/i.test(value)) {
    scores.reference += 30;
  }

  // 최고 점수 타입 선택
  const entries = Object.entries(scores) as [keyof typeof scores, number][];
  entries.sort((a, b) => b[1] - a[1]);

  const [type, score] = entries[0];
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = Math.round((score / total) * 100);

  return { type, confidence };
}

/**
 * 저장 전 검증 래퍼
 */
export function validateBeforeSave(
  key: string,
  value: string,
  options?: { bypassValidation?: boolean; minScore?: number }
): { canSave: boolean; result: QualityCheckResult; formattedFeedback: string } {
  if (options?.bypassValidation) {
    return {
      canSave: true,
      result: { isValid: true, score: 100, issues: [], suggestions: [], category: 'generic' },
      formattedFeedback: '⚠️ Validation bypassed',
    };
  }

  const result = validateSkillQuality(key, value);
  const minScore = options?.minScore ?? 60;

  const canSave = result.score >= minScore && result.issues.length === 0;

  let feedback = '';
  if (canSave) {
    feedback = `✅ Quality check passed (score: ${result.score}/100, category: ${result.category})`;
  } else {
    feedback = `❌ Quality check failed (score: ${result.score}/100)\n`;
    if (result.issues.length > 0) {
      feedback += `\nIssues:\n${result.issues.map(i => `  - ${i}`).join('\n')}`;
    }
    if (result.suggestions.length > 0) {
      feedback += `\n\nSuggestions:\n${result.suggestions.map(s => `  - ${s}`).join('\n')}`;
    }
    feedback += `\n\n${suggestPrincipleFormat(value)}`;
  }

  return { canSave, result, formattedFeedback: feedback };
}
