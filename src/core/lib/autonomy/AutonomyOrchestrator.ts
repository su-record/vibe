import type { EventBus } from './EventBus.js';
import type { AuditStore } from './AuditStore.js';
import type { SecuritySentinel } from './SecuritySentinel.js';
import type { ConfirmationManager, ConfirmationResult } from './ConfirmationManager.js';
import type { RiskAssessment } from './RiskClassifier.js';
import { TaskDecomposer } from './TaskDecomposer.js';
import type { DecomposedTask, TaskStep, StepStatus } from './TaskDecomposer.js';
import { CollaborationProtocol } from './CollaborationProtocol.js';
import type { AgentAssignment } from './CollaborationProtocol.js';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Constants
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const DEFAULT_MAX_CONCURRENT = 3;
const DEFAULT_STEP_TIMEOUT_S = 600;
const TASK_TIMEOUT_S = 3600;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type AutonomyMode = 'suggest' | 'auto' | 'disabled';

export interface StepResult {
  stepId: string;
  status: StepStatus;
  agentName: string;
  output?: string;
  error?: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
}

export interface ExecutionResult {
  taskId: string;
  mode: AutonomyMode;
  status: 'completed' | 'partial' | 'failed' | 'pending_confirmation' | 'suggested';
  stepResults: StepResult[];
  totalDurationMs: number;
  startedAt: string;
  completedAt: string;
}

export interface TaskProgress {
  taskId: string;
  totalSteps: number;
  completedSteps: number;
  currentStep: string | null;
  percentComplete: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export type StepExecutor = (
  step: TaskStep,
  assignment: AgentAssignment,
) => Promise<{ success: boolean; output?: string; error?: string }>;

export interface OrchestratorDeps {
  eventBus: EventBus;
  auditStore: AuditStore;
  sentinel: SecuritySentinel;
  confirmationManager?: ConfirmationManager;
  stepExecutor?: StepExecutor;
  maxConcurrentSteps?: number;
  maxStepTimeoutS?: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AutonomyOrchestrator
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export class AutonomyOrchestrator {
  private readonly decomposer: TaskDecomposer;
  private readonly protocol: CollaborationProtocol;
  private readonly eventBus: EventBus;
  private readonly auditStore: AuditStore;
  private readonly sentinel: SecuritySentinel;
  private readonly confirmationManager?: ConfirmationManager;
  private readonly stepExecutor?: StepExecutor;
  private readonly maxConcurrent: number;
  private readonly maxStepTimeoutS: number;
  private readonly progress = new Map<string, TaskProgress>();

  constructor(deps: OrchestratorDeps) {
    this.decomposer = new TaskDecomposer();
    this.protocol = new CollaborationProtocol();
    this.eventBus = deps.eventBus;
    this.auditStore = deps.auditStore;
    this.sentinel = deps.sentinel;
    this.confirmationManager = deps.confirmationManager;
    this.stepExecutor = deps.stepExecutor;
    this.maxConcurrent = deps.maxConcurrentSteps ?? DEFAULT_MAX_CONCURRENT;
    this.maxStepTimeoutS = deps.maxStepTimeoutS ?? DEFAULT_STEP_TIMEOUT_S;
  }

  decomposePrompt(prompt: string): DecomposedTask {
    return this.decomposer.decompose(prompt);
  }

  async execute(
    task: DecomposedTask,
    mode: AutonomyMode,
  ): Promise<ExecutionResult> {
    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    this.initProgress(task);

    if (mode === 'suggest' || mode === 'disabled') {
      return this.buildSuggestResult(task, mode, startedAt, startMs);
    }

    const stepResults: StepResult[] = [];
    const taskTimeout = setTimeout(() => {
      // Mark in-progress steps as failed on task timeout
    }, TASK_TIMEOUT_S * 1000);

    try {
      for (const step of task.steps) {
        const result = await this.executeStep(task, step);
        stepResults.push(result);

        if (result.status === 'failed') {
          this.updateProgress(task.id, step, 'failed');
          break;
        }
        this.updateProgress(task.id, step, 'completed');
      }
    } finally {
      clearTimeout(taskTimeout);
    }

    const completedAt = new Date().toISOString();
    const totalDurationMs = Date.now() - startMs;
    const allCompleted = stepResults.every((r) => r.status === 'completed');
    const hasFailed = stepResults.some((r) => r.status === 'failed');

    this.finalizeProgress(task.id, hasFailed ? 'failed' : 'completed');

    return {
      taskId: task.id,
      mode,
      status: allCompleted ? 'completed' : hasFailed ? 'failed' : 'partial',
      stepResults,
      totalDurationMs,
      startedAt,
      completedAt,
    };
  }

  getProgress(taskId: string): TaskProgress | undefined {
    return this.progress.get(taskId);
  }

  getDecomposer(): TaskDecomposer {
    return this.decomposer;
  }

  getProtocol(): CollaborationProtocol {
    return this.protocol;
  }

  private async executeStep(
    task: DecomposedTask,
    step: TaskStep,
  ): Promise<StepResult> {
    const assignment = this.protocol.assignAgent(step);
    const stepStartMs = Date.now();
    const stepStartedAt = new Date().toISOString();

    this.updateProgress(task.id, step, 'in_progress');

    // Emit step start event
    this.emitStepEvent(task, step, assignment, 'started');

    // Risk check via sentinel
    const actionForSentinel = {
      agentId: assignment.agentName,
      actionType: this.stepTypeToActionType(step.type),
      target: task.originalPrompt.slice(0, 200),
      params: {} as Record<string, unknown>,
    };
    const riskResult = this.sentinel.intercept(actionForSentinel);

    // If HIGH risk in auto mode, request confirmation
    if (!riskResult.allowed && riskResult.policyDecision.requiredAction === 'confirm') {
      if (this.confirmationManager) {
        const riskAssessment: RiskAssessment = {
          riskLevel: riskResult.riskLevel,
          score: 80,
          factors: riskResult.policyDecision.matchedPolicies,
          reasoning: riskResult.policyDecision.reason,
        };

        const confirmation = await this.confirmationManager.requestConfirmation(
          actionForSentinel,
          riskAssessment,
        );

        if (confirmation.status !== 'approved') {
          return this.buildStepResult(step, assignment, stepStartedAt, stepStartMs, 'failed', undefined, `Step blocked: ${confirmation.status}`);
        }
      } else {
        return this.buildStepResult(step, assignment, stepStartedAt, stepStartMs, 'failed', undefined, 'HIGH risk step requires confirmation but no ConfirmationManager configured');
      }
    }

    // If blocked outright, fail
    if (!riskResult.allowed && riskResult.policyDecision.requiredAction === 'block') {
      return this.buildStepResult(step, assignment, stepStartedAt, stepStartMs, 'failed', undefined, `Step blocked by policy: ${riskResult.policyDecision.reason}`);
    }

    // Execute the step
    if (this.stepExecutor) {
      try {
        const execResult = await this.executeWithTimeout(
          this.stepExecutor(step, assignment),
          this.maxStepTimeoutS * 1000,
        );

        if (!execResult.success && this.protocol.canRetry(step.id)) {
          this.protocol.recordRetry(step.id);
          const retryResult = await this.executeWithTimeout(
            this.stepExecutor(step, assignment),
            this.maxStepTimeoutS * 1000,
          );
          return this.buildStepResult(
            step, assignment, stepStartedAt, stepStartMs,
            retryResult.success ? 'completed' : 'failed',
            retryResult.output,
            retryResult.error,
          );
        }

        return this.buildStepResult(
          step, assignment, stepStartedAt, stepStartMs,
          execResult.success ? 'completed' : 'failed',
          execResult.output,
          execResult.error,
        );
      } catch (err) {
        return this.buildStepResult(
          step, assignment, stepStartedAt, stepStartMs, 'failed',
          undefined,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    // No executor: mark as completed (dry-run)
    return this.buildStepResult(step, assignment, stepStartedAt, stepStartMs, 'completed', 'dry-run');
  }

  private buildSuggestResult(
    task: DecomposedTask,
    mode: AutonomyMode,
    startedAt: string,
    startMs: number,
  ): ExecutionResult {
    const completedAt = new Date().toISOString();
    return {
      taskId: task.id,
      mode,
      status: 'suggested',
      stepResults: task.steps.map((step) => ({
        stepId: step.id,
        status: 'pending' as StepStatus,
        agentName: this.protocol.assignAgent(step).agentName,
        startedAt,
        completedAt,
        durationMs: 0,
      })),
      totalDurationMs: Date.now() - startMs,
      startedAt,
      completedAt,
    };
  }

  private buildStepResult(
    step: TaskStep,
    assignment: AgentAssignment,
    startedAt: string,
    startMs: number,
    status: StepStatus,
    output?: string,
    error?: string,
  ): StepResult {
    const completedAt = new Date().toISOString();
    this.emitStepEvent(
      { id: step.id } as DecomposedTask,
      step,
      assignment,
      status === 'completed' ? 'completed' : 'failed',
    );
    return {
      stepId: step.id,
      status,
      agentName: assignment.agentName,
      output,
      error,
      startedAt,
      completedAt,
      durationMs: Date.now() - startMs,
    };
  }

  private emitStepEvent(
    task: DecomposedTask,
    step: TaskStep,
    assignment: AgentAssignment,
    status: string,
  ): void {
    try {
      this.eventBus.emit('action_executed', {
        eventType: 'step_execution',
        sourceAgentId: assignment.agentName,
        payload: {
          taskId: task.id,
          stepId: step.id,
          stepType: step.type,
          status,
          agentName: assignment.agentName,
        },
      });
    } catch {
      // Non-critical
    }
  }

  private stepTypeToActionType(type: string): 'file_write' | 'bash_exec' | 'skill_generate' {
    switch (type) {
      case 'implement': return 'file_write';
      case 'test': return 'bash_exec';
      case 'deploy': return 'bash_exec';
      default: return 'skill_generate';
    }
  }

  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Step execution timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs);
      promise
        .then((result) => { clearTimeout(timer); resolve(result); })
        .catch((err) => { clearTimeout(timer); reject(err); });
    });
  }

  private initProgress(task: DecomposedTask): void {
    this.progress.set(task.id, {
      taskId: task.id,
      totalSteps: task.steps.length,
      completedSteps: 0,
      currentStep: null,
      percentComplete: 0,
      status: 'running',
    });
  }

  private updateProgress(taskId: string, step: TaskStep, status: StepStatus): void {
    const p = this.progress.get(taskId);
    if (!p) return;
    if (status === 'in_progress') {
      p.currentStep = step.id;
    } else if (status === 'completed') {
      p.completedSteps++;
      p.percentComplete = Math.round((p.completedSteps / p.totalSteps) * 100);
    } else if (status === 'failed') {
      p.status = 'failed';
    }
  }

  private finalizeProgress(taskId: string, status: 'completed' | 'failed'): void {
    const p = this.progress.get(taskId);
    if (!p) return;
    p.status = status;
    p.currentStep = null;
    if (status === 'completed') {
      p.percentComplete = 100;
    }
  }
}
