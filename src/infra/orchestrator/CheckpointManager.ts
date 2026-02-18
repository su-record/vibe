/**
 * CheckpointManager - Approval gates between pipeline phases
 *
 * Supports two gate types:
 * - auto: condition function returns true → pass automatically
 * - manual: requires explicit approval (skipped in ULTRAWORK mode)
 *
 * Checkpoint state is persisted to disk alongside PhaseResultStore.
 */

import fs from 'fs';
import path from 'path';
import type { StageResult } from './PhasePipeline.js';

// ============================================
// Types
// ============================================

export interface CheckpointGate {
  /** Phase number after which this gate activates */
  afterPhase: number;
  /** Gate type: auto (condition-based) or manual (user approval) */
  type: 'auto' | 'manual';
  /** For auto gates: condition function (true = pass) */
  condition?: (result: StageResult) => boolean;
  /** Optional label for this checkpoint */
  label?: string;
}

interface CheckpointState {
  approved: Record<number, { timestamp: number; auto: boolean }>;
  paused?: number;
}

// ============================================
// CheckpointManager
// ============================================

export class CheckpointManager {
  private state: CheckpointState = { approved: {} };
  private readonly statePath: string | null;

  /**
   * @param gates - Checkpoint gate definitions
   * @param options - Optional: ultrawork mode and persistence path
   */
  constructor(
    private readonly gates: CheckpointGate[],
    private readonly options: {
      ultrawork?: boolean;
      storeDir?: string;
    } = {}
  ) {
    this.statePath = options.storeDir
      ? path.join(options.storeDir, 'checkpoints.json')
      : null;
    this.loadState();
  }

  /**
   * Check if the pipeline should pause after the given phase.
   * Returns true if a gate exists and hasn't been approved yet.
   */
  shouldPause(phaseNumber: number, result: StageResult): boolean {
    const gate = this.gates.find(g => g.afterPhase === phaseNumber);
    if (!gate) return false;

    // Already approved
    if (this.state.approved[phaseNumber]) return false;

    // Auto gate: evaluate condition
    if (gate.type === 'auto') {
      const pass = gate.condition ? gate.condition(result) : result.success;
      if (pass) {
        this.approve(phaseNumber, true);
        return false;
      }
      this.state.paused = phaseNumber;
      this.saveState();
      return true;
    }

    // Manual gate: skip in ULTRAWORK mode
    if (this.options.ultrawork) {
      this.approve(phaseNumber, true);
      return false;
    }

    this.state.paused = phaseNumber;
    this.saveState();
    return true;
  }

  /** Approve a checkpoint (manual or failed auto) */
  approve(phaseNumber: number, auto = false): void {
    this.state.approved[phaseNumber] = {
      timestamp: Date.now(),
      auto,
    };
    if (this.state.paused === phaseNumber) {
      delete this.state.paused;
    }
    this.saveState();
  }

  /** Check if a checkpoint has been approved */
  isApproved(phaseNumber: number): boolean {
    return !!this.state.approved[phaseNumber];
  }

  /** Get the phase number where pipeline is currently paused (if any) */
  getPausedPhase(): number | undefined {
    return this.state.paused;
  }

  /** Get gate definition for a phase */
  getGate(phaseNumber: number): CheckpointGate | undefined {
    return this.gates.find(g => g.afterPhase === phaseNumber);
  }

  /** Get all gates */
  getGates(): CheckpointGate[] {
    return [...this.gates];
  }

  /** Reset all checkpoint state */
  reset(): void {
    this.state = { approved: {} };
    this.saveState();
  }

  private loadState(): void {
    if (!this.statePath || !fs.existsSync(this.statePath)) return;

    try {
      const raw = fs.readFileSync(this.statePath, 'utf-8');
      this.state = JSON.parse(raw);
    } catch {
      this.state = { approved: {} };
    }
  }

  private saveState(): void {
    if (!this.statePath) return;

    try {
      const dir = path.dirname(this.statePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.statePath, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch {
      // Best-effort persistence
    }
  }
}
