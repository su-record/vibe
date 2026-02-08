/**
 * UltraQA - 5-Cycle Autonomous QA Loop
 * Test/Build/Lint → Fail → Architect Diagnosis → Executor Fix → Repeat
 */

export type QAGoal = 'tests' | 'build' | 'lint' | 'typecheck' | 'custom' | 'all';

export interface QAConfig {
  goals: QAGoal[];
  maxCycles: number;
  maxSameFailure: number;
  customCommand?: string;
  interactive?: boolean;
}

export interface QACycleResult {
  cycle: number;
  goal: QAGoal;
  command: string;
  passed: boolean;
  output: string;
  exitCode: number;
  diagnosis?: string;
  fix?: string;
}

export interface QASession {
  config: QAConfig;
  cycles: QACycleResult[];
  currentCycle: number;
  consecutiveFailures: Map<string, number>;
  status: 'running' | 'passed' | 'failed' | 'max_cycles' | 'env_error' | 'architecture_question';
  evidenceCollected: boolean;
  startTime: Date;
  endTime?: Date;
}

// Default commands per goal
const GOAL_COMMANDS: Record<QAGoal, string> = {
  tests: 'npm test',
  build: 'npm run build',
  lint: 'npm run lint',
  typecheck: 'npx tsc --noEmit',
  custom: '',
  all: 'npm run build && npm test && npm run lint',
};

/**
 * Create new QA session
 */
export function createQASession(config: Partial<QAConfig> = {}): QASession {
  return {
    config: {
      goals: config.goals || ['build', 'tests'],
      maxCycles: config.maxCycles || 5,
      maxSameFailure: config.maxSameFailure || 3,
      customCommand: config.customCommand,
      interactive: config.interactive || false,
    },
    cycles: [],
    currentCycle: 0,
    consecutiveFailures: new Map(),
    status: 'running',
    evidenceCollected: false,
    startTime: new Date(),
  };
}

/**
 * Get command for goal
 */
export function getCommandForGoal(goal: QAGoal, customCommand?: string): string {
  if (goal === 'custom' && customCommand) {
    return customCommand;
  }
  return GOAL_COMMANDS[goal] || GOAL_COMMANDS.all;
}

/**
 * Record cycle result
 */
export function recordCycleResult(
  session: QASession,
  result: Omit<QACycleResult, 'cycle'>
): QASession {
  const cycle = session.currentCycle + 1;
  const cycleResult: QACycleResult = { ...result, cycle };

  session.cycles.push(cycleResult);
  session.currentCycle = cycle;

  // Track consecutive failures
  const failureKey = `${result.goal}:${result.output.slice(0, 100)}`;
  if (!result.passed) {
    const count = (session.consecutiveFailures.get(failureKey) || 0) + 1;
    session.consecutiveFailures.set(failureKey, count);

    // 3-Fix Rule: Same failure 3 times → Architecture Question
    if (count >= session.config.maxSameFailure) {
      session.status = 'architecture_question';
      session.endTime = new Date();
    }
  } else {
    session.consecutiveFailures.delete(failureKey);
  }

  // Check for max cycles
  if (cycle >= session.config.maxCycles && session.status === 'running') {
    session.status = 'max_cycles';
    session.endTime = new Date();
  }

  return session;
}

/**
 * Check if session should continue
 */
export function shouldContinue(session: QASession): boolean {
  if (session.status !== 'running') return false;
  if (session.currentCycle >= session.config.maxCycles) return false;

  // Check if all goals passed in last cycle
  const lastCycles = session.cycles.slice(-session.config.goals.length);
  const allPassed = lastCycles.length === session.config.goals.length &&
    lastCycles.every(c => c.passed);

  if (allPassed) {
    session.status = 'passed';
    session.endTime = new Date();
    return false;
  }

  return true;
}

/**
 * Generate architect diagnosis prompt
 */
export function generateDiagnosisPrompt(result: QACycleResult): string {
  return `
## QA Failure Diagnosis Required

**Cycle**: ${result.cycle}
**Goal**: ${result.goal}
**Command**: ${result.command}
**Exit Code**: ${result.exitCode}

### Output:
\`\`\`
${result.output.slice(0, 2000)}
\`\`\`

### Task:
1. Identify the root cause of this failure
2. Determine if it's a code issue, config issue, or environment issue
3. Provide a specific fix recommendation

Return JSON:
\`\`\`json
{
  "rootCause": "description of root cause",
  "category": "code|config|environment|dependency",
  "fix": "specific fix to apply",
  "files": ["list", "of", "files", "to", "modify"],
  "confidence": "high|medium|low"
}
\`\`\`
`.trim();
}

/**
 * Generate executor fix prompt
 */
export function generateFixPrompt(diagnosis: string, result: QACycleResult): string {
  return `
## Apply Fix for QA Failure

**Previous Diagnosis**:
${diagnosis}

**Failed Command**: ${result.command}
**Cycle**: ${result.cycle}

### Task:
Apply the fix identified in the diagnosis. Make minimal changes to resolve the issue.

### Rules:
1. Only modify files mentioned in the diagnosis
2. Make the smallest change that fixes the issue
3. Do not refactor or improve unrelated code
4. Run the verification command after fixing

### After fixing, run:
\`${result.command}\`
`.trim();
}

/**
 * 3-Fix Rule: Generate architecture escalation prompt
 * When same failure occurs 3+ times, stop fixing and question architecture
 */
export function generateArchitectureEscalationPrompt(session: QASession): string {
  const recentFailures = session.cycles.filter(c => !c.passed).slice(-3);
  const failureSummary = recentFailures
    .map((c, i) => `  Attempt ${i + 1}: ${c.goal} - ${c.output.slice(0, 150)}`)
    .join('\n');

  return `
## ⚠️ 3-Fix Rule Triggered - Architecture Question Required

**Same issue failed ${session.config.maxSameFailure}+ times.** This suggests an architectural problem, not a failed hypothesis.

### Failure Pattern:
${failureSummary}

### Architecture Problem Indicators:
- Each fix reveals new shared state/coupling issues in different places
- Fixes require "massive refactoring" to implement
- Each fix creates new symptoms elsewhere

### Required Action:
**STOP attempting more fixes.** Discuss with user before proceeding.

### Questions for User:
1. Is the current approach fundamentally sound?
2. Are we persisting through sheer inertia?
3. Should we refactor architecture vs. continue fixing symptoms?

**Do NOT attempt Fix #${session.config.maxSameFailure + 1} without architectural discussion.**
`.trim();
}

/**
 * Evidence Gate: Check if session has verification evidence
 */
export function requireEvidence(session: QASession): { hasEvidence: boolean; message: string } {
  const passedCycles = session.cycles.filter(c => c.passed);

  if (passedCycles.length === 0) {
    return {
      hasEvidence: false,
      message: 'No passing evidence found. Run verification commands before claiming completion.',
    };
  }

  const goalsCovered = new Set(passedCycles.map(c => c.goal));
  const goalsMissing = session.config.goals.filter(g => !goalsCovered.has(g));

  if (goalsMissing.length > 0) {
    return {
      hasEvidence: false,
      message: `Missing evidence for: ${goalsMissing.join(', ')}. Run verification for all goals.`,
    };
  }

  return { hasEvidence: true, message: 'All goals have passing evidence.' };
}

/**
 * Mark evidence as collected for the session
 */
export function markEvidenceCollected(session: QASession): void {
  session.evidenceCollected = true;
}

/**
 * Format QA session status
 */
export function formatQAStatus(session: QASession): string {
  const lines: string[] = [];
  const icon = session.status === 'passed' ? '✅' :
               session.status === 'running' ? '🔄' :
               session.status === 'architecture_question' ? '⚠️' : '❌';

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`${icon} ULTRAQA - Cycle ${session.currentCycle}/${session.config.maxCycles}`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  lines.push(`Status: ${session.status.toUpperCase()}`);
  if (session.status === 'architecture_question') {
    lines.push(`⚠️ 3-Fix Rule: Architecture Question Required`);
  }
  lines.push(`Goals: ${session.config.goals.join(', ')}`);

  if (session.cycles.length > 0) {
    lines.push(`\nRecent cycles:`);
    const recent = session.cycles.slice(-5);
    for (const cycle of recent) {
      const status = cycle.passed ? '✅' : '❌';
      lines.push(`  ${status} Cycle ${cycle.cycle}: ${cycle.goal} (exit: ${cycle.exitCode})`);
    }
  }

  if (session.endTime) {
    const duration = Math.round((session.endTime.getTime() - session.startTime.getTime()) / 1000);
    lines.push(`\nDuration: ${duration}s`);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  return lines.join('\n');
}

/**
 * Parse QA goal from string
 */
export function parseQAGoals(input: string): QAGoal[] {
  const goals: QAGoal[] = [];

  if (input.includes('--tests') || input.includes('test')) goals.push('tests');
  if (input.includes('--build') || input.includes('build')) goals.push('build');
  if (input.includes('--lint') || input.includes('lint')) goals.push('lint');
  if (input.includes('--typecheck') || input.includes('type')) goals.push('typecheck');
  if (input.includes('--custom')) goals.push('custom');
  if (input.includes('--all') || goals.length === 0) {
    return ['build', 'tests', 'lint', 'typecheck'];
  }

  return goals;
}

/**
 * Create UltraQA workflow description
 */
export function describeUltraQAWorkflow(): string {
  return `
## UltraQA Workflow

5-cycle autonomous QA loop:

\`\`\`
┌─────────────────────────────────────────────┐
│  ULTRAQA CYCLE                              │
│                                             │
│  1. Run verification (test/build/lint)      │
│         ↓                                   │
│  2. Check result                            │
│         ↓                                   │
│     ┌───┴───┐                               │
│   PASS     FAIL                             │
│     ↓        ↓                              │
│   DONE    3. Architect diagnosis            │
│              ↓                              │
│           4. Executor fix                   │
│              ↓                              │
│           5. Repeat (max 5 cycles)          │
└─────────────────────────────────────────────┘
\`\`\`

Exit conditions:
- ✅ All goals pass (with evidence)
- ⚠️ Same failure 3 times → Architecture Question (3-Fix Rule)
- ❌ Max 5 cycles reached
- ❌ Environment error
`.trim();
}
