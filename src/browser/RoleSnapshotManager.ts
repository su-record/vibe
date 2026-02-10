/**
 * RoleSnapshotManager — ARIA Snapshot → Role Ref 변환
 *
 * Playwright `page._snapshotForAI()` 호출 → 접근성 트리를 role ref (e1, e2, ...)로 변환.
 * Content-checksum 기반 변경 감지, snapshotVersion 관리.
 */

import type { Page } from 'playwright';
import * as crypto from 'node:crypto';
import type {
  RoleRef,
  RoleRefMap,
  SnapshotOptions,
  SnapshotResult,
} from './types.js';
import { INTERACTIVE_ROLES, CONTENT_ROLES, STRUCTURAL_ROLES } from './types.js';

/** role:name 중복 추적 */
class RoleNameTracker {
  private counts = new Map<string, number>();
  private assignments = new Map<string, number[]>();

  /** 발생 횟수 기록, 인덱스 반환 */
  track(role: string, name?: string): number {
    const key = `${role}:${name ?? ''}`;
    const idx = this.counts.get(key) ?? 0;
    this.counts.set(key, idx + 1);

    const idxList = this.assignments.get(key) ?? [];
    idxList.push(idx);
    this.assignments.set(key, idxList);

    return idx;
  }

  /** 중복이 있는 항목만 nth를 유지 (단일 항목은 nth 제거) */
  hasDuplicates(role: string, name?: string): boolean {
    const key = `${role}:${name ?? ''}`;
    return (this.counts.get(key) ?? 0) > 1;
  }
}

/** ARIA 스냅샷 노드 (Playwright 내부 포맷) */
interface AriaNode {
  role: string;
  name?: string;
  value?: string;
  checked?: boolean | 'mixed';
  disabled?: boolean;
  expanded?: boolean;
  level?: number;
  pressed?: boolean | 'mixed';
  selected?: boolean;
  children?: AriaNode[];
}

export class RoleSnapshotManager {
  private versionCounter = 0;

  /** 페이지 ARIA 스냅샷 수집 + Role Ref 생성 */
  async snapshot(page: Page, options: SnapshotOptions = {}): Promise<SnapshotResult> {
    const rawSnapshot = await this.captureAriaSnapshot(page);
    return this.buildSnapshot(rawSnapshot, options);
  }

  /** 원시 ARIA 스냅샷 캡처 */
  private async captureAriaSnapshot(page: Page): Promise<string> {
    // Playwright 1.58+ `_snapshotForAI()` API 사용
    const snapshotFn = (page as unknown as { _snapshotForAI?: () => Promise<string> })._snapshotForAI;
    if (typeof snapshotFn !== 'function') {
      throw new Error('Playwright _snapshotForAI() not available. Requires Playwright 1.58+');
    }
    return snapshotFn.call(page);
  }

  /** ARIA 스냅샷 텍스트를 파싱하여 Role Ref 맵 생성 */
  buildSnapshot(rawSnapshot: string, options: SnapshotOptions = {}): SnapshotResult {
    this.versionCounter += 1;
    const tracker = new RoleNameTracker();
    const refs: RoleRefMap = {};
    let refCounter = 0;
    let interactiveCount = 0;
    let totalCount = 0;

    const lines = rawSnapshot.split('\n');
    const outputLines: string[] = [];

    // Pass 1: 모든 요소 카운트 (중복 추적)
    const preTracker = new RoleNameTracker();
    for (const line of lines) {
      const parsed = this.parseLine(line);
      if (!parsed) continue;
      preTracker.track(parsed.role, parsed.name);
    }

    // Pass 2: ref 할당 + 출력 생성
    for (const line of lines) {
      const parsed = this.parseLine(line);
      if (!parsed) {
        if (!options.compact) outputLines.push(line);
        continue;
      }

      totalCount++;
      const { role, name, indent, rest } = parsed;

      // maxDepth 체크
      if (options.maxDepth !== undefined) {
        const depth = indent.length / 2;
        if (depth > options.maxDepth) continue;
      }

      const isInteractive = INTERACTIVE_ROLES.has(role);
      const isContent = CONTENT_ROLES.has(role);
      const isStructural = STRUCTURAL_ROLES.has(role);

      // interactive 필터
      if (options.interactive && !isInteractive) {
        if (!isStructural) outputLines.push(line);
        continue;
      }

      // compact: 구조 요소 제거
      if (options.compact && isStructural) continue;

      // Ref 할당 조건: interactive 또는 이름 있는 content
      const shouldAssignRef = isInteractive || (isContent && name !== undefined);

      if (shouldAssignRef) {
        refCounter++;
        const refId = `e${refCounter}`;
        if (isInteractive) interactiveCount++;

        const nth = preTracker.hasDuplicates(role, name)
          ? tracker.track(role, name)
          : undefined;

        refs[refId] = { role, name, ...(nth !== undefined ? { nth } : {}) };

        // 출력에 ref ID 주석 추가
        outputLines.push(`${indent}[${refId}] ${role}${name ? ` "${name}"` : ''}${rest}`);
      } else {
        outputLines.push(line);
      }
    }

    const tree = outputLines.join('\n');
    const checksum = crypto.createHash('md5').update(tree).digest('hex');

    return {
      tree,
      refs,
      snapshotVersion: this.versionCounter,
      checksum,
      interactiveCount,
      totalCount,
    };
  }

  /** 현재 스냅샷 버전 */
  get currentVersion(): number {
    return this.versionCounter;
  }

  // ──────────────────────────────────────────────────────────
  // Private
  // ──────────────────────────────────────────────────────────

  /** ARIA 스냅샷 라인 파싱 */
  private parseLine(line: string): {
    role: string;
    name?: string;
    indent: string;
    rest: string;
  } | null {
    // Playwright ARIA snapshot 포맷: "  - role "name": additional"
    // 또는: "  - role: additional"
    const match = line.match(/^(\s*)- (\w+)(?:\s+"([^"]*)")?(.*)$/);
    if (!match) return null;

    const [, indent, role, name, rest] = match;
    return {
      role,
      name: name || undefined,
      indent,
      rest: rest || '',
    };
  }
}
