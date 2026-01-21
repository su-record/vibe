/**
 * Intelligent Model Router
 * 작업 복잡도를 자동 분석하여 최적의 모델을 선택
 */

export type ModelTier = 'haiku' | 'sonnet' | 'opus';

export interface ComplexitySignals {
  fileCount: number;
  lineCount: number;
  hasArchitectureChange: boolean;
  hasSecurityImplication: boolean;
  hasMultipleServices: boolean;
  isRefactoring: boolean;
  isNewFeature: boolean;
  isBugFix: boolean;
  isDocumentation: boolean;
  keywords: string[];
}

export interface RoutingResult {
  model: ModelTier;
  score: number;
  reason: string;
  signals: Partial<ComplexitySignals>;
}

// 복잡도 키워드 매핑
const COMPLEXITY_KEYWORDS: Record<string, number> = {
  // High complexity (opus)
  'architect': 15,
  'refactor': 12,
  'migrate': 12,
  'security': 12,
  'authentication': 10,
  'authorization': 10,
  'infrastructure': 10,
  'database schema': 10,
  'breaking change': 10,
  'performance optimization': 8,
  'distributed': 8,
  'concurrent': 8,
  'transaction': 8,

  // Medium complexity (sonnet)
  'implement': 5,
  'feature': 5,
  'integration': 5,
  'api': 4,
  'component': 4,
  'service': 4,
  'module': 4,
  'test': 3,
  'validation': 3,

  // Low complexity (haiku)
  'fix': 2,
  'bug': 2,
  'typo': 1,
  'rename': 1,
  'comment': 1,
  'documentation': 1,
  'style': 1,
  'format': 1,
  'lint': 1,
};

// 모델 티어 임계값
const TIER_THRESHOLDS = {
  opus: 20,   // score >= 20 → opus
  sonnet: 8,  // score >= 8 → sonnet
  haiku: 0,   // score < 8 → haiku
};

/**
 * 텍스트에서 복잡도 신호 추출
 */
export function extractComplexitySignals(text: string): ComplexitySignals {
  const lowerText = text.toLowerCase();
  const keywords: string[] = [];

  // 키워드 매칭
  for (const keyword of Object.keys(COMPLEXITY_KEYWORDS)) {
    if (lowerText.includes(keyword)) {
      keywords.push(keyword);
    }
  }

  // 파일 수 추정 (패턴 매칭)
  const filePatterns = text.match(/\.(ts|js|py|go|rs|java|tsx|jsx|vue|svelte|css|scss|html|md)\b/gi) || [];
  const uniqueExtensions = new Set(filePatterns.map(p => p.toLowerCase()));

  // 라인 수 추정 (코드 블록)
  const codeBlocks = text.match(/```[\s\S]*?```/g) || [];
  const estimatedLines = codeBlocks.reduce((sum, block) => sum + block.split('\n').length, 0);

  return {
    fileCount: Math.max(uniqueExtensions.size, 1),
    lineCount: estimatedLines,
    hasArchitectureChange: /architect|infrastructure|system design|database schema/i.test(text),
    hasSecurityImplication: /security|auth|password|token|credential|encrypt|vulnerability/i.test(text),
    hasMultipleServices: /micro.?service|distributed|multiple.*service|cross.*service/i.test(text),
    isRefactoring: /refactor|restructure|reorganize|extract|split|merge/i.test(text),
    isNewFeature: /new feature|implement|create|add.*feature/i.test(text),
    isBugFix: /bug|fix|patch|hotfix|issue|error/i.test(text),
    isDocumentation: /document|readme|comment|jsdoc|explain/i.test(text),
    keywords,
  };
}

/**
 * 복잡도 점수 계산
 */
export function calculateComplexityScore(signals: ComplexitySignals): number {
  let score = 0;

  // 키워드 기반 점수
  for (const keyword of signals.keywords) {
    score += COMPLEXITY_KEYWORDS[keyword] || 0;
  }

  // 파일 수 기반 점수
  if (signals.fileCount >= 10) score += 15;
  else if (signals.fileCount >= 5) score += 8;
  else if (signals.fileCount >= 3) score += 4;

  // 라인 수 기반 점수
  if (signals.lineCount >= 500) score += 10;
  else if (signals.lineCount >= 200) score += 5;
  else if (signals.lineCount >= 50) score += 2;

  // 특수 상황 가중치
  if (signals.hasArchitectureChange) score += 10;
  if (signals.hasSecurityImplication) score += 8;
  if (signals.hasMultipleServices) score += 8;
  if (signals.isRefactoring) score += 5;

  // 단순 작업 감점
  if (signals.isBugFix && !signals.hasSecurityImplication) score -= 3;
  if (signals.isDocumentation) score -= 5;

  return Math.max(0, score);
}

/**
 * 최적 모델 선택
 */
export function selectModel(score: number): ModelTier {
  if (score >= TIER_THRESHOLDS.opus) return 'opus';
  if (score >= TIER_THRESHOLDS.sonnet) return 'sonnet';
  return 'haiku';
}

/**
 * 메인 라우팅 함수
 */
export function routeToModel(taskDescription: string): RoutingResult {
  const signals = extractComplexitySignals(taskDescription);
  const score = calculateComplexityScore(signals);
  const model = selectModel(score);

  // 선택 이유 생성
  let reason = '';
  if (model === 'opus') {
    reason = `High complexity task (score: ${score}). `;
    if (signals.hasArchitectureChange) reason += 'Architecture change detected. ';
    if (signals.hasSecurityImplication) reason += 'Security implications. ';
    if (signals.hasMultipleServices) reason += 'Multi-service coordination. ';
  } else if (model === 'sonnet') {
    reason = `Medium complexity task (score: ${score}). `;
    if (signals.isNewFeature) reason += 'New feature implementation. ';
    if (signals.fileCount >= 3) reason += `Multiple files (${signals.fileCount}). `;
  } else {
    reason = `Simple task (score: ${score}). `;
    if (signals.isBugFix) reason += 'Bug fix. ';
    if (signals.isDocumentation) reason += 'Documentation. ';
  }

  return {
    model,
    score,
    reason: reason.trim(),
    signals,
  };
}

/**
 * SPEC 파일 기반 라우팅
 */
export function routeFromSpec(specContent: string): RoutingResult {
  // SPEC에서 Phase 수 추출
  const phaseMatches = specContent.match(/###\s*Phase\s*\d+/gi) || [];
  const phaseCount = phaseMatches.length;

  // SPEC에서 파일 목록 추출
  const fileMatches = specContent.match(/`[^`]+\.(ts|js|py|go|rs|java|tsx|jsx|vue|svelte|css|scss|html|md)`/gi) || [];
  const fileCount = new Set(fileMatches).size;

  // 기본 신호 추출
  const signals = extractComplexitySignals(specContent);
  signals.fileCount = Math.max(signals.fileCount, fileCount);

  // Phase 수에 따른 추가 점수
  let score = calculateComplexityScore(signals);
  if (phaseCount >= 5) score += 15;
  else if (phaseCount >= 3) score += 8;
  else if (phaseCount >= 2) score += 4;

  const model = selectModel(score);

  let reason = `SPEC analysis: ${phaseCount} phases, ~${fileCount} files. `;
  reason += model === 'opus' ? 'Large scope → Opus recommended.' :
            model === 'sonnet' ? 'Medium scope → Sonnet.' :
            'Small scope → Haiku sufficient.';

  return {
    model,
    score,
    reason,
    signals,
  };
}

/**
 * 에이전트 티어 선택 (agent-low, agent-medium, agent 패턴)
 */
export function selectAgentTier(baseAgentName: string, taskDescription: string): string {
  const { model } = routeToModel(taskDescription);

  switch (model) {
    case 'haiku':
      return `${baseAgentName}-low`;
    case 'sonnet':
      return `${baseAgentName}-medium`;
    case 'opus':
      return baseAgentName; // 기본 = 최고 티어
    default:
      return baseAgentName;
  }
}
