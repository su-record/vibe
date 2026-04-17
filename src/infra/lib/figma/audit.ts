/**
 * Figma Node Audit — pre-implementation gate that flags properties which
 * Figma's native renderer supports but the browser CSS engine does not
 * (or translates differently). Designer fixes these BEFORE AI reads the
 * file, so the MCP / REST pipeline never sees them.
 *
 * Three failure classes from the Figma↔CSS gap analysis:
 *   1. Mistranslation        — caught by compareRaw (step 4)
 *   2. Unsupported property  — THIS MODULE (step 0)
 *   3. Silent drop           — extract.ts now warns instead of dropping
 */

import { figmaFetch, loadToken } from './api.js';

export type AuditSeverity = 'P1' | 'P2';

export interface AuditFinding {
  nodeId: string;
  /** "Frame / Card / Title" — dot-joined name trail for designer navigation. */
  path: string;
  name: string;
  type: string;
  property: string;
  value: string;
  severity: AuditSeverity;
  /** What breaks in the browser. */
  note: string;
  /** Designer-facing remediation. */
  action: string;
}

export interface AuditReport {
  fileKey: string;
  nodeId: string;
  scannedNodes: number;
  findings: AuditFinding[];
  p1Count: number;
  p2Count: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

const UNSUPPORTED_BLEND_MODES = new Set([
  'LINEAR_BURN',
  'LINEAR_DODGE',
  'PLUS_DARKER',
  'PLUS_LIGHTER',
]);

function pushFrom(node: any, trail: string[], findings: AuditFinding[]): void {
  const path = trail.join(' / ') || node.name || node.id;
  const base = { nodeId: node.id, path, name: node.name ?? '', type: node.type };

  // 1. stroke alignment — CSS border is always centered; INSIDE/OUTSIDE
  //    shift layout box vs. visual box and have no direct equivalent.
  if (node.strokes?.length && node.strokeAlign && node.strokeAlign !== 'CENTER') {
    findings.push({
      ...base,
      property: 'strokeAlign',
      value: String(node.strokeAlign),
      severity: 'P1',
      note: 'CSS border is always drawn centered on the path — INSIDE/OUTSIDE shifts do not translate.',
      action: `Change stroke alignment to CENTER in Figma (current: ${node.strokeAlign}).`,
    });
  }

  // 2. blend modes without a CSS mix-blend-mode equivalent.
  if (node.blendMode && UNSUPPORTED_BLEND_MODES.has(node.blendMode)) {
    findings.push({
      ...base,
      property: 'blendMode',
      value: String(node.blendMode),
      severity: 'P1',
      note: 'CSS mix-blend-mode has no equivalent — Figma renderer only.',
      action: `Replace with a supported blend mode (MULTIPLY / SCREEN / OVERLAY / …) or bake into the asset.`,
    });
  }

  // 3. vertical trim / leading-trim → text-box-trim, Firefox unsupported as of 2026-04.
  if (node.style && (node.style.leadingTrim || node.style.textBoxTrim)) {
    findings.push({
      ...base,
      property: 'style.leadingTrim',
      value: String(node.style.leadingTrim ?? node.style.textBoxTrim),
      severity: 'P2',
      note: 'Maps to CSS text-box-trim — not supported in Firefox yet, inconsistent across engines.',
      action: 'Disable vertical trim in Figma, rely on explicit line-height instead.',
    });
  }

  // 4. Constraints set to SCALE or CENTER — semantics differ from CSS position:absolute fixed offsets.
  for (const axis of ['horizontal', 'vertical'] as const) {
    const v = node.constraints?.[axis];
    if (v === 'SCALE' || v === 'CENTER') {
      findings.push({
        ...base,
        property: `constraints.${axis}`,
        value: String(v),
        severity: 'P2',
        note: `Constraints.${axis}=${v} scales/centers relative to parent — CSS position: absolute uses fixed offsets, behaviour diverges on resize.`,
        action: `Switch to LEFT / RIGHT / TOP / BOTTOM / LEFT_RIGHT / TOP_BOTTOM, or use Auto Layout instead.`,
      });
    }
  }

  // 5. individualStrokeWeights with non-CENTER align compounds problem 1.
  if (node.individualStrokeWeights && node.strokeAlign && node.strokeAlign !== 'CENTER') {
    findings.push({
      ...base,
      property: 'individualStrokeWeights',
      value: 'set with non-center alignment',
      severity: 'P2',
      note: 'Per-side stroke widths + INSIDE/OUTSIDE alignment compounds — CSS border-width per-side is centered only.',
      action: 'Keep per-side widths but set strokeAlign=CENTER.',
    });
  }
}

function walkAudit(node: any, trail: string[], findings: AuditFinding[], counter: { n: number }): void {
  counter.n += 1;
  const nextTrail = [...trail, node.name ?? node.id];
  pushFrom(node, nextTrail, findings);
  if (node.children?.length) {
    for (const child of node.children) walkAudit(child, nextTrail, findings, counter);
  }
}

/* eslint-enable @typescript-eslint/no-explicit-any */

export async function auditNode(fileKey: string, nodeId: string, depth?: number): Promise<AuditReport> {
  const token = loadToken();
  const depthParam = depth ? `&depth=${depth}` : '';
  const data = await figmaFetch<{ nodes?: Record<string, { document?: unknown }> }>(
    `/files/${fileKey}/nodes?ids=${nodeId}${depthParam}`,
    token,
  );
  const doc = data.nodes?.[nodeId]?.document;
  if (!doc) throw new Error(`Node ${nodeId} not found in file ${fileKey}`);

  const findings: AuditFinding[] = [];
  const counter = { n: 0 };
  walkAudit(doc, [], findings, counter);

  return {
    fileKey,
    nodeId,
    scannedNodes: counter.n,
    findings,
    p1Count: findings.filter((f) => f.severity === 'P1').length,
    p2Count: findings.filter((f) => f.severity === 'P2').length,
  };
}

export function formatAuditReport(report: AuditReport): string {
  const lines: string[] = [];
  lines.push(`Figma Audit — ${report.fileKey} / ${report.nodeId}`);
  lines.push(`Scanned ${report.scannedNodes} nodes · P1=${report.p1Count} P2=${report.p2Count}`);
  lines.push('');
  if (report.findings.length === 0) {
    lines.push('✓ No CSS-incompatible properties found.');
    return lines.join('\n');
  }
  for (const f of report.findings) {
    lines.push(`[${f.severity}] ${f.path}`);
    lines.push(`  property: ${f.property} = ${f.value}`);
    lines.push(`  reason:   ${f.note}`);
    lines.push(`  action:   ${f.action}`);
    lines.push('');
  }
  return lines.join('\n');
}
