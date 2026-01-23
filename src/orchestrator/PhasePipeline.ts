/**
 * PhasePipeline - Phase 간 대기 시간 제거를 위한 파이프라인 시스템
 * v2.6.0: Background preparation + Phase pipelining
 *
 * 핵심 기능:
 * 1. 현재 Phase 실행 중 다음 Phase 준비 (background)
 * 2. Phase 완료 시 즉시 다음 Phase 시작 (no wait)
 * 3. Phase 실패 시 파이프라인 중단
 */

import {
  startIteration,
  startPhase,
  completePhase,
  failPhase,
  completeIteration,
  formatPhaseStart,
  formatPhaseComplete,
  formatIterationComplete,
  IterationState,
  PhaseProgress
} from '../lib/IterationTracker.js';
import { backgroundManager, TaskInfo, PipelineTimeoutError } from './BackgroundManager.js';
import { CONCURRENCY } from '../lib/constants.js';
import { warnLog } from '../lib/utils.js';
import { ToolResult } from '../types/tool.js';

// ============================================
// Pipeline Types
// ============================================

/** 파이프라인 스테이지 인터페이스 */
export interface PipelineStage {
  /** 스테이지 이름 */
  name: string;
  /** 준비 작업 (백그라운드 실행 가능) */
  prepare?: () => Promise<StageContext>;
  /** 메인 실행 */
  execute: (context: StageContext) => Promise<StageResult>;
  /** 정리 작업 */
  cleanup?: (context: StageContext) => Promise<void>;
}

/** 스테이지 컨텍스트 (Phase 간 데이터 전달) */
export interface StageContext {
  phaseNumber: number;
  phaseName: string;
  data: Record<string, unknown>;
  preparedData?: Record<string, unknown>;
  previousResult?: StageResult;
}

/** 스테이지 결과 */
export interface StageResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
  artifacts?: string[];
}

/** 파이프라인 옵션 */
export interface PipelineOptions {
  /** ULTRAWORK 모드 (대기 없음) */
  ultrawork?: boolean;
  /** 최대 재시도 횟수 */
  maxRetries?: number;
  /** 전체 파이프라인 타임아웃 (ms) */
  timeout?: number;
  /** Phase 완료 시 콜백 */
  onPhaseComplete?: (phase: PhaseProgress, result: StageResult) => void;
  /** Phase 시작 시 콜백 */
  onPhaseStart?: (phase: PhaseProgress) => void;
  /** 에러 발생 시 콜백 */
  onError?: (phase: PhaseProgress, error: Error) => void;
}

/** 파이프라인 결과 */
export interface PipelineResult {
  success: boolean;
  featureName: string;
  totalPhases: number;
  completedPhases: number;
  failedPhase?: number;
  totalDuration: number;
  results: StageResult[];
  error?: string;
}

// ============================================
// PhasePipeline Class
// ============================================

export class PhasePipeline {
  private stages: PipelineStage[] = [];
  private options: Required<PipelineOptions>;
  private abortController: AbortController;
  private backgroundPreparations = new Map<number, Promise<StageContext>>();

  constructor(
    private featureName: string,
    options: PipelineOptions = {}
  ) {
    this.options = {
      ultrawork: options.ultrawork ?? false,
      maxRetries: options.maxRetries ?? 3,
      timeout: options.timeout ?? CONCURRENCY.PIPELINE_TIMEOUT,
      onPhaseComplete: options.onPhaseComplete ?? (() => {}),
      onPhaseStart: options.onPhaseStart ?? (() => {}),
      onError: options.onError ?? (() => {}),
    };
    this.abortController = new AbortController();
  }

  /** 스테이지 추가 */
  addStage(stage: PipelineStage): this {
    this.stages.push(stage);
    return this;
  }

  /** 여러 스테이지 추가 */
  addStages(stages: PipelineStage[]): this {
    this.stages.push(...stages);
    return this;
  }

  /** 파이프라인 실행 */
  async execute(): Promise<PipelineResult> {
    const startTime = Date.now();
    const results: StageResult[] = [];
    let lastContext: StageContext | null = null;

    // 타임아웃 설정
    const timeoutId = setTimeout(() => {
      this.abortController.abort();
    }, this.options.timeout);

    try {
      // Iteration 시작
      const phaseNames = this.stages.map(s => s.name);
      const iteration = startIteration(
        this.featureName,
        phaseNames,
        this.options.ultrawork,
        this.options.maxRetries
      );

      // ULTRAWORK 모드: 백그라운드 준비 시작
      if (this.options.ultrawork) {
        this.startBackgroundPreparations();
      }

      // Phase 순차 실행
      for (let i = 0; i < this.stages.length; i++) {
        if (this.abortController.signal.aborted) {
          throw new PipelineTimeoutError(this.options.timeout);
        }

        const stage = this.stages[i];
        const phaseNumber = i + 1;

        // Phase 시작
        const phaseProgress = startPhase(phaseNumber);
        if (!phaseProgress) {
          throw new Error(`Failed to start phase ${phaseNumber}`);
        }

        this.options.onPhaseStart(phaseProgress);
        console.log(formatPhaseStart(phaseNumber, stage.name, this.stages.length));

        // 컨텍스트 생성
        let context: StageContext = {
          phaseNumber,
          phaseName: stage.name,
          data: {},
          previousResult: lastContext ? results[results.length - 1] : undefined,
        };

        // 백그라운드 준비 결과 병합
        if (this.options.ultrawork && this.backgroundPreparations.has(phaseNumber)) {
          try {
            const preparedContext = await this.backgroundPreparations.get(phaseNumber);
            if (preparedContext) {
              context.preparedData = preparedContext.data;
            }
          } catch {
            // 백그라운드 준비 실패는 무시 (메인 실행에서 처리)
          }
        }

        // 동기 준비 (백그라운드 준비가 없거나 실패한 경우)
        if (!context.preparedData && stage.prepare) {
          const preparedContext = await stage.prepare();
          context.preparedData = preparedContext.data;
        }

        // 메인 실행 (재시도 포함)
        let result: StageResult | null = null;
        let lastError: Error | null = null;

        for (let retry = 0; retry <= this.options.maxRetries; retry++) {
          try {
            result = await stage.execute(context);
            if (result.success) break;
            lastError = new Error(result.error || 'Stage execution failed');
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            const failResult = failPhase(phaseNumber, lastError.message);
            if (!failResult?.canRetry) break;
            warnLog(`[Pipeline] Phase ${phaseNumber} retry ${retry + 1}/${this.options.maxRetries}`);
          }
        }

        if (!result || !result.success) {
          const error = lastError || new Error('Unknown error');
          this.options.onError(phaseProgress, error);

          // 정리 실행
          if (stage.cleanup) {
            await stage.cleanup(context).catch(() => {});
          }

          // 파이프라인 중단
          completeIteration();
          clearTimeout(timeoutId);

          return {
            success: false,
            featureName: this.featureName,
            totalPhases: this.stages.length,
            completedPhases: i,
            failedPhase: phaseNumber,
            totalDuration: Date.now() - startTime,
            results,
            error: error.message,
          };
        }

        // Phase 완료
        results.push(result);
        completePhase(phaseNumber);
        this.options.onPhaseComplete(phaseProgress, result);
        console.log(formatPhaseComplete(phaseNumber, this.stages.length));

        // 정리 실행
        if (stage.cleanup) {
          await stage.cleanup(context).catch(() => {});
        }

        lastContext = context;

        // 다음 Phase 백그라운드 준비 시작 (아직 안 했으면)
        if (this.options.ultrawork && i + 2 <= this.stages.length) {
          this.startBackgroundPreparation(i + 2);
        }
      }

      // 완료
      const finalState = completeIteration();
      if (finalState) {
        console.log(formatIterationComplete(finalState));
      }

      clearTimeout(timeoutId);

      return {
        success: true,
        featureName: this.featureName,
        totalPhases: this.stages.length,
        completedPhases: this.stages.length,
        totalDuration: Date.now() - startTime,
        results,
      };

    } catch (error) {
      clearTimeout(timeoutId);
      completeIteration();

      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        featureName: this.featureName,
        totalPhases: this.stages.length,
        completedPhases: results.length,
        totalDuration: Date.now() - startTime,
        results,
        error: errorMessage,
      };
    }
  }

  /** 파이프라인 취소 */
  cancel(): void {
    this.abortController.abort();
  }

  /** 백그라운드 준비 시작 (모든 Phase) */
  private startBackgroundPreparations(): void {
    // Phase 2부터 백그라운드 준비 시작 (Phase 1은 동기 실행)
    for (let i = 1; i < this.stages.length; i++) {
      this.startBackgroundPreparation(i + 1);
    }
  }

  /** 특정 Phase 백그라운드 준비 시작 */
  private startBackgroundPreparation(phaseNumber: number): void {
    if (this.backgroundPreparations.has(phaseNumber)) return;

    const stageIndex = phaseNumber - 1;
    if (stageIndex >= this.stages.length) return;

    const stage = this.stages[stageIndex];
    if (!stage.prepare) return;

    const preparation = (async (): Promise<StageContext> => {
      const context: StageContext = {
        phaseNumber,
        phaseName: stage.name,
        data: {},
      };

      try {
        const prepared = await stage.prepare!();
        context.data = prepared.data;
        context.preparedData = prepared.data;
      } catch (error) {
        warnLog(`[Pipeline] Background preparation for phase ${phaseNumber} failed: ${error}`);
      }

      return context;
    })();

    this.backgroundPreparations.set(phaseNumber, preparation);
  }
}

// ============================================
// Helper Functions
// ============================================

/**
 * 간단한 스테이지 생성 헬퍼
 */
export function createStage(
  name: string,
  execute: (context: StageContext) => Promise<StageResult>,
  options?: {
    prepare?: () => Promise<StageContext>;
    cleanup?: (context: StageContext) => Promise<void>;
  }
): PipelineStage {
  return {
    name,
    execute,
    prepare: options?.prepare,
    cleanup: options?.cleanup,
  };
}

/**
 * 파이프라인 생성 헬퍼
 */
export function createPipeline(
  featureName: string,
  stages: PipelineStage[],
  options?: PipelineOptions
): PhasePipeline {
  const pipeline = new PhasePipeline(featureName, options);
  pipeline.addStages(stages);
  return pipeline;
}

/**
 * ULTRAWORK 파이프라인 생성 (권장)
 */
export function createUltraworkPipeline(
  featureName: string,
  stages: PipelineStage[],
  options?: Omit<PipelineOptions, 'ultrawork'>
): PhasePipeline {
  return createPipeline(featureName, stages, { ...options, ultrawork: true });
}

// ============================================
// ToolResult Integration
// ============================================

/**
 * 파이프라인 결과를 ToolResult로 변환
 */
export function pipelineResultToToolResult(result: PipelineResult): ToolResult & { pipelineResult: PipelineResult } {
  let text = `## Pipeline: ${result.featureName}\n\n`;
  text += `Status: ${result.success ? '✅ Success' : '❌ Failed'}\n`;
  text += `Phases: ${result.completedPhases}/${result.totalPhases}\n`;
  text += `Duration: ${(result.totalDuration / 1000).toFixed(1)}s\n\n`;

  if (result.error) {
    text += `Error: ${result.error}\n`;
    if (result.failedPhase) {
      text += `Failed at: Phase ${result.failedPhase}\n`;
    }
  }

  text += `\n### Phase Results\n`;
  result.results.forEach((r, i) => {
    const icon = r.success ? '✅' : '❌';
    text += `${icon} Phase ${i + 1}: ${(r.duration / 1000).toFixed(1)}s\n`;
  });

  return {
    content: [{ type: 'text', text }],
    pipelineResult: result,
  };
}
