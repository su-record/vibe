/**
 * InteractiveCheckpoint — Phase 전환 시 의사결정 게이트
 *
 * /vibe.run 워크플로우에서 주요 지점에 체크포인트를 삽입하여
 * 사용자가 방향을 확인/수정할 수 있도록 함
 */

export type CheckpointType =
  | 'requirements_confirm'
  | 'architecture_choice'
  | 'implementation_scope'
  | 'verification_result'
  | 'fix_strategy';

export interface CheckpointOption {
  /** Option key (e.g., 'a', 'b', 'c') */
  key: string;
  /** Option label */
  label: string;
  /** Detailed description */
  description: string;
}

export interface Checkpoint {
  /** Checkpoint type */
  type: CheckpointType;
  /** Title displayed to user */
  title: string;
  /** Context/summary shown to user */
  summary: string;
  /** Available options */
  options: CheckpointOption[];
  /** Default option key (if user doesn't choose) */
  defaultOption: string;
  /** Metadata */
  metadata: Record<string, unknown>;
}

export interface CheckpointResult {
  /** Which checkpoint was resolved */
  type: CheckpointType;
  /** Selected option key */
  selectedOption: string;
  /** Timestamp */
  timestamp: string;
  /** Whether this was auto-resolved (at high automation levels) */
  autoResolved: boolean;
}

export interface CheckpointHistory {
  feature: string;
  results: CheckpointResult[];
}

/** Create a requirements confirmation checkpoint */
export function createRequirementsCheckpoint(
  requirements: string[],
  featureName: string
): Checkpoint {
  const summary = [
    `Feature: ${featureName}`,
    '',
    'Requirements:',
    ...requirements.map((r, i) => `  ${i + 1}. ${r}`),
  ].join('\n');

  return {
    type: 'requirements_confirm',
    title: 'Requirements Confirmation',
    summary,
    options: [
      { key: 'a', label: 'Confirm', description: 'Proceed with these requirements as stated.' },
      { key: 'b', label: 'Revise', description: 'Modify or clarify requirements before proceeding.' },
      { key: 'c', label: 'Abort', description: 'Cancel this workflow.' },
    ],
    defaultOption: 'a',
    metadata: { featureName, requirementCount: requirements.length },
  };
}

/** Create an architecture choice checkpoint with 3 approaches */
export function createArchitectureCheckpoint(
  options: Array<{ approach: string; pros: string[]; cons: string[]; effort: string }>
): Checkpoint {
  const labels = ['Minimal', 'Clean', 'Pragmatic'];
  const descriptions = ['Fastest path, minimal scope', 'Balanced design and speed', 'Comprehensive, thorough'];

  const checkpointOptions: CheckpointOption[] = options.slice(0, 3).map((opt, i) => ({
    key: String.fromCharCode(97 + i),
    label: `${labels[i] ?? opt.approach} (${opt.effort})`,
    description: [
      opt.approach,
      `Pros: ${opt.pros.join(', ')}`,
      `Cons: ${opt.cons.join(', ')}`,
      descriptions[i] ?? '',
    ].filter(Boolean).join(' | '),
  }));

  const summary = options
    .slice(0, 3)
    .map((opt, i) => `${labels[i] ?? opt.approach}: ${opt.approach} [${opt.effort}]`)
    .join('\n');

  return {
    type: 'architecture_choice',
    title: 'Architecture Approach',
    summary,
    options: checkpointOptions,
    defaultOption: 'b',
    metadata: { approachCount: options.length },
  };
}

/** Create an implementation scope checkpoint */
export function createScopeCheckpoint(
  files: Array<{ path: string; action: 'create' | 'modify' | 'delete' }>,
  estimatedLines: number
): Checkpoint {
  const actionIcon: Record<string, string> = { create: '+', modify: '~', delete: '-' };
  const fileLines = files.map(f => `  [${actionIcon[f.action] ?? '?'}] ${f.path}`);

  const summary = [
    `Estimated lines of change: ${estimatedLines}`,
    '',
    'Files:',
    ...fileLines,
  ].join('\n');

  return {
    type: 'implementation_scope',
    title: 'Implementation Scope Approval',
    summary,
    options: [
      { key: 'a', label: 'Approve', description: 'Proceed with the listed scope.' },
      { key: 'b', label: 'Narrow', description: 'Reduce scope before implementation.' },
      { key: 'c', label: 'Abort', description: 'Cancel implementation.' },
    ],
    defaultOption: 'a',
    metadata: { fileCount: files.length, estimatedLines },
  };
}

/** Create a verification result checkpoint */
export function createVerificationCheckpoint(
  achievementRate: number,
  failedRequirements: string[],
  iteration: number
): Checkpoint {
  const ratePercent = Math.round(achievementRate * 100);
  const passedCount = failedRequirements.length === 0
    ? 'all'
    : `some`;

  const failedLines = failedRequirements.length > 0
    ? ['', 'Failed requirements:', ...failedRequirements.map(r => `  - ${r}`)]
    : ['', 'All requirements passed.'];

  const summary = [
    `Iteration: ${iteration}`,
    `Achievement rate: ${ratePercent}%  (${passedCount} requirements met)`,
    ...failedLines,
  ].join('\n');

  return {
    type: 'verification_result',
    title: 'Verification Result Review',
    summary,
    options: [
      { key: 'a', label: 'Continue fixing', description: 'Run another fix iteration.' },
      { key: 'b', label: 'Accept as-is', description: 'Accept current state and move on.' },
      { key: 'c', label: 'Abort', description: 'Stop the workflow.' },
    ],
    defaultOption: failedRequirements.length === 0 ? 'b' : 'a',
    metadata: { achievementRate, failedCount: failedRequirements.length, iteration },
  };
}

/** Create a fix strategy checkpoint */
export function createFixStrategyCheckpoint(
  issues: Array<{ severity: 'critical' | 'warning' | 'info'; description: string }>
): Checkpoint {
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  const issueLines = issues.map(i => `  [${i.severity.toUpperCase()}] ${i.description}`);

  const summary = [
    `Issues: ${criticalCount} critical, ${warningCount} warning, ${infoCount} info`,
    '',
    ...issueLines,
  ].join('\n');

  return {
    type: 'fix_strategy',
    title: 'Fix Strategy Selection',
    summary,
    options: [
      { key: 'a', label: 'Fix all', description: 'Address every issue (critical, warning, info).' },
      { key: 'b', label: 'Critical only', description: 'Fix only critical issues and skip the rest.' },
      { key: 'c', label: 'Accept as-is', description: 'Skip all fixes and proceed.' },
    ],
    defaultOption: criticalCount > 0 ? 'a' : 'c',
    metadata: { criticalCount, warningCount, infoCount },
  };
}

/** Format a checkpoint as readable prompt text */
export function formatCheckpoint(checkpoint: Checkpoint): string {
  const divider = '─'.repeat(50);
  const optionLines = checkpoint.options.map(
    opt => `  ${opt.key}) ${opt.label}\n     ${opt.description}`
  );

  return [
    divider,
    `CHECKPOINT: ${checkpoint.title}`,
    divider,
    checkpoint.summary,
    '',
    'Options:',
    ...optionLines,
    '',
    `Default: ${checkpoint.defaultOption}`,
    divider,
  ].join('\n');
}

/** Resolve a checkpoint with user's choice */
export function resolveCheckpoint(
  checkpoint: Checkpoint,
  selectedKey: string
): CheckpointResult {
  const validKeys = checkpoint.options.map(o => o.key);
  if (!validKeys.includes(selectedKey)) {
    throw new Error(
      `Invalid option key "${selectedKey}". Valid keys: ${validKeys.join(', ')}`
    );
  }

  return {
    type: checkpoint.type,
    selectedOption: selectedKey,
    timestamp: new Date().toISOString(),
    autoResolved: false,
  };
}

/** Auto-resolve a checkpoint using the default option */
export function autoResolveCheckpoint(checkpoint: Checkpoint): CheckpointResult {
  return {
    type: checkpoint.type,
    selectedOption: checkpoint.defaultOption,
    timestamp: new Date().toISOString(),
    autoResolved: true,
  };
}

/** Create a new checkpoint history for a feature */
export function createHistory(feature: string): CheckpointHistory {
  return { feature, results: [] };
}

/** Append a result to history (immutable — returns new history) */
export function addToHistory(
  history: CheckpointHistory,
  result: CheckpointResult
): CheckpointHistory {
  return {
    feature: history.feature,
    results: [...history.results, result],
  };
}
