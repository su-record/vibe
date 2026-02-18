/**
 * PhaseResultStore - File-based Phase result persistence
 *
 * Saves Phase execution results to disk so pipelines can:
 * - Resume from last completed phase after failure
 * - Share results across sessions
 * - Provide audit trail of Phase execution
 *
 * Storage: .claude/vibe/phase-results/{feature-name}/phase-{N}.json
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { StageResult } from './PhasePipeline.js';

// ============================================
// Types
// ============================================

export interface PhaseResultFile {
  featureName: string;
  phaseNumber: number;
  phaseName: string;
  result: StageResult;
  timestamp: number;
  checksum: string;
}

// ============================================
// PhaseResultStore
// ============================================

export class PhaseResultStore {
  private readonly storeDir: string;

  constructor(
    private readonly projectRoot: string,
    private readonly featureName: string
  ) {
    this.storeDir = path.join(
      projectRoot,
      '.claude',
      'vibe',
      'phase-results',
      sanitizeFeatureName(featureName)
    );
  }

  /** Save Phase result to disk */
  save(phaseNumber: number, phaseName: string, result: StageResult): void {
    ensureDir(this.storeDir);

    const data: PhaseResultFile = {
      featureName: this.featureName,
      phaseNumber,
      phaseName,
      result,
      timestamp: Date.now(),
      checksum: '',
    };

    // Compute checksum over content (excluding checksum field itself)
    data.checksum = computeChecksum(data);

    const filePath = this.getFilePath(phaseNumber);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /** Load a single Phase result */
  load(phaseNumber: number): PhaseResultFile | null {
    const filePath = this.getFilePath(phaseNumber);
    if (!fs.existsSync(filePath)) return null;

    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data: PhaseResultFile = JSON.parse(raw);

      // Verify checksum
      const storedChecksum = data.checksum;
      data.checksum = '';
      const computed = computeChecksum(data);
      data.checksum = storedChecksum;

      if (storedChecksum !== computed) {
        return null; // Corrupted file
      }

      return data;
    } catch {
      return null;
    }
  }

  /** Load all saved Phase results, sorted by phaseNumber */
  loadAll(): PhaseResultFile[] {
    if (!fs.existsSync(this.storeDir)) return [];

    const results: PhaseResultFile[] = [];
    try {
      const files = fs.readdirSync(this.storeDir)
        .filter(f => f.startsWith('phase-') && f.endsWith('.json'));

      for (const file of files) {
        const filePath = path.join(this.storeDir, file);
        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const data: PhaseResultFile = JSON.parse(raw);
          results.push(data);
        } catch {
          // Skip corrupted files
        }
      }
    } catch {
      return [];
    }

    return results.sort((a, b) => a.phaseNumber - b.phaseNumber);
  }

  /** Get the last completed phase number (0 if none) */
  getLastCompletedPhase(): number {
    const all = this.loadAll();
    if (all.length === 0) return 0;

    // Find highest phase number with successful result
    let last = 0;
    for (const entry of all) {
      if (entry.result.success && entry.phaseNumber > last) {
        last = entry.phaseNumber;
      }
    }
    return last;
  }

  /** Clear all stored results for this feature */
  clear(): void {
    if (!fs.existsSync(this.storeDir)) return;

    try {
      const files = fs.readdirSync(this.storeDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.storeDir, file));
      }
      fs.rmdirSync(this.storeDir);
    } catch {
      // Best-effort cleanup
    }
  }

  /** Get store directory path */
  getStoreDir(): string {
    return this.storeDir;
  }

  private getFilePath(phaseNumber: number): string {
    return path.join(this.storeDir, `phase-${phaseNumber}.json`);
  }
}

// ============================================
// Helpers
// ============================================

function sanitizeFeatureName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function computeChecksum(data: PhaseResultFile): string {
  const content = JSON.stringify({
    featureName: data.featureName,
    phaseNumber: data.phaseNumber,
    phaseName: data.phaseName,
    result: data.result,
    timestamp: data.timestamp,
  });
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}
