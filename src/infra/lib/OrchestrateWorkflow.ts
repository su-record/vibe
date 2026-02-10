/**
 * Orchestrate Workflow Pattern
 * Intent Gate → Assessment → Delegation → Verification
 */

export type CodebaseMaturity = 'disciplined' | 'transitional' | 'legacy' | 'greenfield';

export interface IntentGateResult {
  hasMatchingSkill: boolean;
  skillName?: string;
  shouldDelegate: boolean;
  reason: string;
}

export interface CodebaseAssessment {
  maturity: CodebaseMaturity;
  patterns: string[];
  techStack: string[];
  testCoverage: 'high' | 'medium' | 'low' | 'none';
  documentationLevel: 'comprehensive' | 'partial' | 'minimal' | 'none';
  risks: string[];
}

export interface DelegationPlan {
  phases: DelegationPhase[];
  totalAgents: number;
  estimatedComplexity: 'low' | 'medium' | 'high';
  requiredVerifications: string[];
}

export interface DelegationPhase {
  name: string;
  agents: AgentTask[];
  dependencies: string[];
  verificationCriteria: string[];
}

export interface AgentTask {
  agentType: string;
  model: 'haiku' | 'sonnet' | 'opus';
  prompt: string;
  background: boolean;
  timeout?: number;
}

export interface VerificationResult {
  passed: boolean;
  evidence: Evidence[];
  issues: string[];
  architectReview?: string;
}

export interface Evidence {
  type: 'build' | 'test' | 'lint' | 'typecheck' | 'manual';
  command?: string;
  exitCode?: number;
  output?: string;
  passed: boolean;
}

// Phase 0: Intent Gate
const SKILL_KEYWORDS: Record<string, string[]> = {
  'vibe.spec': ['spec', 'specification', 'requirements', 'design'],
  'vibe.review': ['review', 'code review', 'PR review'],
  'vibe.verify': ['verify', 'verification', 'test', 'check'],
  'vibe.analyze': ['analyze', 'analysis', 'explore'],
  'vibe.reason': ['reason', 'reasoning', 'think', 'problem'],
};

/**
 * Phase 0: Intent Gate
 * Check if there's a matching skill BEFORE doing any work
 */
export function checkIntentGate(prompt: string): IntentGateResult {
  const lowerPrompt = prompt.toLowerCase();

  for (const [skillName, keywords] of Object.entries(SKILL_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerPrompt.includes(keyword)) {
        return {
          hasMatchingSkill: true,
          skillName,
          shouldDelegate: true,
          reason: `Prompt matches "${keyword}" → Use ${skillName} instead`,
        };
      }
    }
  }

  return {
    hasMatchingSkill: false,
    shouldDelegate: false,
    reason: 'No matching skill found, proceed with orchestration',
  };
}

/**
 * Phase 1: Codebase Assessment
 * Classify codebase maturity and characteristics
 */
export function assessCodebase(signals: {
  hasTests: boolean;
  hasLinting: boolean;
  hasTypescript: boolean;
  hasCICD: boolean;
  hasDocumentation: boolean;
  fileCount: number;
  techStack: string[];
}): CodebaseAssessment {
  const { hasTests, hasLinting, hasTypescript, hasCICD, hasDocumentation, fileCount, techStack } = signals;

  // Calculate maturity score
  let score = 0;
  if (hasTests) score += 2;
  if (hasLinting) score += 1;
  if (hasTypescript) score += 2;
  if (hasCICD) score += 2;
  if (hasDocumentation) score += 1;

  // Determine maturity
  let maturity: CodebaseMaturity;
  if (fileCount === 0) {
    maturity = 'greenfield';
  } else if (score >= 6) {
    maturity = 'disciplined';
  } else if (score >= 3) {
    maturity = 'transitional';
  } else {
    maturity = 'legacy';
  }

  // Identify patterns
  const patterns: string[] = [];
  if (hasTypescript) patterns.push('TypeScript');
  if (hasTests) patterns.push('Testing');
  if (hasLinting) patterns.push('Linting');
  if (hasCICD) patterns.push('CI/CD');

  // Identify risks
  const risks: string[] = [];
  if (!hasTests) risks.push('No test coverage - changes are risky');
  if (!hasTypescript) risks.push('No type safety - runtime errors possible');
  if (!hasLinting) risks.push('No linting - code style inconsistent');
  if (maturity === 'legacy') risks.push('Legacy codebase - proceed with caution');

  return {
    maturity,
    patterns,
    techStack,
    testCoverage: hasTests ? (hasCICD ? 'high' : 'medium') : 'none',
    documentationLevel: hasDocumentation ? 'partial' : 'minimal',
    risks,
  };
}

/**
 * Phase 2: Create Delegation Plan
 * Plan how to delegate work to sub-agents
 */
export function createDelegationPlan(
  task: string,
  assessment: CodebaseAssessment,
  phaseCount: number = 3
): DelegationPlan {
  const phases: DelegationPhase[] = [];

  // Phase 1: Exploration
  phases.push({
    name: 'Exploration',
    agents: [
      {
        agentType: 'explorer',
        model: 'haiku',
        prompt: `Explore codebase for: ${task}. Find related files, patterns, dependencies.`,
        background: false,
      },
      {
        agentType: 'explorer',
        model: 'haiku',
        prompt: `Search for existing similar implementations or patterns for: ${task}`,
        background: false,
      },
    ],
    dependencies: [],
    verificationCriteria: ['Found relevant files', 'Identified patterns'],
  });

  // Phase 2: Implementation
  const implModel = assessment.maturity === 'disciplined' ? 'sonnet' : 'opus';
  phases.push({
    name: 'Implementation',
    agents: [
      {
        agentType: 'implementer',
        model: implModel as 'sonnet' | 'opus',
        prompt: `Implement: ${task}. Follow existing patterns. Write tests if applicable.`,
        background: false,
      },
    ],
    dependencies: ['Exploration'],
    verificationCriteria: ['Code compiles', 'Tests pass', 'Follows patterns'],
  });

  // Phase 3: Verification
  phases.push({
    name: 'Verification',
    agents: [
      {
        agentType: 'architect',
        model: 'opus',
        prompt: `Verify implementation of: ${task}. Check for issues, security, performance.`,
        background: false,
      },
    ],
    dependencies: ['Implementation'],
    verificationCriteria: ['Architect approval', 'No critical issues'],
  });

  // Add more phases if requested
  for (let i = 3; i < phaseCount; i++) {
    phases.push({
      name: `Phase ${i + 1}`,
      agents: [],
      dependencies: [phases[i - 1].name],
      verificationCriteria: [],
    });
  }

  return {
    phases,
    totalAgents: phases.reduce((sum, p) => sum + p.agents.length, 0),
    estimatedComplexity: assessment.maturity === 'legacy' ? 'high' : 'medium',
    requiredVerifications: ['build', 'test', 'architect_review'],
  };
}

/**
 * Phase 3: Verification with Evidence
 * Collect evidence of completion
 */
export function createVerificationChecklist(plan: DelegationPlan): Evidence[] {
  const evidence: Evidence[] = [];

  // Build verification
  evidence.push({
    type: 'build',
    command: 'npm run build',
    passed: false,
  });

  // Test verification
  evidence.push({
    type: 'test',
    command: 'npm test',
    passed: false,
  });

  // Lint verification
  evidence.push({
    type: 'lint',
    command: 'npm run lint',
    passed: false,
  });

  // Type check verification
  evidence.push({
    type: 'typecheck',
    command: 'npx tsc --noEmit',
    passed: false,
  });

  return evidence;
}

/**
 * Format orchestration status
 */
export function formatOrchestrationStatus(
  phase: string,
  assessment: CodebaseAssessment,
  plan: DelegationPlan
): string {
  const lines: string[] = [];

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`🎭 ORCHESTRATION: ${phase}`);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  lines.push(`\nCodebase: ${assessment.maturity.toUpperCase()}`);
  lines.push(`Stack: ${assessment.techStack.join(', ') || 'Unknown'}`);
  lines.push(`Patterns: ${assessment.patterns.join(', ') || 'None'}`);

  if (assessment.risks.length > 0) {
    lines.push(`\n⚠️ Risks:`);
    for (const risk of assessment.risks) {
      lines.push(`  - ${risk}`);
    }
  }

  lines.push(`\n📋 Plan: ${plan.phases.length} phases, ${plan.totalAgents} agents`);
  for (const p of plan.phases) {
    const agentInfo = p.agents.length > 0
      ? `(${p.agents.map(a => `${a.agentType}:${a.model}`).join(', ')})`
      : '(no agents)';
    lines.push(`  → ${p.name} ${agentInfo}`);
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  return lines.join('\n');
}

/**
 * Background task rules
 */
export function shouldRunInBackground(command: string): boolean {
  const backgroundPatterns = [
    /^npm (run |)(build|test|start|dev)/i,
    /^yarn (build|test|start|dev)/i,
    /^pnpm (build|test|start|dev)/i,
    /^bun (run |)(build|test|start|dev)/i,
    /^(pytest|jest|vitest|mocha)/i,
    /^(tsc|webpack|vite|rollup)/i,
  ];

  const foregroundPatterns = [
    /^git\s/i,
    /^ls\s/i,
    /^cat\s/i,
    /^echo\s/i,
    /^pwd$/i,
  ];

  // Check foreground first (quick commands)
  for (const pattern of foregroundPatterns) {
    if (pattern.test(command)) return false;
  }

  // Check background patterns (long-running)
  for (const pattern of backgroundPatterns) {
    if (pattern.test(command)) return true;
  }

  return false;
}
